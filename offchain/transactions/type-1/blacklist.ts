// import {
//     MeshWallet,
//     BlockfrostProvider,
//     MeshTxBuilder,
//     deserializeAddress,
//     serializeAddressObj,
//     resolveScriptHash,
//     UTxO,
//     Asset,
//     PlutusScript,
//     Data,
//   } from "@meshsdk/core";
//   import { applyParamsToScript } from "@meshsdk/core-csl";
  
//   // ============================================================================
//   // Constants from Aiken Code (types.ak)
//   // ============================================================================
  
//   /**
//    * Origin node token name - empty ByteArray
//    * pub const origin_node_tn = #""
//    */
//   export const ORIGIN_NODE_TN = "";
  
//   /**
//    * Maximum key value (28 bytes of 0xff) - represents infinity
//    * Used in: validate_blacklist_init -> node.next == #"ffff...ff"
//    */
//   export const MAX_KEY = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  
//   /**
//    * Empty key - represents the origin node
//    * Used in: validate_blacklist_init -> node.key == #""
//    */
//   export const EMPTY_KEY = "";
  
//   /**
//    * Minimum ADA for UTxO (2 ADA as per Cardano minimum)
//    */
//   export const MIN_ADA = "2000000"; // 2 ADA in lovelace
  
//   // ============================================================================
//   // Type Definitions Matching Aiken
//   // ============================================================================
  
//   /**
//    * BlacklistNode datum structure
//    * Matches: pub type BlacklistNode { key: ByteArray, next: ByteArray }
//    */
//   export interface BlacklistNode {
//     key: string; // ByteArray as hex string
//     next: string; // ByteArray as hex string
//   }
  
//   /**
//    * BlacklistRedeemer types from types.ak
//    * pub type BlacklistRedeemer {
//    *   BlacklistInit
//    *   BlacklistInsert { key: ByteArray }
//    *   BlacklistRemove { key: ByteArray }
//    * }
//    */
//   export enum BlacklistRedeemerType {
//     Init = 0,      // BlacklistInit
//     Insert = 1,    // BlacklistInsert
//     Remove = 2,    // BlacklistRemove
//   }
  
//   /**
//    * Configuration for blacklist minting policy
//    * Matches validator parameters: blacklist_mint(utxo_ref: OutputReference, manager_pkh: ByteArray)
//    */
//   export interface BlacklistConfig {
//     utxoRef: {
//       txHash: string;
//       outputIndex: number;
//     };
//     managerPkh: string; // 28 bytes (56 hex chars)
//   }
  
//   /**
//    * Compiled scripts
//    */
//   export interface BlacklistScripts {
//     mintingScript: PlutusScript;
//     validatorScript: PlutusScript;
//   }
  
//   // ============================================================================
//   // Datum and Redeemer Construction (Matching Aiken Types)
//   // ============================================================================
  
//   /**
//    * Creates BlacklistNode datum
//    * Aiken: pub type BlacklistNode { key: ByteArray, next: ByteArray }
//    * Constructor index: 0 (only one variant)
//    */
//   export function createBlacklistNodeDatum(node: BlacklistNode): string {
//     // BlacklistNode is a simple record with 2 fields
//     return Data.to({
//       alternative: 0,
//       fields: [node.key, node.next],
//     });
//   }
  
//   /**
//    * Parses BlacklistNode datum from plutus data
//    */
//   export function parseBlacklistNodeDatum(datumCbor: string): BlacklistNode {
//     const datum = Data.from(datumCbor) as any;
//     return {
//       key: datum.fields[0],
//       next: datum.fields[1],
//     };
//   }
  
//   /**
//    * Creates BlacklistInit redeemer
//    * Aiken: BlacklistInit (no fields)
//    * Constructor index: 0
//    */
//   export function createInitRedeemer(): string {
//     return Data.to({
//       alternative: 0,
//       fields: [],
//     });
//   }
  
//   /**
//    * Creates BlacklistInsert redeemer
//    * Aiken: BlacklistInsert { key: ByteArray }
//    * Constructor index: 1
//    */
//   export function createInsertRedeemer(key: string): string {
//     return Data.to({
//       alternative: 1,
//       fields: [key],
//     });
//   }
  
//   /**
//    * Creates BlacklistRemove redeemer
//    * Aiken: BlacklistRemove { key: ByteArray }
//    * Constructor index: 2
//    */
//   export function createRemoveRedeemer(key: string): string {
//     return Data.to({
//       alternative: 2,
//       fields: [key],
//     });
//   }
  
//   // ============================================================================
//   // Helper Functions
//   // ============================================================================
  
//   /**
//    * Gets policy ID from minting script
//    */
//   export function getPolicyId(script: PlutusScript): string {
//     return resolveScriptHash(script.code, script.version);
//   }
  
//   /**
//    * Gets validator address from script
//    */
//   export function getValidatorAddress(
//     script: PlutusScript,
//     networkId: number = 0
//   ): string {
//     const scriptHash = resolveScriptHash(script.code, script.version);
    
//     return serializeAddressObj({
//       type: 1, // script address
//       networkId,
//       paymentCredential: {
//         type: 1, // script credential
//         hash: scriptHash,
//       },
//     });
//   }
  
//   /**
//    * Creates asset unit (policyId + tokenName)
//    */
//   export function createAssetUnit(policyId: string, tokenName: string): string {
//     return policyId + tokenName;
//   }
  
//   /**
//    * Validates that a key is a valid public key hash (28 bytes)
//    * Matches Aiken: builtin.length_of_bytearray(key) == 28
//    */
//   export function validatePubKeyHash(key: string): boolean {
//     try {
//       const bytes = Buffer.from(key, "hex");
//       return bytes.length === 28;
//     } catch {
//       return false;
//     }
//   }
  
//   /**
//    * Compares two hex-encoded byte arrays lexicographically
//    * Matches Aiken: bytearray_lt(a, b) which uses builtin.less_than_bytearray
//    * Returns: -1 if a < b, 0 if a == b, 1 if a > b
//    */
//   export function compareByteArrays(a: string, b: string): number {
//     // Handle empty strings (origin node case)
//     if (a === "" && b !== "") return -1;
//     if (a !== "" && b === "") return 1;
//     if (a === "" && b === "") return 0;
    
//     const aBytes = Buffer.from(a, "hex");
//     const bBytes = Buffer.from(b, "hex");
    
//     for (let i = 0; i < Math.min(aBytes.length, bBytes.length); i++) {
//       if (aBytes[i] < bBytes[i]) return -1;
//       if (aBytes[i] > bBytes[i]) return 1;
//     }
    
//     if (aBytes.length < bBytes.length) return -1;
//     if (aBytes.length > bBytes.length) return 1;
//     return 0;
//   }
  
//   /**
//    * Gets payment credential hash from address
//    */
//   export function getPaymentCredentialHash(address: string): string {
//     const addressObj = deserializeAddress(address);
//     return addressObj.pubKeyHash || addressObj.scriptHash || "";
//   }
  
//   /**
//    * Finds all UTxOs containing tokens from a specific policy
//    * Matches Aiken: collect_node_ios logic - filters by has_currency_symbol
//    */
//   export async function findBlacklistNodeUtxos(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string
//   ): Promise<UTxO[]> {
//     const utxos = await provider.fetchAddressUTxOs(validatorAddress);
    
//     // Filter UTxOs that have the node token (has_currency_symbol check)
//     return utxos.filter((utxo) => {
//       return utxo.output.amount.some((asset) => asset.unit.startsWith(policyId));
//     });
//   }
  
//   /**
//    * Finds a specific blacklist node UTxO by key
//    */
//   export async function findBlacklistNodeByKey(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string,
//     key: string
//   ): Promise<UTxO | null> {
//     const nodeUtxos = await findBlacklistNodeUtxos(
//       provider,
//       validatorAddress,
//       policyId
//     );
    
//     for (const utxo of nodeUtxos) {
//       if (utxo.output.plutusData) {
//         const node = parseBlacklistNodeDatum(utxo.output.plutusData);
//         if (node.key === key) {
//           return utxo;
//         }
//       }
//     }
    
//     return null;
//   }
  
//   /**
//    * Finds the covering node for insertion
//    * Matches Aiken logic: bytearray_lt(covering_node.key, key) && bytearray_lt(key, covering_node.next)
//    */
//   export async function findCoveringNode(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string,
//     key: string
//   ): Promise<UTxO | null> {
//     const nodeUtxos = await findBlacklistNodeUtxos(
//       provider,
//       validatorAddress,
//       policyId
//     );
    
//     for (const utxo of nodeUtxos) {
//       if (utxo.output.plutusData) {
//         const node = parseBlacklistNodeDatum(utxo.output.plutusData);
        
//         // Check covering condition: covering.key < key < covering.next
//         if (
//           compareByteArrays(node.key, key) < 0 &&
//           compareByteArrays(key, node.next) < 0
//         ) {
//           return utxo;
//         }
//       }
//     }
    
//     return null;
//   }
  
//   /**
//    * Finds the covering node for removal
//    * The covering node is where covering.next == keyToRemove
//    */
//   export async function findCoveringNodeForRemoval(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string,
//     keyToRemove: string,
//     excludeTxHash: string
//   ): Promise<UTxO | null> {
//     const nodeUtxos = await findBlacklistNodeUtxos(
//       provider,
//       validatorAddress,
//       policyId
//     );
    
//     for (const utxo of nodeUtxos) {
//       // Skip the node we're removing
//       if (utxo.input.txHash === excludeTxHash) continue;
      
//       if (utxo.output.plutusData) {
//         const node = parseBlacklistNodeDatum(utxo.output.plutusData);
//         if (node.next === keyToRemove) {
//           return utxo;
//         }
//       }
//     }
    
//     return null;
//   }
  
//   /**
//    * Applies parameters to the minting script
//    * Parameters: (utxo_ref: OutputReference, manager_pkh: ByteArray)
//    */
//   export function applyMintingPolicyParams(
//     script: PlutusScript,
//     utxoRef: { txHash: string; outputIndex: number },
//     managerPkh: string
//   ): PlutusScript {
//     // OutputReference structure: { transaction_id: { hash: ByteArray }, output_index: Int }
//     const params = Data.to([
//       {
//         alternative: 0,
//         fields: [
//           { bytes: utxoRef.txHash },
//           utxoRef.outputIndex,
//         ],
//       },
//       managerPkh,
//     ]);
    
//     const compiledCode = applyParamsToScript(script.code, [params]);
    
//     return {
//       code: compiledCode,
//       version: script.version,
//     };
//   }
  
//   // ============================================================================
//   // Transaction Builders
//   // ============================================================================
  
//   /**
//    * Initializes the blacklist with the origin node
//    * 
//    * Matches Aiken validation in validate_blacklist_init:
//    * - No node inputs (list.is_empty(node_inputs))
//    * - One output with origin node datum (key: "", next: "ffff...ff")
//    * - Mint exactly one origin token (assets.has_nft(mint, node_cs, origin_node_tn))
//    * - Origin token must be spent (one-shot constraint)
//    */
//   export async function initializeBlacklist(
//     wallet: MeshWallet,
//     provider: BlockfrostProvider,
//     config: BlacklistConfig,
//     scripts: BlacklistScripts,
//     networkId: number = 0
//   ): Promise<string> {
//     const validatorAddress = getValidatorAddress(scripts.validatorScript, networkId);
//     const policyId = getPolicyId(scripts.mintingScript);
    
//     // Create origin node: key = "", next = "ffff...ff"
//     const originNode: BlacklistNode = {
//       key: EMPTY_KEY,
//       next: MAX_KEY,
//     };
    
//     const originDatum = createBlacklistNodeDatum(originNode);
//     const initRedeemer = createInitRedeemer();
    
//     // Asset to mint: origin node token with empty token name
//     const originAssetUnit = createAssetUnit(policyId, ORIGIN_NODE_TN);
    
//     // Build transaction
//     const txBuilder = new MeshTxBuilder({
//       fetcher: provider,
//       submitter: provider,
//     });
    
//     const utxos = await wallet.getUtxos();
//     const walletAddress = await wallet.getChangeAddress();
    
//     // The one-shot UTxO must be spent
//     await txBuilder
//       .txIn(
//         config.utxoRef.txHash,
//         config.utxoRef.outputIndex
//       )
//       .mintPlutusScriptV2()
//       .mint("1", policyId, ORIGIN_NODE_TN)
//       .mintingScript(scripts.mintingScript.code)
//       .mintRedeemerValue(initRedeemer)
//       .txOut(validatorAddress, [
//         { unit: "lovelace", quantity: MIN_ADA },
//         { unit: originAssetUnit, quantity: "1" },
//       ])
//       .txOutInlineDatumValue(originDatum)
//       .changeAddress(walletAddress)
//       .selectUtxosFrom(utxos)
//       .complete();
    
//     const unsignedTx = txBuilder.txHex;
//     const signedTx = await wallet.signTx(unsignedTx);
//     const txHash = await provider.submitTx(signedTx);
    
//     return txHash;
//   }
  
//   /**
//    * Inserts a new key into the blacklist
//    * 
//    * Matches Aiken validation in BlacklistInsert:
//    * - Manager must sign (manager_signed)
//    * - Exactly one node input - the covering node
//    * - Mint exactly one token with the new key (assets.has_nft)
//    * - Key must be 28 bytes (builtin.length_of_bytearray(key) == 28)
//    * - Covering condition: covering.key < key < covering.next
//    * - Exactly 2 outputs: updated covering node and new inserted node
//    * - Updated covering: covering.key -> key
//    * - New inserted: key -> covering.next
//    */
//   export async function insertIntoBlacklist(
//     wallet: MeshWallet,
//     provider: BlockfrostProvider,
//     config: BlacklistConfig,
//     scripts: BlacklistScripts,
//     keyToInsert: string,
//     networkId: number = 0
//   ): Promise<string> {
//     // Validate key is 28 bytes
//     if (!validatePubKeyHash(keyToInsert)) {
//       throw new Error("Invalid public key hash: must be 28 bytes (56 hex characters)");
//     }
    
//     const validatorAddress = getValidatorAddress(scripts.validatorScript, networkId);
//     const policyId = getPolicyId(scripts.mintingScript);
    
//     // Find the covering node
//     const coveringUtxo = await findCoveringNode(
//       provider,
//       validatorAddress,
//       policyId,
//       keyToInsert
//     );
    
//     if (!coveringUtxo || !coveringUtxo.output.plutusData) {
//       throw new Error("Could not find covering node for key insertion");
//     }
    
//     const coveringNode = parseBlacklistNodeDatum(coveringUtxo.output.plutusData);
    
//     // Verify covering condition (extra safety check)
//     if (
//       compareByteArrays(coveringNode.key, keyToInsert) >= 0 ||
//       compareByteArrays(keyToInsert, coveringNode.next) >= 0
//     ) {
//       throw new Error("Key does not satisfy covering condition");
//     }
    
//     // Create the two output nodes
//     const updatedCoveringNode: BlacklistNode = {
//       key: coveringNode.key,
//       next: keyToInsert,
//     };
    
//     const insertedNode: BlacklistNode = {
//       key: keyToInsert,
//       next: coveringNode.next,
//     };
    
//     const updatedCoveringDatum = createBlacklistNodeDatum(updatedCoveringNode);
//     const insertedDatum = createBlacklistNodeDatum(insertedNode);
//     const insertRedeemer = createInsertRedeemer(keyToInsert);
    
//     // Asset to mint
//     const newAssetUnit = createAssetUnit(policyId, keyToInsert);
    
//     // Get covering node's token for output
//     const coveringNodeAsset = coveringUtxo.output.amount.find(
//       (asset) => asset.unit.startsWith(policyId)
//     );
    
//     if (!coveringNodeAsset) {
//       throw new Error("Covering node does not have policy token");
//     }
    
//     // Build transaction
//     const txBuilder = new MeshTxBuilder({
//       fetcher: provider,
//       submitter: provider,
//     });
    
//     const utxos = await wallet.getUtxos();
//     const walletAddress = await wallet.getChangeAddress();
    
//     // Spend covering node with void redeemer (spending validator doesn't do validation)
//     const spendRedeemer = Data.void();
    
//     await txBuilder
//       .spendingPlutusScriptV2()
//       .txIn(
//         coveringUtxo.input.txHash,
//         coveringUtxo.input.outputIndex,
//         coveringUtxo.output.amount,
//         validatorAddress
//       )
//       .txInInlineDatumPresent()
//       .txInRedeemerValue(spendRedeemer)
//       .spendingScript(scripts.validatorScript.code)
//       // Mint the new node token
//       .mintPlutusScriptV2()
//       .mint("1", policyId, keyToInsert)
//       .mintingScript(scripts.mintingScript.code)
//       .mintRedeemerValue(insertRedeemer)
//       // Output 1: Updated covering node (same token as input)
//       .txOut(validatorAddress, [
//         { unit: "lovelace", quantity: MIN_ADA },
//         { unit: coveringNodeAsset.unit, quantity: "1" },
//       ])
//       .txOutInlineDatumValue(updatedCoveringDatum)
//       // Output 2: New inserted node (newly minted token)
//       .txOut(validatorAddress, [
//         { unit: "lovelace", quantity: MIN_ADA },
//         { unit: newAssetUnit, quantity: "1" },
//       ])
//       .txOutInlineDatumValue(insertedDatum)
//       // Manager must sign
//       .requiredSignerHash(config.managerPkh)
//       .changeAddress(walletAddress)
//       .selectUtxosFrom(utxos)
//       .complete();
    
//     const unsignedTx = txBuilder.txHex;
//     const signedTx = await wallet.signTx(unsignedTx);
//     const txHash = await provider.submitTx(signedTx);
    
//     return txHash;
//   }
  
//   /**
//    * Removes a key from the blacklist
//    * 
//    * Matches Aiken validation in BlacklistRemove:
//    * - Manager must sign
//    * - Exactly two node inputs: node to remove and covering node
//    * - Burn exactly one token (assets.quantity_of(self.mint, policy_id, key) == -1)
//    * - Exactly one output: merged node
//    * - Logic: if node_a.key == key, then output.key == node_b.key && output.next == node_a.next
//    *          else if node_b.key == key, then output.key == node_a.key && output.next == node_b.next
//    */
//   export async function removeFromBlacklist(
//     wallet: MeshWallet,
//     provider: BlockfrostProvider,
//     config: BlacklistConfig,
//     scripts: BlacklistScripts,
//     keyToRemove: string,
//     networkId: number = 0
//   ): Promise<string> {
//     const validatorAddress = getValidatorAddress(scripts.validatorScript, networkId);
//     const policyId = getPolicyId(scripts.mintingScript);
    
//     // Find the node to remove
//     const nodeToRemove = await findBlacklistNodeByKey(
//       provider,
//       validatorAddress,
//       policyId,
//       keyToRemove
//     );
    
//     if (!nodeToRemove || !nodeToRemove.output.plutusData) {
//       throw new Error("Node to remove not found");
//     }
    
//     const nodeToRemoveData = parseBlacklistNodeDatum(nodeToRemove.output.plutusData);
    
//     // Find the covering node (where covering.next == keyToRemove)
//     const coveringUtxo = await findCoveringNodeForRemoval(
//       provider,
//       validatorAddress,
//       policyId,
//       keyToRemove,
//       nodeToRemove.input.txHash
//     );
    
//     if (!coveringUtxo || !coveringUtxo.output.plutusData) {
//       throw new Error("Could not find covering node for removal");
//     }
    
//     const coveringNode = parseBlacklistNodeDatum(coveringUtxo.output.plutusData);
    
//     // Verify covering node points to the node we're removing
//     if (coveringNode.next !== keyToRemove) {
//       throw new Error("Covering node does not point to the node being removed");
//     }
    
//     // Create the merged output node
//     // output.key = covering.key, output.next = removed.next
//     const mergedNode: BlacklistNode = {
//       key: coveringNode.key,
//       next: nodeToRemoveData.next,
//     };
    
//     const mergedDatum = createBlacklistNodeDatum(mergedNode);
//     const removeRedeemer = createRemoveRedeemer(keyToRemove);
    
//     // Get covering node's token for output (this is preserved)
//     const coveringNodeAsset = coveringUtxo.output.amount.find(
//       (asset) => asset.unit.startsWith(policyId)
//     );
    
//     if (!coveringNodeAsset) {
//       throw new Error("Covering node does not have policy token");
//     }
    
//     // Build transaction
//     const txBuilder = new MeshTxBuilder({
//       fetcher: provider,
//       submitter: provider,
//     });
    
//     const utxos = await wallet.getUtxos();
//     const walletAddress = await wallet.getChangeAddress();
    
//     const spendRedeemer = Data.void();
    
//     await txBuilder
//       // Spend node to remove
//       .spendingPlutusScriptV2()
//       .txIn(
//         nodeToRemove.input.txHash,
//         nodeToRemove.input.outputIndex,
//         nodeToRemove.output.amount,
//         validatorAddress
//       )
//       .txInInlineDatumPresent()
//       .txInRedeemerValue(spendRedeemer)
//       // Spend covering node
//       .txIn(
//         coveringUtxo.input.txHash,
//         coveringUtxo.input.outputIndex,
//         coveringUtxo.output.amount,
//         validatorAddress
//       )
//       .txInInlineDatumPresent()
//       .txInRedeemerValue(spendRedeemer)
//       .spendingScript(scripts.validatorScript.code)
//       // Burn the removed node's token
//       .mintPlutusScriptV2()
//       .mint("-1", policyId, keyToRemove)
//       .mintingScript(scripts.mintingScript.code)
//       .mintRedeemerValue(removeRedeemer)
//       // Single output: merged node with covering node's token
//       .txOut(validatorAddress, [
//         { unit: "lovelace", quantity: MIN_ADA },
//         { unit: coveringNodeAsset.unit, quantity: "1" },
//       ])
//       .txOutInlineDatumValue(mergedDatum)
//       // Manager must sign
//       .requiredSignerHash(config.managerPkh)
//       .changeAddress(walletAddress)
//       .selectUtxosFrom(utxos)
//       .complete();
    
//     const unsignedTx = txBuilder.txHex;
//     const signedTx = await wallet.signTx(unsignedTx);
//     const txHash = await provider.submitTx(signedTx);
    
//     return txHash;
//   }
  
//   // ============================================================================
//   // Query Functions
//   // ============================================================================
  
//   /**
//    * Gets all blacklisted keys in order by traversing the linked list
//    */
//   export async function getAllBlacklistedKeys(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string
//   ): Promise<string[]> {
//     const nodeUtxos = await findBlacklistNodeUtxos(provider, validatorAddress, policyId);
    
//     // Build a map of key -> next
//     const nodeMap = new Map<string, string>();
    
//     for (const utxo of nodeUtxos) {
//       if (utxo.output.plutusData) {
//         const node = parseBlacklistNodeDatum(utxo.output.plutusData);
//         nodeMap.set(node.key, node.next);
//       }
//     }
    
//     // Traverse the linked list starting from empty key
//     const keys: string[] = [];
//     let current = EMPTY_KEY;
    
//     while (current !== MAX_KEY && nodeMap.has(current)) {
//       const next = nodeMap.get(current)!;
      
//       // Don't include the origin node or the max sentinel
//       if (next !== MAX_KEY && next !== "") {
//         keys.push(next);
//       }
      
//       current = next;
      
//       // Safety check to prevent infinite loops
//       if (keys.length > 10000) {
//         throw new Error("Linked list traversal exceeded maximum iterations");
//       }
//     }
    
//     return keys;
//   }
  
//   /**
//    * Checks if a key is blacklisted
//    */
//   export async function isKeyBlacklisted(
//     provider: BlockfrostProvider,
//     validatorAddress: string,
//     policyId: string,
//     key: string
//   ): Promise<boolean> {
//     const node = await findBlacklistNodeByKey(provider, validatorAddress, policyId, key);
//     return node !== null;
//   }
  
//   // ============================================================================
//   // Example Usage
//   // ============================================================================
  
//   /**
//    * Complete workflow example
//    */
//   export async function exampleWorkflow() {
//     // Setup provider
//     const provider = new BlockfrostProvider("your_blockfrost_api_key");
    
//     // Setup wallet
//     const wallet = new MeshWallet({
//       networkId: 0, // testnet
//       fetcher: provider,
//       submitter: provider,
//       key: {
//         type: "mnemonic",
//         words: ["your", "24", "word", "mnemonic"],
//       },
//     });
    
//     // Load compiled scripts
//     const scripts: BlacklistScripts = {
//       mintingScript: {
//         code: "590820...", // From aiken build
//         version: "V2",
//       },
//       validatorScript: {
//         code: "590750...", // From aiken build  
//         version: "V2",
//       },
//     };
    
//     const walletAddress = await wallet.getChangeAddress();
    
//     // Configuration
//     const config: BlacklistConfig = {
//       utxoRef: {
//         txHash: "your_one_shot_utxo_txhash",
//         outputIndex: 0,
//       },
//       managerPkh: getPaymentCredentialHash(walletAddress),
//     };
    
//     const validatorAddress = getValidatorAddress(scripts.validatorScript, 0);
//     const policyId = getPolicyId(scripts.mintingScript);
    
//     // Initialize blacklist
//     console.log("Initializing blacklist...");
//     const initTxHash = await initializeBlacklist(wallet, provider, config, scripts, 0);
//     console.log("Init tx:", initTxHash);
    
//     // Insert key
//     const keyToInsert = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8";
//     console.log("Inserting key...");
//     const insertTxHash = await insertIntoBlacklist(
//       wallet,
//       provider,
//       config,
//       scripts,
//       keyToInsert,
//       0
//     );
//     console.log("Insert tx:", insertTxHash);
    
//     // Query
//     const isBlacklisted = await isKeyBlacklisted(
//       provider,
//       validatorAddress,
//       policyId,
//       keyToInsert
//     );
//     console.log("Is blacklisted?", isBlacklisted);
    
//     // Remove key
//     console.log("Removing key...");
//     const removeTxHash = await removeFromBlacklist(
//       wallet,
//       provider,
//       config,
//       scripts,
//       keyToInsert,
//       0
//     );
//     console.log("Remove tx:", removeTxHash);
//   }