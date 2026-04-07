import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  MeshTxBuilder,
  stringToHex,
  IWallet,
  deserializeAddress,
} from "@meshsdk/core";

import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";
import { getSmartWalletAddress, walletConfig } from "../../utils";
import { provider } from "../../../config";

export const mintProgrammableTokens = async (
  params: ProtocolBootstrapParams,
  assetName: string,
  quantity: string,
  wallet: IWallet,
  NetworkId: 0 | 1,
  recipientAddress?: string | null,
) => {
  const { changeAddress, walletUtxos, collateral } = await walletConfig(wallet);
  const standardScript = new StandardScripts(NetworkId);
  const substandardScript = new SubStandardScripts(NetworkId);
  const bootstrapTxHash = params.txHash;

  const adminPubKeyHash = deserializeAddress(changeAddress).pubKeyHash;

  const issuanceUtxos = await provider.fetchUTxOs(bootstrapTxHash, 2);
  if (!issuanceUtxos?.length) throw new Error("Issuance UTXO not found");

  const substandardIssue = await substandardScript.issuerAdmin(adminPubKeyHash);
  const substandardIssueCbor = substandardIssue.cbor;
  const substandardPolicyId = substandardIssue.policyId;

  const issuanceMint = await standardScript.issuanceMint(
    substandardPolicyId,
    params,
  );
  const smartWalletAddress = await getSmartWalletAddress(
    recipientAddress ? recipientAddress : changeAddress,
    params,
    NetworkId,
  );

  const issuanceRedeemer = conStr0([
    conStr1([byteString(substandardPolicyId)]),
  ]);

  const programmableTokenAssets: Asset[] = [
    {
      unit: "lovelace",
      quantity: "1300000",
    },
    {
      unit: issuanceMint.policyId + stringToHex(assetName),
      quantity: quantity,
    },
  ];

  const programmableTokenDatum = conStr0([]);

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });
  txBuilder.txEvaluationMultiplier = 1.3;
  txBuilder
    .withdrawalPlutusScriptV3()
    .withdrawal(substandardIssue.rewardAddress, "0")
    .withdrawalScript(substandardIssueCbor)
    .withdrawalRedeemerValue(conStr0([]), "JSON")

    .mintPlutusScriptV3()
    .mint(quantity, issuanceMint.policyId, stringToHex(assetName))
    .mintingScript(issuanceMint.cbor)
    .mintRedeemerValue(issuanceRedeemer, "JSON")

    .txOut(smartWalletAddress, programmableTokenAssets)
    .txOutInlineDatumValue(programmableTokenDatum, "JSON")

    .requiredSignerHash(adminPubKeyHash)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork(NetworkId === 0 ? "preview" : "mainnet")
  return await txBuilder.complete();
};
