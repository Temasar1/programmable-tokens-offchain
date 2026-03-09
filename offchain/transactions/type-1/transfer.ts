import {
  conStr0,
  deserializeDatum,
  integer,
  list,
  MeshTxBuilder,
  POLICY_ID_LENGTH,
  UTxO,
  IWallet,
} from "@meshsdk/core";
import { deserializeAddress } from "@meshsdk/core-cst";

import { provider } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";
import {
  getSmartWalletAddress,
  parseBlacklistDatum,
  parseRegistryDatum,
  selectEnoughAdaUtxos,
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
  blacklistNodePolicyId?: string | null,
) => {
  const policyId = unit.substring(0, POLICY_ID_LENGTH);
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const standard = new StandardScripts(NetworkId);
  const substandard = new SubStandardScripts(NetworkId);

  const programmableLogicBase = await standard.programmableLogicBase(params);
  const programmableLogicGlobal =
    await standard.programmableLogicGlobal(params);
  const registrySpend = await standard.registrySpend(params);
  const substandardTransfer = blacklistNodePolicyId
    ? await substandard.customTransfer(
        params.programmableLogicBaseParams.scriptHash,
        blacklistNodePolicyId,
      )
    : await substandard.transfer();
  const substandardTransferCbor =
    "cbor" in substandardTransfer
      ? substandardTransfer.cbor
      : substandardTransfer._cbor;

  const senderCredential = deserializeAddress(changeAddress)
    .asBase()
    ?.getStakeCredential().hash;
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
  const registryUtxos = await provider.fetchAddressUTxOs(registrySpend.address);
  const progTokenRegistry = registryUtxos.find((utxo: UTxO) => {
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

  const adminUtxos = await selectEnoughAdaUtxos(wallet);
  if (!adminUtxos.length) throw new Error("No admin UTxOs found for fees");

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
  const sortedInputs = [...adminUtxos, ...selectedUtxos].sort(compareUtxos);

  // Build blacklist proofs — one per prog token input, ordered by sorted input position
  const proofs: { spendUtxo: UTxO; proofUtxo: UTxO }[] = [];
  if (blacklistNodePolicyId) {
    const blacklistSpend = await substandard.blacklistSpend(
      blacklistNodePolicyId,
    );
    const blacklistUtxos = await provider.fetchAddressUTxOs(
      blacklistSpend.address,
    );

    for (const utxo of sortedInputs) {
      const paymentCred = deserializeAddress(utxo.output.address)
        .asBase()
        ?.getPaymentCredential().hash;
      if (paymentCred !== programmableLogicBase.policyId) continue;

      const stakingPkh = deserializeAddress(utxo.output.address)
        .asBase()
        ?.getStakeCredential().hash;
      if (!stakingPkh)
        throw new Error("Could not resolve stake credential for sender UTxO");

      const proofUtxo = blacklistUtxos.find((bl: UTxO) => {
        if (!bl.output.plutusData) return false;
        const datum = parseBlacklistDatum(
          deserializeDatum(bl.output.plutusData),
        );
        return (
          datum &&
          datum.key.localeCompare(stakingPkh) < 0 &&
          stakingPkh.localeCompare(datum.next) < 0
        );
      });
      if (!proofUtxo)
        throw new Error("Could not resolve blacklist exemption proof");

      proofs.push({ spendUtxo: utxo, proofUtxo });
    }
  }

  // Deduplicate proof UTxOs for reference inputs
  const uniqueProofUtxos = [
    ...new Map(
      proofs.map((p) => [
        `${p.proofUtxo.input.txHash}#${p.proofUtxo.input.outputIndex}`,
        p.proofUtxo,
      ]),
    ).values(),
  ];

  const sortedRefInputs = [
    ...uniqueProofUtxos,
    protocolParamsUtxo,
    progTokenRegistry,
  ].sort(compareUtxos);

  const registryRefInputIndex = sortedRefInputs.findIndex(
    (r) =>
      r.input.txHash === progTokenRegistry.input.txHash &&
      r.input.outputIndex === progTokenRegistry.input.outputIndex,
  );
  if (registryRefInputIndex === -1)
    throw new Error("Could not find registry reference input index");

  // Substandard transfer redeemer: one proof-index entry per prog token spending input (ordered)
  const substandardTransferRedeemer = blacklistNodePolicyId
    ? list(
        proofs.map(({ proofUtxo }) => {
          const idx = sortedRefInputs.findIndex(
            (r) =>
              r.input.txHash === proofUtxo.input.txHash &&
              r.input.outputIndex === proofUtxo.input.outputIndex,
          );
          if (idx === -1)
            throw new Error(
              "Could not resolve blacklist proof reference index",
            );
          return conStr0([integer(idx)]);
        }),
      )
    : integer(200);

  const programmableGlobalRedeemer = conStr0([
    list([conStr0([integer(registryRefInputIndex)])]),
  ]);

  // Compute return value: sum selected UTxOs, subtract transfer amount
  const totalTokenAmount = selectedUtxos.reduce((sum, utxo) => {
    return (
      sum +
      BigInt(utxo.output.amount.find((a) => a.unit === unit)?.quantity ?? "0")
    );
  }, 0n);
  const totalLovelace = selectedUtxos.reduce((sum, utxo) => {
    return (
      sum +
      BigInt(
        utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity ?? "0",
      )
    );
  }, 0n);

  if (totalTokenAmount < BigInt(quantity)) throw new Error("Not enough funds");

  const remainingTokens = totalTokenAmount - BigInt(quantity);
  const returningAssets = [
    {
      unit: "lovelace",
      quantity: (totalLovelace > 0n ? totalLovelace : 1500000n).toString(),
    },
    ...(remainingTokens > 0n
      ? [{ unit: unit, quantity: remainingTokens.toString() }]
      : []),
  ];
  const recipientAssets = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: unit, quantity: quantity },
  ];

  // Build TX
  const tx = new MeshTxBuilder({ fetcher: provider, evaluator: provider });

  for (const utxo of adminUtxos) {
    tx.txIn(utxo.input.txHash, utxo.input.outputIndex);
  }

  for (const utxo of selectedUtxos) {
    tx.spendingPlutusScriptV3()
      .txIn(utxo.input.txHash, utxo.input.outputIndex)
      .txInScript(programmableLogicBase.cbor)
      .txInRedeemerValue(conStr0([]), "JSON")
      .txInInlineDatumPresent();
  }

  // Substandard (proofs) must withdraw before global
  tx.withdrawalPlutusScriptV3()
    .withdrawal(substandardTransfer.rewardAddress, "0")
    .withdrawalScript(substandardTransferCbor)
    .withdrawalRedeemerValue(substandardTransferRedeemer, "JSON")

    .withdrawalPlutusScriptV3()
    .withdrawal(programmableLogicGlobal.rewardAddress, "0")
    .withdrawalScript(programmableLogicGlobal.cbor)
    .withdrawalRedeemerValue(programmableGlobalRedeemer, "JSON");

  if (remainingTokens > 0n) {
    tx.txOut(senderSmartWallet, returningAssets).txOutInlineDatumValue(
      conStr0([]),
      "JSON",
    );
  }

  tx.txOut(recipientSmartWallet, recipientAssets).txOutInlineDatumValue(
    conStr0([]),
    "JSON",
  );

  for (const refInput of sortedRefInputs) {
    tx.readOnlyTxInReference(refInput.input.txHash, refInput.input.outputIndex);
  }

  tx.requiredSignerHash(senderCredential)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress);

  return tx.complete();
};
