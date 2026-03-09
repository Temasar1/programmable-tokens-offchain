import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  deserializeDatum,
  MeshTxBuilder,
  stringToHex,
  UTxO,
  IWallet,
} from "@meshsdk/core";

import { provider } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams, RegistryDatum } from "../../types";
import {
  getSmartWalletAddress,
  parseRegistryDatum,
  selectEnoughAdaUtxos,
  walletConfig,
} from "../../utils";

export const registerProgrammableToken = async (
  assetName: string,
  quantity: string,
  params: ProtocolBootstrapParams,
  wallet: IWallet,
  NetworkId: 0 | 1,
  issuerAdminPkh: string,
  blacklistNodePolicyId: string,
  recipientAddress?: string | null,
) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const standard = new StandardScripts(NetworkId);
  const substandard = new SubStandardScripts(NetworkId);

  const registrySpend = await standard.registrySpend(params);
  const registryMint = await standard.registryMint(params);
  const substandardIssue = await substandard.issuerAdmin(issuerAdminPkh);
  const substandardTransfer = await substandard.customTransfer(
    params.programmableLogicBaseParams.scriptHash,
    blacklistNodePolicyId,
  );
  const issuanceMint = await standard.issuanceMint(substandardIssue.policyId, params);

  const adminUtxos = await selectEnoughAdaUtxos(wallet);
  if (!adminUtxos.length) throw new Error("No admin UTxOs found for fees");

  // Fetch reference UTxOs
  const protocolParamsUtxo = (await provider.fetchUTxOs(params.txHash, 0))?.[0];
  if (!protocolParamsUtxo) throw new Error("Could not resolve protocol params");

  const issuanceUtxo = (await provider.fetchUTxOs(params.txHash, 2))?.[0];
  if (!issuanceUtxo) throw new Error("Could not resolve issuance params");

  const progTokenPolicyId = issuanceMint.policyId;

  // Verify not already registered
  const registryEntries = await provider.fetchAddressUTxOs(registrySpend.address);
  const alreadyRegistered = registryEntries
    .filter((u: UTxO) => !!u.output.plutusData)
    .map((u: UTxO) => parseRegistryDatum(deserializeDatum(u.output.plutusData!)))
    .filter((d): d is RegistryDatum => d !== null)
    .some((d) => d.key === progTokenPolicyId);

  if (alreadyRegistered) throw new Error(`Token policy ${progTokenPolicyId} already registered`);

  // Find the linked-list node to replace (key < progTokenPolicyId < next)
  const nodeToReplaceUtxo = registryEntries.find((utxo: UTxO) => {
    if (!utxo.output.plutusData) return false;
    const d = parseRegistryDatum(deserializeDatum(utxo.output.plutusData!));
    return d && d.key.localeCompare(progTokenPolicyId) < 0 && progTokenPolicyId.localeCompare(d.next) < 0;
  });
  if (!nodeToReplaceUtxo) throw new Error("Could not find node to replace");

  const existingNode = parseRegistryDatum(deserializeDatum(nodeToReplaceUtxo.output.plutusData!));
  if (!existingNode) throw new Error("Could not parse current registry node");

  // Find the existing NFT in the node being replaced (kept in the updated spend output)
  const existingNftUnit = nodeToReplaceUtxo.output.amount.find(
    (a) => a.unit !== "lovelace" && a.unit.startsWith(registryMint.policyId),
  )?.unit;
  if (!existingNftUnit) throw new Error("Could not find existing registry NFT in node to replace");

  const targetAddress = await getSmartWalletAddress(
    recipientAddress ?? changeAddress,
    params,
    NetworkId,
  );

  // Redeemers
  const issuanceRedeemer = conStr0([conStr1([byteString(substandardIssue.policyId)])]);
  const registryMintRedeemer = conStr1([
    byteString(progTokenPolicyId),
    byteString(substandardIssue.policyId),
  ]);

  // Datums: updated previous node (next → new token) and new node
  const updatedSpendDatum = conStr0([
    byteString(existingNode.key),
    byteString(progTokenPolicyId),           // next updated to new token
    byteString(existingNode.transferScriptHash),
    byteString(existingNode.thirdPartyScriptHash),
    byteString(existingNode.metadata),
  ]);

  const newMintDatum = conStr0([
    byteString(progTokenPolicyId),            // key
    byteString(existingNode.next),            // next = old next
    byteString(substandardTransfer.policyId), // transfer script hash
    byteString(substandardIssue.policyId),    // third-party = issue admin
    byteString(""),
  ]);

  // Assets
  const directorySpendAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: existingNftUnit, quantity: "1" },
  ];
  const directoryMintAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: registryMint.policyId + progTokenPolicyId, quantity: "1" },
  ];
  const programmableTokenAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: progTokenPolicyId + stringToHex(assetName), quantity: quantity },
  ];

  const tx = new MeshTxBuilder({ fetcher: provider, evaluator: provider });

  for (const utxo of adminUtxos) {
    tx.txIn(utxo.input.txHash, utxo.input.outputIndex, utxo.output.amount, utxo.output.address);
  }

  tx.spendingPlutusScriptV3()
    .txIn(nodeToReplaceUtxo.input.txHash, nodeToReplaceUtxo.input.outputIndex)
    .txInScript(registrySpend.cbor)
    .txInRedeemerValue(conStr0([]), "JSON")
    .txInInlineDatumPresent()

    .withdrawalPlutusScriptV3()
    .withdrawal(substandardIssue.rewardAddress, "0")
    .withdrawalScript(substandardIssue.cbor)
    .withdrawalRedeemerValue(conStr0([]), "JSON")

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
    .txOutInlineDatumValue(updatedSpendDatum, "JSON")

    .txOut(registrySpend.address, directoryMintAssets)
    .txOutInlineDatumValue(newMintDatum, "JSON")

    .readOnlyTxInReference(protocolParamsUtxo.input.txHash, protocolParamsUtxo.input.outputIndex)
    .readOnlyTxInReference(issuanceUtxo.input.txHash, issuanceUtxo.input.outputIndex)

    .requiredSignerHash(issuerAdminPkh)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress);

  return tx.complete();
};
