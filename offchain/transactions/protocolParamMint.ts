import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  conStr2,
  IWallet,
  MeshTxBuilder,
  none,
  stringToHex,
} from "@meshsdk/core";

import { provider, wallet } from "../../config";
import { Cip113_scripts_standard } from "../deployment/standard";
import cip113_scripts_subStandard from "../deployment/subStandard";
import { ProtocolBootstrapParams } from "../types";
import { deserializeAddress } from "@meshsdk/core-cst";

/**
 * Bootstrap the CIP-113 protocol
 * This creates all the core contracts and initializes the protocol state
 */
export async function bootstrapProtocol(
  networkId: 0 | 1
): Promise<ProtocolBootstrapParams> {
  const changeAddress = await wallet.getChangeAddress();
  let walletUtxos = await wallet.getUtxos();
  const collateral = (await wallet.getCollateral())[0];
  const unusedAddress = (await wallet.getUnusedAddresses())[0];

  const refInputAddress = deserializeAddress(unusedAddress)
    .asBase()
    ?.toAddress()
    .toBech32();
  const txhashh = await provider.fetchUTxOs(
    "50dcbf81b36a741d683f3707a507875f78002ba67f55d882f0286b9795fa40fa"
  );

  const utxo1 = txhashh[0];
  const utxo2 = txhashh[2];

  const standard = new Cip113_scripts_standard(networkId);
  const subStandard = new cip113_scripts_subStandard(networkId);
  const protocolParamMint = await standard.protocol_param_mint(utxo1.input);
  const logicGlobal = await standard.programmable_logic_global(
    protocolParamMint.script_hash
  );
  const logicBase = await standard.programmable_logic_base(
    logicGlobal.script_hash
  );
  const issuanceCborHex = await standard.issuance_cbor_hex_mint(utxo2.input);
  const registryMint = await standard.registry_mint(
    issuanceCborHex.policy_id,
    utxo1.input
  );
  const registrySpend = await standard.registry_spend(
    protocolParamMint.script_hash
  );
  const transferSubstandard = await subStandard.transfer_transfer_withdraw();
  const issuanceMint = await standard.issuance_mint(
    transferSubstandard.policy_id,
    logicBase.policyId
  );

  const protocolParamNftName = stringToHex("ProtocolParams");
  const issuanceNftName = stringToHex("IssuanceCborHex");

  const protocolParamsDatum = conStr0([
    byteString(registryMint.policy_id),
    conStr1([byteString(logicBase.policyId)]),
  ]);

  const directoryDatum = conStr0([
    byteString(""), // Empty bytestring
    byteString("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // Already hex
    conStr0([byteString("")]),
    conStr0([byteString("")]),
    byteString(""),
  ]);

  const protocolParamsAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    {
      unit: protocolParamMint.script_hash + protocolParamNftName,
      quantity: "1",
    },
  ];
  const directoryAssets: Asset[] = [
    { unit: "lovelace", quantity: "1500000" },
    { unit: registryMint.policy_id, quantity: "1" },
  ];
  const issuanceAssets: Asset[] = [
    { unit: "lovelace", quantity: "6500000" },
    { unit: issuanceCborHex.policy_id + issuanceNftName, quantity: "1" },
  ];

  const contractParts = issuanceMint.cbor.split(transferSubstandard.policy_id);

  if (contractParts.length !== 2) {
    throw new Error("Failed to split issuance contract template");
  }

  const issuanceDatum = conStr0([
    byteString(contractParts[0]),
    byteString(contractParts[1]),
  ]);

  console.log(issuanceDatum);

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    evaluator: provider,
    verbose: true,
  });

  txBuilder
    .txIn(utxo1.input.txHash, utxo1.input.outputIndex)
    .txIn(utxo2.input.txHash, utxo2.input.outputIndex)

    .mintPlutusScriptV3()
    .mint("1", registryMint.policy_id, stringToHex(""))
    .mintingScript(registryMint.cbor)
    .mintRedeemerValue(conStr0([]), "JSON")

    // Protocol Params mint (Constr 1)
    .mintPlutusScriptV3()
    .mint("1", protocolParamMint.script_hash, protocolParamNftName)
    .mintingScript(protocolParamMint.cbor)
    .mintRedeemerValue(none(), "JSON")

    .mintPlutusScriptV3()
    .mint("1", issuanceCborHex.policy_id, issuanceNftName)
    .mintingScript(issuanceCborHex.cbor)
    .mintRedeemerValue(conStr2([]), "JSON")

    .txOut(protocolParamMint.address, protocolParamsAssets)
    .txOutInlineDatumValue(protocolParamsDatum, "JSON")

    .txOut(registrySpend.address, directoryAssets)
    .txOutInlineDatumValue(directoryDatum, "JSON")

    .txOut(issuanceCborHex.address, issuanceAssets)
    .txOutInlineDatumValue(issuanceDatum, "JSON")

    .txOut(refInputAddress!, [{ unit: "lovelace", quantity: "2500000" }])
    .txOutReferenceScript(logicBase.cbor, "V3")

    .txOut(refInputAddress!, [{ unit: "lovelace", quantity: "15500000" }])
    .txOutReferenceScript(logicGlobal.cbor, "V3")

    .txOut(changeAddress, [{ unit: "lovelace", quantity: "50000000" }])
    .txOut(changeAddress, [{ unit: "lovelace", quantity: "50000000" }])

    .selectUtxosFrom(walletUtxos)
    .changeAddress(changeAddress)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork(networkId === 0 ? "preview" : "mainnet");
  const unsignedTx = await txBuilder.complete();

  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await txBuilder.submitTx(signedTx);
  if (!txHash) throw new Error(`failed to build transaction`);

  return {
    txHash,
    protocolParams: {
      txInput: {
        txHash: utxo1.input.txHash,
        outputIndex: utxo1.input.outputIndex,
      },
      scriptHash: protocolParamMint.script_hash,
    },
    programmableLogicGlobalPrams: {
      protocolParamsScriptHash: protocolParamMint.script_hash,
      scriptHash: logicGlobal.script_hash,
    },
    programmableLogicBaseParams: {
      programmableLogicGlobalScriptHash: logicGlobal.script_hash,
      scriptHash: logicBase.policyId,
    },
    issuanceParams: {
      txInput: {
        txHash: utxo2.input.txHash,
        outputIndex: utxo2.input.outputIndex,
      },
      scriptHash: issuanceCborHex.policy_id,
    },
    directoryMintParams: {
      txInput: {
        txHash: utxo1.input.txHash,
        outputIndex: utxo1.input.outputIndex,
      },
      issuanceScriptHash: issuanceCborHex.policy_id,
      scriptHash: registryMint.policy_id,
    },
    directorySpendParams: {
      protocolParamsPolicyId: protocolParamMint.script_hash,
      scriptHash: registrySpend.policy_id,
    },
    programmableBaseRefInput: {
      txHash,
      outputIndex: 3,
    },
    programmableGlobalRefInput: {
      txHash,
      outputIndex: 4,
    },
  };
}

async function splitWallet(wallet: IWallet, address: string): Promise<string> {
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const walletUtxos = await wallet.getUtxos();

  const unsignedTx = await txBuilder
    .selectUtxosFrom(walletUtxos)
    .txOut(address, [{ unit: "lovelace", quantity: "5000000" }])
    .txOut(address, [{ unit: "lovelace", quantity: "5000000" }])
    .txOut(address, [{ unit: "lovelace", quantity: "5000000" }])
    .changeAddress(address)
    .complete();

  const signedTx = await wallet.signTx(unsignedTx);
  return wallet.submitTx(signedTx);
}

async function waitForUtxosWithTimeout(
  txHash: string,
  timeoutMs = 120_000, // 2 minutes
  intervalMs = 30_000 // 30 seconds
) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const utxos = await provider.fetchUTxOs(txHash);

    if (utxos && utxos.length > 0) {
      return utxos;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for UTxOs from tx ${txHash}`
  );
}
