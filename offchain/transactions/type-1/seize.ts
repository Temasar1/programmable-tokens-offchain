import {
  Asset,
  conStr0,
  conStr1,
  deserializeDatum,
  integer,
  list,
  MeshTxBuilder,
  POLICY_ID_LENGTH,
  UTxO,
  IWallet,
} from "@meshsdk/core";

import { provider } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";
import {
  getSmartWalletAddress,
  parseRegistryDatum,
  selectEnoughAdaUtxos,
  walletConfig,
} from "../../utils";

const compareUtxos = (a: UTxO, b: UTxO): number =>
  a.input.txHash !== b.input.txHash
    ? a.input.txHash.localeCompare(b.input.txHash)
    : a.input.outputIndex - b.input.outputIndex;

export const seizeProgrammableTokens = async (
  unit: string,
  utxoTxHash: string,
  utxoOutputIndex: number,
  targetAddress: string,
  issuerAdminPkh: string,
  params: ProtocolBootstrapParams,
  NetworkId: 0 | 1,
  wallet: IWallet,
): Promise<string> => {
  const policyId = unit.substring(0, POLICY_ID_LENGTH);
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const standardScript = new StandardScripts(NetworkId);
  const substandardScript = new SubStandardScripts(NetworkId);
  const programmableLogicBase = await standardScript.programmableLogicBase(params);
  const programmableLogicGlobal = await standardScript.programmableLogicGlobal(params);
  const registrySpend = await standardScript.registrySpend(params);
  const substandardIssueAdmin = await substandardScript.issuerAdmin(issuerAdminPkh);

  const recipientSmartWallet = await getSmartWalletAddress(targetAddress, params, NetworkId);

  const adminUtxos = await selectEnoughAdaUtxos(wallet);
  if (adminUtxos.length === 0) throw new Error("No admin UTxOs found for fees");

  const utxosAtRef = await provider.fetchUTxOs(utxoTxHash, utxoOutputIndex);
  const utxoToSeize = utxosAtRef?.[0];
  if (!utxoToSeize) throw new Error("could not find utxo to seize");
  if (!utxoToSeize.output.plutusData) {
    throw new Error("UTXO to seize must have inline datum");
  }

  const tokenAsset = utxoToSeize.output.amount.find((a) => a.unit === unit);
  if (!tokenAsset) throw new Error("UTXO does not contain the specified token");
  if (Number(tokenAsset.quantity) <= 0) {
    throw new Error("UTXO token quantity must be greater than zero");
  }

  const registryUtxos = await provider.fetchAddressUTxOs(registrySpend.address);
  const progTokenRegistry = registryUtxos.find((utxo: UTxO) => {
    if (!utxo.output.plutusData) return false;
    const datum = deserializeDatum(utxo.output.plutusData);
    const parsedDatum = parseRegistryDatum(datum);
    return parsedDatum?.key === policyId;
  });
  if (!progTokenRegistry) throw new Error("could not find registry entry for token");

  const protocolParamsUtxos = await provider.fetchUTxOs(params.txHash, 0);
  const protocolParamsUtxo = protocolParamsUtxos?.[0];
  if (!protocolParamsUtxo) throw new Error("could not resolve protocol params");

  // Sort inputs to determine on-chain index of the seize input
  const sortedInputs = [...adminUtxos, utxoToSeize].sort(compareUtxos);
  const seizeInputIndex = sortedInputs.findIndex(
    (u) =>
      u.input.txHash === utxoToSeize.input.txHash &&
      u.input.outputIndex === utxoToSeize.input.outputIndex,
  );
  if (seizeInputIndex === -1) throw new Error("Could not find seize input index");

  // Sort reference inputs to determine on-chain index of the registry
  const sortedRefInputs = [protocolParamsUtxo, progTokenRegistry].sort(compareUtxos);
  const registryRefInputIndex = sortedRefInputs.findIndex(
    (r) =>
      r.input.txHash === progTokenRegistry.input.txHash &&
      r.input.outputIndex === progTokenRegistry.input.outputIndex,
  );
  if (registryRefInputIndex === -1) throw new Error("Could not find registry in sorted reference inputs");

  const programmableGlobalRedeemer = conStr1([
    integer(registryRefInputIndex),
    list([integer(seizeInputIndex)]),
    integer(2),
    integer(1),
  ]);

  const tokenDatum = conStr0([]);

  const seizedAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: unit, quantity: tokenAsset.quantity },
  ];

  const remainingAssets: Asset[] = utxoToSeize.output.amount.filter(
    (a) => a.unit !== unit,
  );
  if (remainingAssets.length === 0) {
    remainingAssets.push({ unit: "lovelace", quantity: "1000000" });
  }

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
  });

  for (const utxo of adminUtxos) {
    txBuilder.txIn(
      utxo.input.txHash,
      utxo.input.outputIndex,
      utxo.output.amount,
      utxo.output.address,
    );
  }

  txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      utxoToSeize.input.txHash,
      utxoToSeize.input.outputIndex,
      utxoToSeize.output.amount,
      utxoToSeize.output.address,
    )
    .txInScript(programmableLogicBase.cbor)
    .txInRedeemerValue(conStr0([]), "JSON")
    .txInInlineDatumPresent()

    .withdrawalPlutusScriptV3()
    .withdrawal(substandardIssueAdmin.rewardAddress, "0")
    .withdrawalScript(substandardIssueAdmin.cbor)
    .withdrawalRedeemerValue(conStr0([]), "JSON")

    .withdrawalPlutusScriptV3()
    .withdrawal(programmableLogicGlobal.rewardAddress, "0")
    .withdrawalScript(programmableLogicGlobal.cbor)
    .withdrawalRedeemerValue(programmableGlobalRedeemer, "JSON")

    .txOut(recipientSmartWallet, seizedAssets)
    .txOutInlineDatumValue(tokenDatum, "JSON")

    .txOut(utxoToSeize.output.address, remainingAssets)
    .txOutInlineDatumValue(tokenDatum, "JSON");

  for (const refInput of sortedRefInputs) {
    txBuilder.readOnlyTxInReference(
      refInput.input.txHash,
      refInput.input.outputIndex,
    );
  }

  txBuilder
    .requiredSignerHash(issuerAdminPkh)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress);

  return await txBuilder.complete();
};
