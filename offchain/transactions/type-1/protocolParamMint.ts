import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  conStr2,
  deserializeAddress,
  IWallet,
  MeshTxBuilder,
  none,
  stringToHex,
  UTxO,
} from "@meshsdk/core";

import { provider, wallet } from "../../../config";
import { StandardScripts } from "../../deployment/standard";
import { SubStandardScripts } from "../../deployment/subStandard";
import { ProtocolBootstrapParams } from "../../types";

/**
 * Helper to extract the raw script body from a Mesh CBOR hex string.
 * This removes the CBOR byte string length headers (59XXXX or 58XX)
 * to match Bloxbean's serializeScriptBody() and Aiken's utils.ak reconstruction.
 */
function extractRawScript(cbor: string): string {
  if (cbor.startsWith("59")) {
    return cbor.slice(6); // Skip 59 [2-byte length]
  } else if (cbor.startsWith("58")) {
    return cbor.slice(4); // Skip 58 [1-byte length]
  }
  return cbor;
}

/**
 * Bootstrap the CIP-0143 protocol
 * This creates all the core contracts and initializes the protocol state.
 *
 * Requirements from Validators:
 * 1. protocol_params_mint: NFT must be sent to alwaysFail address with ProgrammableLogicGlobalParams datum.
 * 2. issuance_cbor_hex_mint: NFT must be sent to alwaysFail address with IssuanceCborHex datum.
 * 3. registry_mint: Origin NFT must be minted with RegistryInit redeemer and sent to registrySpend address.
 */
export async function MintProtocolParams(
  networkId: 0 | 1,
): Promise<ProtocolBootstrapParams | null> {
  const standard = new StandardScripts(networkId);
  const subStandard = new SubStandardScripts(networkId);

  // 1. Prepare Wallet and UTXOs
  const changeAddress = await wallet.getChangeAddress();
  const { pubKeyHash: adminPkh } = deserializeAddress(changeAddress);
  const walletUtxos = await wallet.getUtxos();
  const collateral = (await wallet.getCollateral())[0];
  if (!collateral) throw new Error("No collateral available");

  // We split the wallet to get dedicated one-shot UTXOs
  const splitTxHash = await splitWallet(wallet, networkId);
  console.log(`Splitting wallet for one-shot UTXOs: ${splitTxHash}`);
  const utxos = await waitForUtxosWithTimeout(splitTxHash);
  if (utxos.length < 2) throw new Error("Failed to get split UTXOs");
  const [utxo1, utxo2] = utxos;

  // 2. Build Scripts
  // Anchor: the always-fail validator used for reference NFT security
  const alwaysFailNonce = stringToHex("CIP-113");
  const alwaysFail = await standard.alwaysFail(alwaysFailNonce);

  // Thorough Check: Ensure scripts are correctly loaded
  if (!alwaysFail.scriptHash || alwaysFail.scriptHash.length !== 56) {
    throw new Error("Invalid alwaysFail script hash");
  }

  // Protocol Core
  const protocolParamMint = await standard.protocolParamMint(
    alwaysFail.scriptHash,
    utxo1.input,
  );
  const programmableLogicGlobal = await standard.programmableLogicGlobal(
    protocolParamMint.scriptHash,
  );
  const programmableLogicBase = await standard.programmableLogicBase(
    programmableLogicGlobal.scriptHash,
  );

  // Registry & Issuance
  const issuanceCborHex = await standard.issuanceCborHexMint(
    alwaysFail.scriptHash,
    utxo2.input,
  );
  const registryMint = await standard.registryMint(
    issuanceCborHex.policyId,
    utxo1.input,
  );
  const registrySpend = await standard.registrySpend(
    protocolParamMint.scriptHash,
  );

  // Templates
  const adminCredential = await subStandard.issuerAdmin(adminPkh!);
  // Audit Fix: Parameters for issuanceMint are [mintingLogicCredential, baseParams]
  // In the Aiken validator, order is: 1. Base, 2. Logic.
  // StandardScripts.ts applies [Base, Logic] where Base comes from 2nd argument and Logic from 1st.
  const issuanceMint = await standard.issuanceMint(
    adminCredential.policyId, // mintingLogicCredential (Logic)
    programmableLogicBase.policyId, // params (Base)
  );

  // 3. Prepare Datums
  // ProgrammableLogicGlobalParams
  const protocolParamsDatum = conStr0([
    byteString(registryMint.policyId),
    conStr1([byteString(programmableLogicBase.policyId)]),
  ]);

  // Registry Origin Node (Empty origin node)
  const registryOriginDatum = conStr0([
    byteString(""), // key
    byteString("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // next
    conStr0([byteString("")]), // transfer_logic_script (empty vkey)
    conStr0([byteString("")]), // third_party_transfer_logic_script (empty vkey)
    byteString(""), // global_state_cs
  ]);

  // Issuance CBOR Hex Template
  // We MUST strip the CBOR length header to get the raw script body.
  // This matches Bloxbean's serializeScriptBody() and enables on-chain hashing parity.
  const rawScript = extractRawScript(issuanceMint.cbor);

  const contractParts = rawScript.split(adminCredential.policyId);
  if (contractParts.length !== 2) {
    console.error("Raw Script Body:", rawScript);
    console.error("Splitting by Policy ID:", adminCredential.policyId);
    throw new Error("Failed to split issuance contract template");
  }

  console.log("Issuance Template Parts Extracted Successfully");
  console.log("Prefix Length:", contractParts[0].length / 2, "bytes");
  console.log("Postfix Length:", contractParts[1].length / 2, "bytes");

  const issuanceTemplateDatum = conStr0([
    byteString(contractParts[0]),
    byteString(contractParts[1]),
  ]);

  // 4. Build Transaction
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    evaluator: provider,
  });

  const protocolParamNftName = stringToHex("ProtocolParams");
  const issuanceNftName = stringToHex("IssuanceCborHex");
  const enterpriseAddress = (await wallet.getAddresses())
    .enterpriseAddressBech32!;

  await txBuilder
    .txIn(utxo1.input.txHash, utxo1.input.outputIndex)
    .txIn(utxo2.input.txHash, utxo2.input.outputIndex)

    // Mint Protocol Params NFT
    .mintPlutusScriptV3()
    .mint("1", protocolParamMint.scriptHash, protocolParamNftName)
    .mintingScript(protocolParamMint.cbor)
    .mintRedeemerValue(conStr0([]), "JSON")
    .txOut(alwaysFail.address, [
      { unit: "lovelace", quantity: "2000000" },
      {
        unit: protocolParamMint.scriptHash + protocolParamNftName,
        quantity: "1",
      },
    ])
    .txOutInlineDatumValue(protocolParamsDatum, "JSON")

    // Mint Registry Origin NFT
    .mintPlutusScriptV3()
    .mint("1", registryMint.policyId, "")
    .mintingScript(registryMint.cbor)
    .mintRedeemerValue(conStr0([]), "JSON") // RegistryInit
    .txOut(registrySpend.address, [
      { unit: "lovelace", quantity: "2000000" },
      { unit: registryMint.policyId, quantity: "1" },
    ])
    .txOutInlineDatumValue(registryOriginDatum, "JSON")

    // Mint Issuance Template NFT
    .mintPlutusScriptV3()
    .mint("1", issuanceCborHex.policyId, issuanceNftName)
    .mintingScript(issuanceCborHex.cbor)
    .mintRedeemerValue(conStr0([]), "JSON")
    .txOut(alwaysFail.address, [
      { unit: "lovelace", quantity: "80000000" },
      { unit: issuanceCborHex.policyId + issuanceNftName, quantity: "1" },
    ])
    .txOutInlineDatumValue(issuanceTemplateDatum, "JSON")

    // Deploy Reference Scripts
    .txOut(enterpriseAddress, [{ unit: "lovelace", quantity: "5000000" }])
    .txOutReferenceScript(programmableLogicBase.cbor, "V3")
    .txOut(enterpriseAddress, [{ unit: "lovelace", quantity: "15000000" }])
    .txOutReferenceScript(programmableLogicGlobal.cbor, "V3")
 
    // Mandatory: Register the Global Logic Reward Script
    .registerStakeCertificate(programmableLogicGlobal.rewardAddress)

    .changeAddress(changeAddress)
    .selectUtxosFrom(walletUtxos)
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .setNetwork(networkId === 0 ? "preview" : "mainnet")
    .complete();

  const signedTx = await wallet.signTx(txBuilder.txHex);
  const txHash = await txBuilder.submitTx(signedTx);
  if (!txHash) throw new Error("Failed to submit transaction");

  return {
    txHash,
    protocolParams: {
      txInput: {
        txHash: utxo1.input.txHash,
        outputIndex: utxo1.input.outputIndex,
      },
      scriptHash: protocolParamMint.scriptHash as string,
      alwaysFailScriptHash: alwaysFail.scriptHash as string,
    },
    programmableLogicGlobalPrams: {
      protocolParamsScriptHash: protocolParamMint.scriptHash as string,
      scriptHash: programmableLogicGlobal.scriptHash as string,
    },
    programmableLogicBaseParams: {
      programmableLogicGlobalScriptHash:
        programmableLogicGlobal.scriptHash as string,
      scriptHash: programmableLogicBase.policyId as string,
    },
    issuanceParams: {
      txInput: {
        txHash: utxo2.input.txHash,
        outputIndex: utxo2.input.outputIndex,
      },
      scriptHash: issuanceCborHex.policyId as string,
      alwaysFailScriptHash: alwaysFail.scriptHash as string,
    },
    directoryMintParams: {
      txInput: {
        txHash: utxo1.input.txHash,
        outputIndex: utxo1.input.outputIndex,
      },
      issuanceScriptHash: issuanceCborHex.policyId as string,
      scriptHash: registryMint.policyId as string,
    },
    directorySpendParams: {
      protocolParamsPolicyId: protocolParamMint.scriptHash as string,
      scriptHash: registrySpend.policyId as string,
    },
    programmableBaseRefInput: { txHash, outputIndex: 3 },
    programmableGlobalRefInput: { txHash, outputIndex: 4 },
  };
}

async function splitWallet(wallet: IWallet, networkId: 0 | 1): Promise<string> {
  const changeAddress = await wallet.getChangeAddress();
  const walletUtxos = await wallet.getUtxos();
  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });

  const unsignedTx = await txBuilder
    .selectUtxosFrom(walletUtxos)
    .txOut(changeAddress, [{ unit: "lovelace", quantity: "5000000" }])
    .txOut(changeAddress, [{ unit: "lovelace", quantity: "5000000" }])
    .changeAddress(changeAddress)
    .setNetwork(networkId === 0 ? "preview" : "mainnet")
    .complete();

  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);
  if (!txHash) throw new Error("Failed to split wallet");
  return txHash;
}

async function waitForUtxosWithTimeout(
  txHash: string,
  timeoutMs = 150_000, // 2 minutes
  intervalMs = 30_000, // 30 seconds
): Promise<UTxO[]> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    let utxos: UTxO[] | undefined;
    try {
      utxos = await provider.fetchUTxOs(txHash);
    } catch {
      // Provider may throw while the tx is still being indexed; keep polling.
      utxos = undefined;
    }

    if (Array.isArray(utxos) && utxos.length > 0) {
      return utxos;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs / 1000}s waiting for UTxOs from tx ${txHash}`,
  );
}
