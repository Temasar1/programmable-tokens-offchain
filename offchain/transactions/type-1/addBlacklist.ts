import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  deserializeDatum,
  IWallet,
  MeshTxBuilder,
  stringToHex,
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
import { BlacklistBootstrap } from "../../types";

export const addToBlacklist = async (
  blacklistBootstrap: BlacklistBootstrap,
  targetAddress: string,
  wallet: IWallet,
  Network_id: 0 | 1,
): Promise<string> => {
  const { changeAddress, collateral } = await walletConfig(wallet);

  const adminUtxos = await selectEnoughAdaUtxos(wallet);
  if (adminUtxos.length === 0) throw new Error("Not enough ADA UTxOs found");

  const addressToBlacklist = deserializeAddress(targetAddress);
  const targetStakingPkh = addressToBlacklist
    .asBase()
    ?.getStakeCredential().hash;
  if (!targetStakingPkh) {
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

  let nodeToReplace: UTxO | null = null;
  let preexistingNode: { key: string; next: string } | null = null;

  for (const utxo of blacklistUtxos) {
    if (!utxo.output.plutusData) continue;

    const datum = parseBlacklistDatum(deserializeDatum(utxo.output.plutusData));
    if (!datum) continue;
    if (datum.key === targetStakingPkh) {
      throw new Error("Target address is already blacklisted");
    }

    if (
      datum.key.localeCompare(targetStakingPkh) < 0 &&
      targetStakingPkh.localeCompare(datum.next) < 0
    ) {
      nodeToReplace = utxo;
      preexistingNode = datum;
      break;
    }
  }

  if (!nodeToReplace || !preexistingNode) {
    throw new Error("Could not find blacklist node to replace");
  }

  const beforeNode = conStr0([
    byteString(preexistingNode.key),
    byteString(targetStakingPkh),
  ]);

  const afterNode = conStr0([
    byteString(targetStakingPkh),
    byteString(preexistingNode.next),
  ]);

  const mintRedeemer = conStr1([byteString(targetStakingPkh)]);
  const spendRedeemer = conStr0([]);

  const mintedAssets: Asset[] = [
    {
      unit: blacklistMint.policyId + targetStakingPkh,
      quantity: "1",
    },
  ];

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
  });

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(nodeToReplace.input.txHash, nodeToReplace.input.outputIndex)
    .txInScript(blacklistSpend.cbor)
    .txInRedeemerValue(spendRedeemer, "JSON")
    .txInInlineDatumPresent()

    .mintPlutusScriptV3()
    .mint("1", blacklistMint.policyId, stringToHex(targetStakingPkh))
    .mintingScript(blacklistMint.cbor)
    .mintRedeemerValue(mintRedeemer, "JSON")

    .txOut(blacklistSpend.address, nodeToReplace.output.amount)
    .txOutInlineDatumValue(beforeNode, "JSON")

    .txOut(blacklistSpend.address, mintedAssets)
    .txOutInlineDatumValue(afterNode, "JSON")

    .requiredSignerHash(
      blacklistBootstrap.blacklistMintBootstrap.adminPubKeyHash,
    )
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(adminUtxos)
    .setNetwork(Network_id === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress)
    .complete();

  return unsignedTx;
};
