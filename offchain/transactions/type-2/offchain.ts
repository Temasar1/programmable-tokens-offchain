import { IFetcher, IWallet } from "@meshsdk/core";

import {
  mint_programmable_tokens,
  register_programmable_token,
  transfer_programmable_token,
} from "../type-1";

import { ProtocolBootstrapParams } from "../../types";
import { ISubmitter } from "@meshsdk/core";
import { IEvaluator } from "@meshsdk/core";

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

  getWallet() {
    return this.wallet;
  }

  registerToken = async (
    assetName: string,
    quantity: string,
  ): Promise<string> => {
    const unsignedTx = await register_programmable_token(
      assetName,
      quantity,
      this.params,
      "issuance",
      this.wallet,
      this.networkId,
    );
    const signedTx = await this.wallet.signTx(unsignedTx);
    const txHash = await this.wallet.submitTx(signedTx);
    return txHash;
  };

  mintTokens = async (assetName: string, quantity: string): Promise<string> => {
    const unsignedTx = await mint_programmable_tokens(
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
    const unsignedTx = await transfer_programmable_token(
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
}
