import { IFetcher, IWallet } from "@meshsdk/core";

import {
  mintProgrammableTokens,
  registerProgrammableToken,
  transferProgrammableToken,
} from "../type-1";

import { ProtocolBootstrapParams } from "../../types";
import { ISubmitter } from "@meshsdk/core";
import { IEvaluator } from "@meshsdk/core";
import { burnProgrammableTokens } from "../type-1/burn";

export interface ProgrammableTokenContractInput {
  wallet: IWallet;
  provider: IFetcher | ISubmitter | IEvaluator;
  params: ProtocolBootstrapParams;
  networkId?: 0 | 1;
}

export class ProgrammableTokenContract {
  private wallet: IWallet;
  params: ProtocolBootstrapParams;
  networkId: 0 | 1;

  constructor(inputs: ProgrammableTokenContractInput) {
    this.wallet = inputs.wallet;
    this.params = inputs.params;
    this.networkId = inputs.networkId || 0;
  }

  registerToken = async (
    assetName: string,
    quantity: string,
    issuerAdminPkh: string,
    blacklistNodePolicyId: string,
    recipientAddress?: string | null,
  ): Promise<string> => {
    const unsignedTx = await registerProgrammableToken(
      assetName,
      quantity,
      this.params,
      this.wallet,
      this.networkId,
      issuerAdminPkh,
      blacklistNodePolicyId,
      recipientAddress,
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
}
