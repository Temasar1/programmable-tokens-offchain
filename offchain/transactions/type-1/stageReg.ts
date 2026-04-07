import { MeshTxBuilder } from "@meshsdk/core";

import { provider, wallet } from "../../../config";
import { SubStandardScripts } from "../../deployment/subStandard";
import { StandardScripts } from "../../deployment/standard";
import { walletConfig } from "../../utils";
import { ProtocolBootstrapParams } from "../../types";

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

export const RegisterTransfer = async (NetworkId: 0 | 1, params: ProtocolBootstrapParams, blacklistNodePolicyId: string) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);

  const substandardScript = new SubStandardScripts(NetworkId);
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const standard = new StandardScripts(NetworkId);
  const substandard = new SubStandardScripts(NetworkId);
  const programmableLogicGlobal = await standard.programmableLogicGlobal(params);
  const substandardTransfer = await substandard.customTransfer(
    params.programmableLogicBaseParams.scriptHash,
    blacklistNodePolicyId,
  );

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
