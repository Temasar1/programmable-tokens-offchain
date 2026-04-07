import {
  byteString,
  conStr0,
  conStr2,
  deserializeDatum,
  MeshTxBuilder,
  stringToHex,
  IWallet,
  UTxO,
} from "@meshsdk/core";
import { deserializeAddress } from "@meshsdk/core-cst";

import { provider } from "../../../config";
import {
  buildBlacklistScripts,
  parseBlacklistDatum,
  selectEnoughAdaUtxos,
  walletConfig,
} from "../../utils";
import { BlacklistBootstrap, BlacklistDatum } from "../../types";

export const removeFromBlacklist = async (
  targetAddress: string,
  blacklistBootstrap: BlacklistBootstrap,
  wallet: IWallet,
  Network_id: 0 | 1,
): Promise<string> => {
  const { changeAddress, collateral } = await walletConfig(wallet);
  const adminUtxos = await selectEnoughAdaUtxos(wallet);

  if (adminUtxos.length === 0) {
    throw new Error("No admin UTxOs found");
  }

  const targetAddr = deserializeAddress(targetAddress);
  const credentialsToRemove = targetAddr.asBase()?.getStakeCredential().hash;
  if (!credentialsToRemove) {
    throw new Error("Target address must include a stake credential");
  }
  const { blacklistMint, blacklistSpend } = await buildBlacklistScripts(
    Network_id,
    blacklistBootstrap.blacklistMintBootstrap.txInput,
    blacklistBootstrap.blacklistMintBootstrap.adminPubKeyHash,
  );

  const blacklistUtxos = await provider.fetchAddressUTxOs(
    blacklistSpend.address,
  );

  if (!blacklistUtxos?.length) {
    throw new Error("No blacklist UTxOs found");
  }

  // Find node to remove (key == credentialsToRemove) and node to update (next == credentialsToRemove)
  let nodeToRemove: UTxO | null = null;
  let nodeToRemoveDatum: BlacklistDatum | null = null;
  let nodeToUpdate: UTxO | null = null;
  let nodeToUpdateDatum: BlacklistDatum | null = null;

  for (const utxo of blacklistUtxos) {
    if (!utxo.output.plutusData) continue;

    const datum: BlacklistDatum | null = parseBlacklistDatum(
      deserializeDatum(utxo.output.plutusData),
    );
    if (!datum) continue;

    if (datum.key === credentialsToRemove) {
      nodeToRemove = utxo;
      nodeToRemoveDatum = datum;
    }
    if (datum.next === credentialsToRemove) {
      nodeToUpdate = utxo;
      nodeToUpdateDatum = datum;
    }
    if (nodeToRemove && nodeToUpdate) break;
  }

  if (!nodeToRemove || !nodeToRemoveDatum) {
    throw new Error(
      "Could not resolve relevant blacklist nodes (node to remove)",
    );
  }

  if (!nodeToUpdate || !nodeToUpdateDatum) {
    throw new Error(
      "Could not resolve relevant blacklist nodes (node to update)",
    );
  }

  const newNext = nodeToRemoveDatum.next;
  const updatedNode = conStr0([
    byteString(nodeToUpdateDatum.key),
    byteString(newNext),
  ]);

  const mintRedeemer = conStr2([byteString(credentialsToRemove)]);
  const spendRedeemer = conStr0([]);

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
  });
  txBuilder.txEvaluationMultiplier = 1.3;

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(nodeToRemove.input.txHash, nodeToRemove.input.outputIndex)
    .txInScript(blacklistSpend.cbor)
    .txInInlineDatumPresent()
    .txInRedeemerValue(spendRedeemer, "JSON")

    .spendingPlutusScriptV3()
    .txIn(nodeToUpdate.input.txHash, nodeToUpdate.input.outputIndex)
    .txInScript(blacklistSpend.cbor)
    .txInInlineDatumPresent()
    .txInRedeemerValue(spendRedeemer, "JSON")

    .mintPlutusScriptV3()
    .mint("-1", blacklistMint.policyId, credentialsToRemove)
    .mintingScript(blacklistMint.cbor)
    .mintRedeemerValue(mintRedeemer, "JSON")

    .txOut(blacklistSpend.address, nodeToUpdate.output.amount)
    .txOutInlineDatumValue(updatedNode, "JSON")

    .requiredSignerHash(blacklistBootstrap.blacklistMintBootstrap.adminPubKeyHash)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(adminUtxos)
    .setNetwork(Network_id === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress)
    .complete();

  return unsignedTx;
};
