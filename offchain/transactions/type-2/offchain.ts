import { IFetcher, IWallet } from "@meshsdk/core";

import {
  mintProgrammableTokens,
  registerProgrammableToken,
  transferProgrammableToken,
  MintProtocolParams,
  registerBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  seizeProgrammableTokens,
} from "../type-1";

import {
  BlacklistBootstrap,
  ProtocolBootstrapParams,
} from "../../types";
import { ISubmitter } from "@meshsdk/core";
import { IEvaluator } from "@meshsdk/core";
import { burnProgrammableTokens } from "../type-1/burn";

export interface ProgrammableTokenContractInput {
  wallet: IWallet;
  provider: IFetcher | ISubmitter | IEvaluator;
  params: ProtocolBootstrapParams;
  blacklistParam: BlacklistBootstrap;
  networkId?: 0 | 1;
}

export class ProgrammableTokenContract {
  private wallet: IWallet;
  params: ProtocolBootstrapParams;
  networkId: 0 | 1;
  blacklistParam: BlacklistBootstrap;

  constructor(inputs: ProgrammableTokenContractInput) {
    this.wallet = inputs.wallet;
    this.params = inputs.params;
    this.networkId = inputs.networkId || 0;
    this.blacklistParam = inputs.blacklistParam;
  }

  protocolParamMint = async (): Promise<ProtocolBootstrapParams | null> => {
    const params = await MintProtocolParams(this.networkId);
    return params;
  };

  registerToken = async (assetName: string, quantity: string) => {
    const unsignedTx = await registerProgrammableToken(
      assetName,
      quantity,
      this.params,
      this.wallet,
      this.networkId,
      this.blacklistParam,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  mintTokens = async (assetName: string, quantity: string): Promise<string> => {
    const unsignedTx = await mintProgrammableTokens(
      this.params,
      assetName,
      quantity,
      this.wallet,
      this.networkId,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  transferToken = async (
    unit: string,
    quantity: string,
    recipientAddress: string,
  ): Promise<string> => {
    const unsignedTx = await transferProgrammableToken(
      unit,
      quantity,
      recipientAddress,
      this.params,
      this.networkId,
      this.wallet,
      this.blacklistParam.blacklistMintBootstrap.scriptHash,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  burnToken = async (
    policyId: string,
    assetName: string,
    quantity: string,
    txhash: string,
    outputIndex: number,
    issuerAdminPkh: string,
  ): Promise<string> => {
    const unsignedTx = await burnProgrammableTokens({
      wallet: this.wallet,
      params: this.params,
      tokenPolicyId: policyId,
      assetName: assetName,
      quantity: quantity,
      txhash,
      outputIndex,
      issuerAdminPkh,
      networkId: this.networkId,
    });
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  registerBlacklist = async () => {
    const { unsignedTx, bootstrap } = await registerBlacklist(
      this.params,
      this.wallet,
      this.networkId,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return { txHash, bootstrap };
  };

  addBlacklist = async (targetAddress: string): Promise<string> => {
    const unsignedTx = await addToBlacklist(
      this.blacklistParam,
      targetAddress,
      this.wallet,
      this.networkId,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  removeBlacklist = async (targetAddress: string): Promise<string> => {
    const unsignedTx = await removeFromBlacklist(
      targetAddress,
      this.blacklistParam,
      this.wallet,
      this.networkId,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  seizeTokens = async (
    unit: string,
    utxoTxHash: string,
    utxoOutputIndex: number,
    targetAddress: string,
    issuerAdminPkh: string,
  ): Promise<string> => {
    const unsignedTx = await seizeProgrammableTokens(
      unit,
      utxoTxHash,
      utxoOutputIndex,
      targetAddress,
      issuerAdminPkh,
      this.params,
      this.networkId,
      this.wallet,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };
}
