import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  integer,
  MeshTxBuilder,
  stringToHex,
  IWallet,
} from "@meshsdk/core";

import { Cip113_scripts_standard } from "../../deployment/standard";
import cip113_scripts_subStandard from "../../deployment/type1/subStandard";
import { ProtocolBootstrapParams } from "../../types";
import { getSmartWallet } from "../../utils";
import { provider } from "../../../config";

const mint_programmable_tokens = async (
  params: ProtocolBootstrapParams,
  assetName: string,
  quantity: string,
  wallet: IWallet,
  Network_id: 0 | 1,
  recipientAddress?: string | null,
) => {
  const changeAddress = await wallet.getChangeAddress();
  const walletUtxos = await wallet.getUtxos();
  const collateral = (await wallet.getCollateral())[0];

  if (!collateral) {
    throw new Error("No collateral available");
  }

  if (!walletUtxos) {
    throw new Error("Issuer wallet is empty");
  }

  const standardScript = new Cip113_scripts_standard(Network_id);
  const substandardScript = new cip113_scripts_subStandard(Network_id);

  const substandard_issue = await substandardScript.transfer_issue_withdraw();

  if (!substandard_issue.address) {
    throw new Error("Substandard issuance address not found");
  }

  const issuance_mint = await standardScript.issuance_mint(
    substandard_issue.policy_id,
    params,
  );
  const address = await getSmartWallet(
    recipientAddress ? recipientAddress : changeAddress,
    params,
    (Network_id = 0),
  );

  const issuanceRedeemer = conStr0([
    conStr1([byteString(substandard_issue.policy_id)]),
  ]);

  const programmableTokenAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    {
      unit: issuance_mint.policy_id + stringToHex(assetName),
      quantity: quantity,
    },
  ];

  const programmableTokenDatum = conStr0([]);

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
  });
  const unsignedTx = await txBuilder
    .withdrawalPlutusScriptV3()
    .withdrawal(substandard_issue.address, "0")
    .withdrawalScript(substandard_issue._cbor)
    .withdrawalRedeemerValue(integer(100), "JSON")

    .mintPlutusScriptV3()
    .mint(quantity, issuance_mint.policy_id, stringToHex(assetName))
    .mintingScript(issuance_mint.cbor)
    .mintRedeemerValue(issuanceRedeemer, "JSON")

    .txOut(address, programmableTokenAssets)
    .txOutInlineDatumValue(programmableTokenDatum, "JSON")

    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .selectUtxosFrom(walletUtxos)
    .setNetwork("preview")
    .changeAddress(changeAddress)
    .complete();

  return unsignedTx;
};

export { mint_programmable_tokens };
