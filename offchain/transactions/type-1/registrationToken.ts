import {
  Asset,
  byteString,
  conStr,
  conStr0,
  conStr1,
  deserializeDatum,
  MeshTxBuilder,
  stringToHex,
  UTxO,
  IWallet,
  deserializeAddress,
  mConStr0,
} from "@meshsdk/core";

import { provider } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import {
  BlacklistBootstrap,
  ProtocolBootstrapParams,
  RegistryDatum,
} from "../../types";
import {
  getSmartWalletAddress,
  parseRegistryDatum,
  walletConfig,
} from "../../utils";

export const registerProgrammableToken = async (
  assetName: string,
  quantity: string,
  params: ProtocolBootstrapParams,
  wallet: IWallet,
  NetworkId: 0 | 1,
  blacklistParam: BlacklistBootstrap,
  recipientAddress?: string | null,
) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);
  const { pubKeyHash: adminPkh } = deserializeAddress(changeAddress);

  const standard = new StandardScripts(NetworkId);
  const substandard = new SubStandardScripts(NetworkId);

  const registrySpend = await standard.registrySpend(params);
  const registryMint = await standard.registryMint(params);

  // Use the actual admin PKH from the wallet unless specified
  const issuerAdminPkh = adminPkh!;
  const substandardIssue = await substandard.issuerAdmin(issuerAdminPkh!);
  const substandardTransfer = await substandard.customTransfer(
    params.programmableLogicBaseParams.scriptHash,
    blacklistParam.blacklistMintBootstrap.scriptHash,
  );

  const issuanceMint = await standard.issuanceMint(
    substandardIssue.policyId,
    params,
  );

  const protocolParamsUtxo = (await provider.fetchUTxOs(params.txHash, 0))?.[0];
  if (!protocolParamsUtxo)
    throw new Error("Could not resolve protocol params reference UTxO");

  const issuanceUtxo = (await provider.fetchUTxOs(params.txHash, 2))?.[0];
  if (!issuanceUtxo)
    throw new Error("Could not resolve issuance params reference UTxO");

  const progTokenPolicyId = issuanceMint.policyId;

  const registryEntries = await provider.fetchAddressUTxOs(
    registrySpend.address,
  );

  const isRegistered = registryEntries
    .filter((u: UTxO) => u.output.plutusData)
    .map((u: UTxO) =>
      parseRegistryDatum(deserializeDatum(u.output.plutusData!)),
    )
    .filter((d): d is RegistryDatum => d !== null)
    .some((d) => d.key === progTokenPolicyId);

  if (isRegistered)
    throw new Error(`Token policy ${progTokenPolicyId} already registered`);

  // Find the covering node in the linked list
  const nodeToReplaceUtxo = registryEntries.find((utxo: UTxO) => {
    if (!utxo.output.plutusData) return false;
    const d = parseRegistryDatum(deserializeDatum(utxo.output.plutusData!));
    if (!d) return false;

    // Lexicographical order check: d.key < newKey < d.next
    // Handle the origin node (empty string) and end node (ffff...)
    const key = d.key === "" ? "" : d.key;
    const next = d.next;

    return (
      key.localeCompare(progTokenPolicyId) < 0 &&
      (next ===
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" ||
        progTokenPolicyId.localeCompare(next) < 0)
    );
  });

  if (!nodeToReplaceUtxo)
    throw new Error("Could not find covering node for registration");

  const existingNode = parseRegistryDatum(
    deserializeDatum(nodeToReplaceUtxo.output.plutusData!),
  );
  if (!existingNode) throw new Error("Could not parse current registry node");

  const existingNftUnit = nodeToReplaceUtxo.output.amount.find(
    (a) => a.unit !== "lovelace" && a.unit.startsWith(registryMint.policyId),
  )?.unit;
  if (!existingNftUnit)
    throw new Error("Could not find existing registry NFT in node to replace");

  const targetAddress = await getSmartWalletAddress(
    recipientAddress ?? changeAddress,
    params,
    NetworkId,
  );

  // Redeemers
  const issuanceRedeemer = conStr0([
    conStr1([byteString(substandardIssue.policyId)]),
  ]);

  const registryMintRedeemer = conStr1([
    byteString(progTokenPolicyId),
    byteString(substandardIssue.policyId),
  ]);

  // Datums
  const updatePreviousDatum = conStr0([
    byteString(existingNode.key),
    byteString(progTokenPolicyId),
    conStr(existingNode.transferScript.index, [
      byteString(existingNode.transferScript.hash),
    ]),
    conStr(existingNode.thirdPartyScript.index, [
      byteString(existingNode.thirdPartyScript.hash),
    ]),
    byteString(existingNode.metadata),
  ]);

  const insertNewDatum = conStr0([
    byteString(progTokenPolicyId),
    byteString(existingNode.next),
    conStr1([byteString(substandardTransfer.policyId)]),
    conStr1([byteString(substandardIssue.policyId)]),
    byteString(""), // global_state_cs
  ]);

  const directorySpendAssets: Asset[] = [
    { unit: "lovelace", quantity: "2000000" },
    { unit: existingNftUnit, quantity: "1" },
  ];
  const directoryMintAssets: Asset[] = [
    { unit: "lovelace", quantity: "6500000" },
    { unit: registryMint.policyId + progTokenPolicyId, quantity: "1" },
  ];
  const programmableTokenAssets: Asset[] = [
    { unit: "lovelace", quantity: "2000000" },
    { unit: progTokenPolicyId + stringToHex(assetName), quantity: quantity },
  ];

  console.log(deserializeDatum(protocolParamsUtxo.output.plutusData!));
  console.log(registryMint.policyId);

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
  });
  txBuilder.txEvaluationMultiplier = 1.3;

  await txBuilder
    .spendingPlutusScriptV3()
    .txIn(nodeToReplaceUtxo.input.txHash, nodeToReplaceUtxo.input.outputIndex)
    .txInScript(registrySpend.cbor)
    .txInInlineDatumPresent()
    .txInRedeemerValue(mConStr0([]), "Mesh")

    .withdrawalPlutusScriptV3()
    .withdrawal(substandardIssue.rewardAddress, "0")
    .withdrawalScript(substandardIssue.cbor)
    .withdrawalRedeemerValue(mConStr0([]), "Mesh")

    .mintPlutusScriptV3()
    .mint(quantity, progTokenPolicyId, stringToHex(assetName))
    .mintingScript(issuanceMint.cbor)
    .mintRedeemerValue(issuanceRedeemer, "JSON")

    .mintPlutusScriptV3()
    .mint("1", registryMint.policyId, progTokenPolicyId)
    .mintingScript(registryMint.cbor)
    .mintRedeemerValue(registryMintRedeemer, "JSON")

    .txOut(targetAddress, programmableTokenAssets)
    .txOutInlineDatumValue(conStr0([]), "JSON")

    .txOut(registrySpend.address, directorySpendAssets)
    .txOutInlineDatumValue(updatePreviousDatum, "JSON")

    .txOut(registrySpend.address, directoryMintAssets)
    .txOutInlineDatumValue(insertNewDatum, "JSON")

    .readOnlyTxInReference(
      protocolParamsUtxo.input.txHash,
      protocolParamsUtxo.input.outputIndex,
    )
    .readOnlyTxInReference(
      issuanceUtxo.input.txHash,
      issuanceUtxo.input.outputIndex,
    )

    .requiredSignerHash(issuerAdminPkh)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress)
  return await txBuilder.complete();
};
