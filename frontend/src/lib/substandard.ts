import BlacklistBootstrapJson from "../../../offchain/blacklist.json";
import { BlacklistBootstrap } from "../../../offchain/types";

const blacklistBootstrap =
  BlacklistBootstrapJson as unknown as BlacklistBootstrap;

export const substandardConfig = {
  issuerAdminPkh: blacklistBootstrap.blacklistMintBootstrap.adminPubKeyHash,
  blacklistNodePolicyId: blacklistBootstrap.blacklistMintBootstrap.scriptHash,
};

