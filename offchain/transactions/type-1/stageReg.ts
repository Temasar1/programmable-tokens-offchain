import { MeshTxBuilder } from "@meshsdk/core";

import { provider, wallet } from "../../../config";
import { SubStandardScripts } from "../../deployment/subStandard";
import { walletConfig } from "../../utils";

export const RegisterIssue = async (NetworkId: 0 | 1) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);
  const substandardScript = new SubStandardScripts(NetworkId);
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const substandardIssue = await substandardScript.issue();

  const unsignedTx = await txBuilder
    .registerStakeCertificate(substandardIssue.rewardAddress)
    .selectUtxosFrom(walletUtxos)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .changeAddress(changeAddress)
    .complete();

  const signedTx = await wallet.signTx(unsignedTx);
  return await wallet.submitTx(signedTx);
};

export const RegisterTransfer = async (NetworkId: 0 | 1) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const substandardScript = new SubStandardScripts(NetworkId);
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const substandardTransfer = await substandardScript.transfer();

  const unsignedTx = await txBuilder
    .registerStakeCertificate(substandardTransfer.rewardAddress)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
    .selectUtxosFrom(walletUtxos)
    .changeAddress(changeAddress)
    .complete();

  const signedTx = await wallet.signTx(unsignedTx);
  return await wallet.submitTx(signedTx);
};
