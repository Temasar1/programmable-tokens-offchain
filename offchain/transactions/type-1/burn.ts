import {
  byteString,
  conStr0,
  conStr1,
  deserializeDatum,
  integer,
  IWallet,
  list,
  MeshTxBuilder,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { provider } from "../../../config";
import { parseRegistryDatum, walletConfig } from "../../utils";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";

const compareUtxos = (a: UTxO, b: UTxO): number =>
  a.input.txHash !== b.input.txHash
    ? a.input.txHash.localeCompare(b.input.txHash)
    : a.input.outputIndex - b.input.outputIndex;

export const burnProgrammableTokens = async (request: {
  wallet: IWallet;
  networkId: 0 | 1;
  params: ProtocolBootstrapParams;
  tokenPolicyId: string;
  assetName: string;
  quantity: string;
  txhash: string;
  outputIndex: number;
  issuerAdminPkh: string;
}) => {
  const { params, tokenPolicyId, assetName, quantity, txhash, outputIndex, issuerAdminPkh } =
    request;
  const { changeAddress, collateral, walletUtxos } = await walletConfig(
    request.wallet,
  );

  const standard = new StandardScripts(request.networkId);
  const substandard = new SubStandardScripts(request.networkId);

  const programmableLogicBase = await standard.programmableLogicBase(params);
  const programmableLogicGlobal =
    await standard.programmableLogicGlobal(params);
  const registrySpend = await standard.registrySpend(params);
  const substandardIssue = await substandard.issuerAdmin(issuerAdminPkh);
  const issuanceMint = await standard.issuanceMint(
    substandardIssue.policyId,
    params,
  );

  const utxoToBurn = (await provider.fetchUTxOs(txhash, outputIndex))?.[0];
  if (!utxoToBurn) throw new Error("Token UTxO not found");

  const tokenUnit = issuanceMint.policyId + stringToHex(assetName);
  const utxoTokenAmount =
    utxoToBurn.output.amount.find((a) => a.unit === tokenUnit)?.quantity ?? "0";
  if (Number(quantity) > Number(utxoTokenAmount))
    throw new Error("Not enough tokens to burn");

  const registryUtxos = await provider.fetchAddressUTxOs(registrySpend.address);
  const progTokenRegistry = registryUtxos.find((utxo) => {
    if (!utxo.output.plutusData) return false;
    const parsed = parseRegistryDatum(deserializeDatum(utxo.output.plutusData));
    return parsed?.key === tokenPolicyId;
  });
  if (!progTokenRegistry)
    throw new Error("Registry entry not found, token not registered");

  const protocolParamsUtxo = (await provider.fetchUTxOs(params.txHash, 0))?.[0];
  if (!protocolParamsUtxo) throw new Error("Protocol params missing");

  // Sort spending inputs to determine on-chain index of the burn input
  const sortedInputs = [...walletUtxos, utxoToBurn].sort(compareUtxos);
  const burnIndex = sortedInputs.findIndex(
    (u) => u.input.txHash === txhash && u.input.outputIndex === outputIndex,
  );
  if (burnIndex === -1) throw new Error("Could not determine burn input index");

  const sortedRefInputs = [protocolParamsUtxo, progTokenRegistry].sort(
    compareUtxos,
  );

  const registryRefInputIndex = sortedRefInputs.findIndex(
    (r) =>
      r.input.txHash === progTokenRegistry.input.txHash &&
      r.input.outputIndex === progTokenRegistry.input.outputIndex,
  );
  if (registryRefInputIndex === -1)
    throw new Error("Could not find registry in sorted reference inputs");

  const issuanceRedeemer = conStr0([
    conStr1([byteString(substandardIssue.policyId)]),
  ]);

  const programmableGlobalRedeemer = conStr1([
    integer(registryRefInputIndex),
    list([integer(burnIndex)]),
    integer(1),
    integer(1),
  ]);

  const returningAmount = utxoToBurn.output.amount
    .map((a) =>
      a.unit === tokenUnit
        ? {
            unit: a.unit,
            quantity: String(BigInt(a.quantity) - BigInt(quantity)),
          }
        : a,
    )
    .filter((a) => BigInt(a.quantity) > 0n);

  const tx = new MeshTxBuilder({ fetcher: provider, evaluator: provider });

  tx.spendingPlutusScriptV3()
    .txIn(utxoToBurn.input.txHash, utxoToBurn.input.outputIndex)
    .txInScript(programmableLogicBase.cbor)
    .txInInlineDatumPresent()
    .txInRedeemerValue(conStr0([]), "JSON")

    .withdrawalPlutusScriptV3()
    .withdrawal(substandardIssue.rewardAddress, "0")
    .withdrawalScript(substandardIssue.cbor)
    .withdrawalRedeemerValue(conStr0([]), "JSON")

    .withdrawalPlutusScriptV3()
    .withdrawal(programmableLogicGlobal.rewardAddress, "0")
    .withdrawalScript(programmableLogicGlobal.cbor)
    .withdrawalRedeemerValue(programmableGlobalRedeemer, "JSON")

    .mintPlutusScriptV3()
    .mint(`-${quantity}`, issuanceMint.policyId, stringToHex(assetName))
    .mintingScript(issuanceMint.cbor)
    .mintRedeemerValue(issuanceRedeemer, "JSON");

  if (returningAmount.length > 0) {
    tx.txOut(utxoToBurn.output.address, returningAmount).txOutInlineDatumValue(
      conStr0([]),
      "JSON",
    );
  }

  for (const refInput of sortedRefInputs) {
    tx.readOnlyTxInReference(refInput.input.txHash, refInput.input.outputIndex);
  }

  tx.requiredSignerHash(issuerAdminPkh)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(request.networkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress);

  return tx.complete();
};
