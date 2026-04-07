import {
  Asset,
  byteString,
  conStr0,
  MeshTxBuilder,
  IWallet,
  stringToHex,
  deserializeAddress,
} from "@meshsdk/core";

import { provider } from "../../../config";
import { SubStandardScripts } from "../../deployment/subStandard";
import { BlacklistBootstrap, ProtocolBootstrapParams } from "../../types";
import { walletConfig } from "../../utils";
import { StandardScripts } from "../../deployment/standard";

export const registerBlacklist = async (
  params: ProtocolBootstrapParams,
  wallet: IWallet,
  NetworkId: 0 | 1,
): Promise<{ unsignedTx: string; bootstrap: BlacklistBootstrap }> => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);
  const adminAddress = changeAddress;

  const utilityUtxos = walletUtxos.filter((utxo) => {
    const hasOnlyAda =
      utxo.output.amount.length === 1 &&
      utxo.output.amount[0].unit === "lovelace";
    const hasEnoughAda = Number(utxo.output.amount[0].quantity) >= 10_000_000;
    return hasOnlyAda && hasEnoughAda;
  });

  if (utilityUtxos.length === 0) {
    throw new Error("No suitable UTxOs found for bootstrap");
  }

  const bootstrapInput = utilityUtxos[0].input;

  const adminAddr = deserializeAddress(adminAddress);
  const adminPubKeyHash = adminAddr.pubKeyHash;

  const standardScript = new StandardScripts(NetworkId);
  const substandardScript = new SubStandardScripts(NetworkId);
  const blacklistMint = await substandardScript.blacklistMint(
    bootstrapInput,
    adminPubKeyHash,
  );
  const blacklistMintPolicyId = blacklistMint.policyId;
  const blacklistSpend = await substandardScript.blacklistSpend(
    blacklistMintPolicyId,
  );
  const blacklistSpendAddress = blacklistSpend.address;
  const substandardIssueAddress = (
    await substandardScript.issuerAdmin(adminPubKeyHash)
  ).rewardAddress;
  console.log(substandardIssueAddress)
  const programmableLogicbasePolicyId = (
    await standardScript.programmableLogicBase(params)
  ).policyId;
  const substandardTransferAddress = (
    await substandardScript.customTransfer(
      programmableLogicbasePolicyId,
      blacklistMintPolicyId,
    )
  ).rewardAddress;

  const blacklistInitDatum = conStr0([
    byteString(""),
    byteString("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
  ]);

  const blacklistAssets: Asset[] = [
    {
      unit: blacklistMintPolicyId,
      quantity: "1",
    },
  ];

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator: provider,
  });

  const unsignedTx = await txBuilder
    .txIn(bootstrapInput.txHash, bootstrapInput.outputIndex)
    .mintPlutusScriptV3()
    .mint("1", blacklistMintPolicyId, stringToHex(""))
    .mintingScript(blacklistMint.cbor)
    .mintRedeemerValue(conStr0([]), "JSON")

    .txOut(blacklistSpendAddress, blacklistAssets)
    .txOutInlineDatumValue(blacklistInitDatum, "JSON")

    .registerStakeCertificate(substandardIssueAddress)
    .registerStakeCertificate(substandardTransferAddress)

    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .selectUtxosFrom(utilityUtxos)
    .changeAddress(changeAddress)
    .complete();

  const bootstrap: BlacklistBootstrap = {
    blacklistMintBootstrap: {
      txInput: bootstrapInput,
      adminPubKeyHash: adminPubKeyHash,
      scriptHash: blacklistMintPolicyId,
    },
    blacklistSpendBootstrap: {
      blacklistMintScriptHash: blacklistMintPolicyId,
      scriptHash: blacklistSpend.policyId,
    },
  };

  return { unsignedTx, bootstrap };
};
