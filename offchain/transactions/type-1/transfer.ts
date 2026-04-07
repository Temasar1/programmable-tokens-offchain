import {
  conStr0,
  deserializeDatum,
  integer,
  list,
  MeshTxBuilder,
  POLICY_ID_LENGTH,
  UTxO,
  IWallet,
  deserializeAddress,
} from "@meshsdk/core";

import { provider } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";
import {
  getSmartWalletAddress,
  parseBlacklistDatum,
  parseRegistryDatum,
  selectProgrammableTokenUtxos,
  walletConfig,
} from "../../utils";

const compareUtxos = (a: UTxO, b: UTxO): number =>
  a.input.txHash !== b.input.txHash
    ? a.input.txHash.localeCompare(b.input.txHash)
    : a.input.outputIndex - b.input.outputIndex;

export const transferProgrammableToken = async (
  unit: string,
  quantity: string,
  recipientAddress: string,
  params: ProtocolBootstrapParams,
  NetworkId: 0 | 1,
  wallet: IWallet,
  blacklistNodePolicyId: string,
) => {
  const policyId = unit.substring(0, POLICY_ID_LENGTH);
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const standard = new StandardScripts(NetworkId);
  const substandard = new SubStandardScripts(NetworkId);

  const programmableLogicBase = await standard.programmableLogicBase(params);
  const programmableLogicGlobal =
    await standard.programmableLogicGlobal(params);
  const registrySpend = await standard.registrySpend(params);
  const substandardTransfer = await substandard.customTransfer(
    params.programmableLogicBaseParams.scriptHash,
    blacklistNodePolicyId,
  );
  const substandardTransferCbor = substandardTransfer.cbor;

  const senderCredential =
    deserializeAddress(changeAddress).stakeCredentialHash;
  if (!senderCredential)
    throw new Error("Sender address must include a stake credential");

  const senderSmartWallet = await getSmartWalletAddress(
    changeAddress,
    params,
    NetworkId,
  );
  const recipientSmartWallet = await getSmartWalletAddress(
    recipientAddress,
    params,
    NetworkId,
  );

  // Fetch contracts and UTxOs
  const progTokenRegistry = (
    await provider.fetchAddressUTxOs(registrySpend.address)
  ).find((utxo: UTxO) => {
    if (!utxo.output.plutusData) return false;
    return (
      parseRegistryDatum(deserializeDatum(utxo.output.plutusData))?.key ===
      policyId
    );
  });
  if (!progTokenRegistry)
    throw new Error("Could not find registry entry for token");

  const protocolParamsUtxo = (await provider.fetchUTxOs(params.txHash, 0))?.[0];
  if (!protocolParamsUtxo) throw new Error("Could not resolve protocol params");

  const senderProgTokenUtxos =
    await provider.fetchAddressUTxOs(senderSmartWallet);

  if (!senderProgTokenUtxos?.length)
    throw new Error("No programmable tokens found at sender address");

  const { selectedUtxos } = await selectProgrammableTokenUtxos(
    senderProgTokenUtxos,
    unit,
    Number(quantity),
  );
  if (!selectedUtxos.length) throw new Error("Not enough funds");

  // Sort all spending inputs together (admin + prog token UTxOs)
  const sortedInputs = [...selectedUtxos].sort(compareUtxos);

  // 1. Identify programmable input UTXOs and unique Policy IDs
  const programmableInputs: UTxO[] = [];
  const uniquePolicies: string[] = [];

  for (const utxo of sortedInputs) {
    // Treat all selectedUtxos as programmable inputs (since they were fetched from the smart wallet address)
    programmableInputs.push(utxo);

    for (const asset of utxo.output.amount) {
      if (asset.unit === "lovelace") continue;
      const p = asset.unit.substring(0, 56);
      if (!uniquePolicies.includes(p)) uniquePolicies.push(p);
    }
  }

  // Sort unique policies lexicographically to match Aiken's assets.collect order
  uniquePolicies.sort();

  // 2. Resolve Blacklist proofs (one for EVERY programmable input UTXO)
  const blacklistProofs: UTxO[] = [];
  if (blacklistNodePolicyId) {
    const blacklistSpend = await substandard.blacklistSpend(
      blacklistNodePolicyId,
    );
    const blacklistUtxos = await provider.fetchAddressUTxOs(
      blacklistSpend.address,
    );

    for (const utxo of programmableInputs) {
      const stakingPkh = deserializeAddress(
        utxo.output.address,
      ).stakeCredentialHash;
      if (!stakingPkh) throw new Error("UTXO missing stake credential");

      const proofUtxo = blacklistUtxos.find((bl: UTxO) => {
        if (!bl.output.plutusData) return false;
        const datum = parseBlacklistDatum(
          deserializeDatum(bl.output.plutusData),
        );
        if (!datum) return false;

        // Use stable lexicographical comparison (nodeKey < target < nodeNext)
        // This precisely matches Aiken's less_than_bytearray behavior for hex strings
        const isGreater = datum.key === "" || stakingPkh > datum.key;
        const isLess = datum.next === "" || stakingPkh < datum.next;
        return isGreater && isLess;
      });

      if (!proofUtxo) {
        throw new Error(
          `Blacklist proof not found for wallet ${stakingPkh}. Scanned ${blacklistUtxos.length} nodes at policy ${blacklistNodePolicyId}.`,
        );
      }
      blacklistProofs.push(proofUtxo);
    }
  }

  // 3. Resolve Registry proofs (one per unique policy ID, in sorted order)
  const registryProofs: UTxO[] = [];
  const registryUtxos = await provider.fetchAddressUTxOs(registrySpend.address);
  for (const p of uniquePolicies) {
    const registryNft = params.directoryMintParams.scriptHash + p;
    const proofUtxo = registryUtxos.find((u) =>
      u.output.amount.find((a) => a.unit === registryNft),
    );
    if (!proofUtxo) throw new Error(`Registry node not found for policy ${p}`);
    registryProofs.push(proofUtxo);
  }

  // 4. Build Sorted Reference Inputs (deduplicate if same node covers multiple inputs)
  const uniqueBlacklistProofs = [
    ...new Map(
      blacklistProofs.map((p) => [
        `${p.input.txHash}#${p.input.outputIndex}`,
        p,
      ]),
    ).values(),
  ];

  const sortedRefInputs = [
    ...uniqueBlacklistProofs,
    ...registryProofs,
    protocolParamsUtxo,
  ].sort(compareUtxos);

  // 5. Build Redeemers
  // SUBSTANDARD: One proof per input UTXO (len = programmableInputs.length)
  const substandardTransferRedeemer = list(
    blacklistProofs.map((p) => {
      const idx = sortedRefInputs.findIndex(
        (r) =>
          r.input.txHash === p.input.txHash &&
          r.input.outputIndex === p.input.outputIndex,
      );
      return conStr0([integer(idx)]);
    }),
  );

  // GLOBAL: One proof per unique Policy ID (len = uniquePolicies.length)
  const programmableGlobalRedeemer = conStr0([
    list(
      registryProofs.map((p) => {
        const idx = sortedRefInputs.findIndex(
          (r) =>
            r.input.txHash === p.input.txHash &&
            r.input.outputIndex === p.input.outputIndex,
        );
        return conStr0([integer(idx)]);
      }),
    ),
  ]);

  // Compute asset amounts
  const totalTokens = selectedUtxos.reduce(
    (sum, utxo) =>
      sum +
      BigInt(utxo.output.amount.find((a) => a.unit === unit)?.quantity ?? "0"),
    0n,
  );
  const totalLovelace = selectedUtxos.reduce(
    (sum, utxo) =>
      sum +
      BigInt(
        utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0",
      ),
    0n,
  );

  if (totalTokens < BigInt(quantity)) throw new Error("Not enough funds");

  // Output Balance Calculation ("ADA Recycling")
  const recipientLovelace = 1500000n;
  const remainingTokens = totalTokens - BigInt(quantity);

  // Send the tokens and their ADA to the recipient
  const recipientAssets = [
    { unit: "lovelace", quantity: recipientLovelace.toString() },
    { unit: unit, quantity: quantity },
  ];

  // Send the remaining tokens and the "recycled" ADA back to the sender
  // We subtract the ADA we just sent to the recipient from the input total
  const remainingLovelace = totalLovelace - recipientLovelace;
  const returningAssets = [
    {
      unit: "lovelace",
      quantity: (remainingLovelace > 1_000_000n
        ? remainingLovelace
        : 1_500_000n
      ).toString(),
    },
    ...(remainingTokens > 0n
      ? [{ unit: unit, quantity: remainingTokens.toString() }]
      : []),
  ];
  console.log(senderCredential);

  // Build TX
  const tx = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
    verbose: true,
  });

  // Use the sorted inputs to ensure alignment with ledger canonical order
  for (const utxo of sortedInputs) {
    tx.spendingPlutusScriptV3()
      .txIn(utxo.input.txHash, utxo.input.outputIndex)
      .txInScript(programmableLogicBase.cbor)
      .txInRedeemerValue(conStr0([]), "JSON")
      .txInInlineDatumPresent();
  }

  // Withdrawals: Substandard (Proof) -> Global (Coordinator)
  tx.withdrawalPlutusScriptV3()
    .withdrawal(substandardTransfer.rewardAddress, "0")
    .withdrawalScript(substandardTransferCbor)
    .withdrawalRedeemerValue(substandardTransferRedeemer, "JSON")

    .withdrawalPlutusScriptV3()
    .withdrawal(programmableLogicGlobal.rewardAddress, "0")
    .withdrawalScript(programmableLogicGlobal.cbor)
    .withdrawalRedeemerValue(programmableGlobalRedeemer, "JSON");

  // Add outputs (Sender change then Recipient)
  if (remainingTokens > 0n || remainingLovelace > 1_000_000n) {
    tx.txOut(senderSmartWallet, returningAssets).txOutInlineDatumValue(
      conStr0([]),
      "JSON",
    );
  }

  tx.txOut(recipientSmartWallet, recipientAssets).txOutInlineDatumValue(
    conStr0([]),
    "JSON",
  );

  // Reference Inputs (sorted protocol + registry + proofs)
  for (const refInput of sortedRefInputs) {
    tx.readOnlyTxInReference(refInput.input.txHash, refInput.input.outputIndex);
  }

  tx.requiredSignerHash(senderCredential)
    .setFee("600000")
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress);

  return await tx.complete();
};
