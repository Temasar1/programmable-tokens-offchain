import { MeshTxBuilder, IWallet } from "@meshsdk/core";
import { ProgrammableTokenContract, BlacklistBootstrap } from "@meshsdk/contract";
import blacklistData from "../../../offchain/blacklist.json";
import provider from "./provider";

export const getContract = (wallet?: IWallet) => {
  const mesh = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    evaluator: provider,
  });

  return new ProgrammableTokenContract(
    {
      mesh,
      fetcher: provider,
      wallet,
      networkId: 0,
    },
    blacklistData as unknown as BlacklistBootstrap
  );
};
