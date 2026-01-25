import {
  Asset,
  byteString,
  conStr0,
  conStr1,
  integer,
  list,
  MeshTxBuilder,
  POLICY_ID_LENGTH,
  stringToHex,
  UTxO,
} from "@meshsdk/core";
import { deserializeDatum, resolveScriptHash, IFetcher } from "@meshsdk/core";
import {
  buildBaseAddress,
  CredentialType,
  deserializeAddress,
  Hash28ByteBase16,
  scriptHashToRewardAddress,
} from "@meshsdk/core-cst";
import { PlutusScript } from "@meshsdk/common";

import { Cip113_scripts_standard } from "../../deployment/standard";
import { ProtocolBootstrapParams, RegistryDatum } from "../../types";
import { parseRegistryDatum } from "../../utils";
import { ISubmitter } from "@meshsdk/core";
import { IEvaluator } from "@meshsdk/core";

export interface ProgrammableTokenContractInput {
  wallet: any; // Wallet interface from Mesh SDK
  provider: IFetcher | ISubmitter | IEvaluator;
  params: ProtocolBootstrapParams;
  networkId?: 0 | 1;
  quantity?: string;
}

export class ProgrammableTokenContract {
  private wallet: any;
  private provider: IFetcher;
  params: ProtocolBootstrapParams;
  quantity: string;
  networkId: 0 | 1;

  constructor(inputs: ProgrammableTokenContractInput) {
    this.wallet = inputs.wallet;
    this.provider = inputs.provider as IFetcher;
    this.params = inputs.params;
    this.quantity = inputs.quantity || "1";
    this.networkId = inputs.networkId || 0;
  }

  // Expose wallet for frontend use
  getWallet() {
    return this.wallet;
  }

  protocolParambootstrap = async (
    refInputAddress: string
  ): Promise<ProtocolBootstrapParams> => {
    if (!this.wallet) {
      throw new Error("Wallet is required for protocol bootstrap");
    }
    if (!this.provider) {
      throw new Error("Provider is required for protocol bootstrap");
    }
    throw new Error(
      "protocolParambootstrap requires bootstrapProtocol function. Please provide params in constructor or implement bootstrap logic."
    );
  };

  registerToken = async (
    assetName: string,
    mintingLogicPlutusScript: PlutusScript,
    transferLogicPlutusScript: PlutusScript,
    transferRedeemerValue: any,
    recipientAddress?: string,
    globalStateLogicPlutusScript?: PlutusScript,
    thirdPartyLogicPlutusScript?: PlutusScript
  ): Promise<string> => {
    const changeAddress = await this.wallet.getChangeAddress();
    const walletUtxos = await this.wallet.getUtxos();
    const collateral = (await this.wallet.getCollateral())[0];

    if (!collateral) {
      throw new Error("No collateral available");
    }

    const standardScript = new Cip113_scripts_standard(this.networkId);

    const registrySpend = await standardScript.registry_spend(this.params);
    const registryMint = await standardScript.registry_mint(this.params);
    const logicBase = await standardScript.programmable_logic_base(
      this.params
    );
    const mintingLogicScriptHash = resolveScriptHash(
      mintingLogicPlutusScript.code,
      mintingLogicPlutusScript.version
    );
    const issuanceMint = await standardScript.issuance_mint(
      mintingLogicScriptHash,
      this.params
    );

    const bootstrapTxHash = this.params.txHash;
    const protocolParamsUtxos = await this.provider.fetchUTxOs(
      bootstrapTxHash,
      0
    );

    if (!protocolParamsUtxos) {
      throw new Error("Could not resolve protocol params");
    }

    const issuanceUtxos = await this.provider.fetchUTxOs(bootstrapTxHash, 2);
    if (!issuanceUtxos) {
      throw new Error("Issuance UTXO not found");
    }

    const protocolParamsUtxo = protocolParamsUtxos[0];
    const issuanceUtxo = issuanceUtxos[0];
    let thirdPartyLogicScriptHash: string = "";
    let globalStateLogicScriptHash: string = "";

    const transferLogicScriptHash = resolveScriptHash(
      transferLogicPlutusScript.code,
      transferLogicPlutusScript.version
    );
    const transferAddress = scriptHashToRewardAddress(
      transferLogicScriptHash,
      this.networkId
    );
    if (thirdPartyLogicPlutusScript) {
      thirdPartyLogicScriptHash = resolveScriptHash(
        thirdPartyLogicPlutusScript.code,
        thirdPartyLogicPlutusScript.version
      );
    }
    if (globalStateLogicPlutusScript) {
      globalStateLogicScriptHash = resolveScriptHash(
        globalStateLogicPlutusScript.code,
        globalStateLogicPlutusScript.version
      );
    }
    const tokenPolicyId = issuanceMint.policy_id;
    const registryEntries = await this.provider.fetchAddressUTxOs(
      registrySpend.address
    );
    const registryEntriesDatums = registryEntries?.flatMap((utxo: UTxO) =>
      deserializeDatum(utxo.output.plutusData!)
    );

    const existingEntry = registryEntriesDatums
      ?.map(parseRegistryDatum)
      .filter((d): d is RegistryDatum => d !== null)
      .find((d) => d.key === tokenPolicyId);

    if (existingEntry) {
      throw new Error(`Token policy ${tokenPolicyId} already registered`);
    }

    const nodeToReplaceUtxo = registryEntries?.find((utxo) => {
      const datum = deserializeDatum(utxo.output.plutusData!);
      const parsedDatum = parseRegistryDatum(datum);

      if (!parsedDatum) {
        console.log("Could not parse registry datum");
        return false;
      }

      const after = parsedDatum.key.localeCompare(tokenPolicyId) < 0;
      const before = tokenPolicyId.localeCompare(parsedDatum.next) < 0;

      return after && before;
    });

    if (!nodeToReplaceUtxo) {
      throw new Error("Could not find node to replace");
    }

    const existingRegistryNodeDatum = parseRegistryDatum(
      deserializeDatum(nodeToReplaceUtxo.output.plutusData!)
    );

    if (!existingRegistryNodeDatum) {
      throw new Error("Could not parse current registry node");
    }

    const stakeCredential = deserializeAddress(
      recipientAddress ? recipientAddress : changeAddress
    )
      .asBase()
      ?.getStakeCredential().hash!;
    const targetAddress = buildBaseAddress(
      0,
      logicBase.policyId as Hash28ByteBase16,
      stakeCredential,
      CredentialType.ScriptHash,
      CredentialType.KeyHash
    );

    const registryMintRedeemer = conStr1([
      byteString(tokenPolicyId),
      byteString(mintingLogicScriptHash),
    ]);

    const issuanceRedeemer = conStr0([
      conStr1([byteString(mintingLogicScriptHash)]),
    ]);

    const previousNodeDatum = conStr0([
      byteString(existingRegistryNodeDatum.key),
      byteString(tokenPolicyId),
      byteString(existingRegistryNodeDatum.transferScriptHash),
      byteString(existingRegistryNodeDatum.thirdPartyScriptHash),
      byteString(existingRegistryNodeDatum.metadata),
    ]);

    const newNodeDatum = conStr0([
      byteString(tokenPolicyId),
      byteString(existingRegistryNodeDatum.next),
      byteString(transferLogicScriptHash),
      byteString(thirdPartyLogicScriptHash),
      byteString(globalStateLogicScriptHash),
    ]);

    const directorySpendAssets: Asset[] = [
      { unit: "lovelace", quantity: "1500000" },
      { unit: registryMint.policy_id, quantity: "1" },
    ];

    const directoryMintAssets: Asset[] = [
      { unit: "lovelace", quantity: "1500000" },
      { unit: registryMint.policy_id + tokenPolicyId, quantity: "1" },
    ];

    const programmableTokenAssets: Asset[] = [
      { unit: "lovelace", quantity: "1500000" },
      {
        unit: tokenPolicyId + stringToHex(assetName),
        quantity: this.quantity,
      },
    ];

    const txBuilder = new MeshTxBuilder({
      fetcher: this.provider,
      submitter: this.provider as unknown as ISubmitter,
      evaluator: this.provider as unknown as IEvaluator,
      verbose: true,
    });

    const unsignedTx = await txBuilder
      .spendingPlutusScriptV3()
      .txIn(nodeToReplaceUtxo.input.txHash, nodeToReplaceUtxo.input.outputIndex)
      .txInScript(registrySpend.cbor)
      .txInRedeemerValue(conStr0([]), "JSON")
      .txInInlineDatumPresent()
      .withdrawalPlutusScriptV3()
      .withdrawal(transferAddress, "0")
      .withdrawalScript(transferLogicPlutusScript.code)
      .withdrawalRedeemerValue(transferRedeemerValue, "JSON")
      .mintPlutusScriptV3()
      .mint(this.quantity, tokenPolicyId, stringToHex(assetName))
      .mintingScript(issuanceMint.cbor)
      .mintRedeemerValue(issuanceRedeemer, "JSON")
      .mintPlutusScriptV3()
      .mint("1", registryMint.policy_id, tokenPolicyId)
      .mintingScript(registryMint.cbor)
      .mintRedeemerValue(registryMintRedeemer, "JSON")
      .txOut(targetAddress.toAddress().toBech32(), programmableTokenAssets)
      .txOutInlineDatumValue(conStr0([]), "JSON")
      .txOut(registrySpend.address, directorySpendAssets)
      .txOutInlineDatumValue(previousNodeDatum, "JSON")
      .txOut(registrySpend.address, directoryMintAssets)
      .txOutInlineDatumValue(newNodeDatum, "JSON")
      .readOnlyTxInReference(
        protocolParamsUtxo!.input.txHash,
        protocolParamsUtxo!.input.outputIndex
      )
      .readOnlyTxInReference(
        issuanceUtxo!.input.txHash,
        issuanceUtxo!.input.outputIndex
      )
      .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
      .selectUtxosFrom(walletUtxos)
      .changeAddress(changeAddress)
      .complete();

    return unsignedTx;
  };

  mintTokens = async (
    assetName: string,
    mintingLogicPlutusScript: PlutusScript,
    transferLogicPlutusScript: PlutusScript,
    transferRedeemerValue: any,
    recipientAddress?: string | null
  ): Promise<string> => {
    const changeAddress = await this.wallet.getChangeAddress();
    const walletUtxos = await this.wallet.getUtxos();
    const collateral = (await this.wallet.getCollateral())[0];

    if (!collateral) {
      throw new Error("No collateral available");
    }

    const standardScript = new Cip113_scripts_standard(this.networkId);

    const mintingLogicScriptHash = resolveScriptHash(
      mintingLogicPlutusScript.code,
      mintingLogicPlutusScript.version
    );
    const transferLogicScriptHash = resolveScriptHash(
      transferLogicPlutusScript.code,
      transferLogicPlutusScript.version
    );
    const transferAddress = scriptHashToRewardAddress(
      transferLogicScriptHash,
      this.networkId
    );
    const issuanceMint = await standardScript.issuance_mint(
      mintingLogicScriptHash,
      this.params
    );
    const senderCredential = deserializeAddress(
      recipientAddress ? recipientAddress : changeAddress
    ).asBase();
    if (!senderCredential) {
      throw new Error("Sender credential not found");
    }
    const logicBase = await standardScript.programmable_logic_base(
      this.params
    );
    const logicAddress = buildBaseAddress(
      0,
      logicBase.policyId as Hash28ByteBase16,
      senderCredential.getPaymentCredential().hash,
      CredentialType.ScriptHash,
      CredentialType.KeyHash
    );
    const targetAddress = logicAddress.toAddress().toBech32();

    const issuanceRedeemer = conStr0([
      conStr1([byteString(mintingLogicScriptHash)]),
    ]);

    const programmableTokenAssets: Asset[] = [
      { unit: "lovelace", quantity: "1500000" },
      {
        unit: issuanceMint.policy_id + stringToHex(assetName),
        quantity: this.quantity,
      },
    ];

    const programmableTokenDatum = conStr0([]);

    const txBuilder = new MeshTxBuilder({
      fetcher: this.provider,
      submitter: this.provider as unknown as ISubmitter,
      evaluator: this.provider as unknown as IEvaluator,
      verbose: true,
    });

    const unsignedTx = await txBuilder
      .withdrawalPlutusScriptV3()
      .withdrawal(transferAddress, "0")
      .withdrawalScript(transferLogicPlutusScript.code)
      .withdrawalRedeemerValue(transferRedeemerValue, "JSON")
      .mintPlutusScriptV3()
      .mint(this.quantity, issuanceMint.policy_id, stringToHex(assetName))
      .mintingScript(issuanceMint.cbor)
      .mintRedeemerValue(issuanceRedeemer, "JSON")
      .txOut(targetAddress, programmableTokenAssets)
      .txOutInlineDatumValue(programmableTokenDatum, "JSON")
      .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
      .selectUtxosFrom(walletUtxos)
      .changeAddress(changeAddress)
      .complete();

    return unsignedTx;
  };

  transferToken = async (
    unit: string,
    quantity: string,
    recipientAddress: string,
    transferLogicPlutusScript: PlutusScript,
    transferRedeemerValue: any
  ): Promise<string> => {
    const changeAddress = await this.wallet.getChangeAddress();
    const walletUtxos = await this.wallet.getUtxos();
    const collateral = (await this.wallet.getCollateral())[0];

    if (!collateral) {
      throw new Error("No collateral available");
    }

    const policyId = unit.substring(0, POLICY_ID_LENGTH);
    const standardScript = new Cip113_scripts_standard(this.networkId);
    const logicBase = await standardScript.programmable_logic_base(
      this.params
    );
    const logicGlobal = await standardScript.programmable_logic_global(
      this.params
    );
    const registrySpend = await standardScript.registry_spend(this.params);
    const transferLogicScriptHash = resolveScriptHash(
      transferLogicPlutusScript.code,
      transferLogicPlutusScript.version
    );
    const transferAddress = scriptHashToRewardAddress(
      transferLogicScriptHash,
      this.networkId
    );
    const senderCredential = deserializeAddress(changeAddress)
      .asBase()
      ?.getStakeCredential().hash;

    const recipientCredential = deserializeAddress(recipientAddress)
      .asBase()
      ?.getStakeCredential().hash;

    const senderBaseAddress = buildBaseAddress(
      0,
      logicBase.policyId as Hash28ByteBase16,
      senderCredential!,
      CredentialType.ScriptHash,
      CredentialType.KeyHash
    );
    const recipientBaseAddress = buildBaseAddress(
      0,
      logicBase.policyId as Hash28ByteBase16,
      recipientCredential!,
      CredentialType.ScriptHash,
      CredentialType.KeyHash
    );
    const senderAddress = senderBaseAddress.toAddress().toBech32();
    const targetAddress = recipientBaseAddress.toAddress().toBech32();

    const registryUtxos = await this.provider.fetchAddressUTxOs(
      registrySpend.address
    );
    if (!registryUtxos) {
      throw new Error("Could not find registry entry for utxos");
    }

    const tokenRegistry = registryUtxos?.find((utxo) => {
      const datum = deserializeDatum(utxo.output.plutusData!);
      const parsedDatum = parseRegistryDatum(datum);
      return parsedDatum?.key === policyId;
    });

    if (!tokenRegistry) {
      throw new Error("Could not find registry entry for token");
    }

    const protocolParamsUtxos = await this.provider.fetchUTxOs(
      this.params.txHash,
      0
    );
    if (!protocolParamsUtxos) {
      throw new Error("Could not resolve protocol params");
    }
    const protocolParamsUtxo = protocolParamsUtxos[0];

    const senderTokenUtxos = await this.provider.fetchAddressUTxOs(
      senderAddress
    );
    if (!senderTokenUtxos) {
      throw new Error("No programmable tokens found at sender address");
    }

    let totalTokenBalance = 0;
    senderTokenUtxos.forEach((utxo) => {
      const tokenAsset = utxo.output.amount.find((a) => a.unit === unit);
      if (tokenAsset) totalTokenBalance += Number(tokenAsset.quantity);
    });

    const transferAmount = Number(quantity);
    if (totalTokenBalance < transferAmount)
      throw new Error("Not enough funds");

    let selectedUtxos: UTxO[] = [];
    let selectedAmount = 0;
    for (const utxo of senderTokenUtxos) {
      if (selectedAmount >= transferAmount) break;
      const tokenAsset = utxo.output.amount.find((a) => a.unit === unit);
      if (tokenAsset) {
        selectedUtxos.push(utxo);
        selectedAmount += Number(tokenAsset.quantity);
      }
    }

    const returningAmount = selectedAmount - transferAmount;

    const registryProof = conStr0([integer(1)]);
    const programmableLogicGlobalRedeemer = conStr0([list([registryProof])]);
    const spendingRedeemer = conStr0([]);
    const tokenDatum = conStr0([]);

    const recipientAssets: Asset[] = [
      { unit: "lovelace", quantity: "1300000" },
      { unit: unit, quantity: transferAmount.toString() },
    ];

    const returningAssets: Asset[] = [
      { unit: "lovelace", quantity: "1300000" },
    ];
    if (returningAmount > 0) {
      returningAssets.push({
        unit: unit,
        quantity: returningAmount.toString(),
      });
    }

    const txBuilder = new MeshTxBuilder({
      fetcher: this.provider,
      submitter: this.provider as unknown as ISubmitter,
      evaluator: this.provider as unknown as IEvaluator,
      verbose: true,
    });

    for (const utxo of selectedUtxos) {
      txBuilder
        .spendingPlutusScriptV3()
        .txIn(utxo.input.txHash, utxo.input.outputIndex)
        .txInScript(logicBase.cbor)
        .txInRedeemerValue(spendingRedeemer, "JSON")
        .txInInlineDatumPresent();
    }

    txBuilder
      .withdrawalPlutusScriptV3()
      .withdrawal(transferAddress, "0")
      .withdrawalScript(transferLogicPlutusScript.code)
      .withdrawalRedeemerValue(transferRedeemerValue, "JSON")
      .withdrawalPlutusScriptV3()
      .withdrawal(logicGlobal.reward_address, "0")
      .withdrawalScript(logicGlobal.cbor)
      .withdrawalRedeemerValue(programmableLogicGlobalRedeemer, "JSON")
      .requiredSignerHash(senderCredential!.toString())
      .txOut(changeAddress, [
        {
          unit: "lovelace",
          quantity: "1000000",
        },
      ]);

    if (returningAmount > 0) {
      txBuilder
        .txOut(senderAddress, returningAssets)
        .txOutInlineDatumValue(tokenDatum, "JSON");
    }

    txBuilder
      .txOut(targetAddress, recipientAssets)
      .txOutInlineDatumValue(tokenDatum, "JSON")
      .readOnlyTxInReference(
        protocolParamsUtxo.input.txHash,
        protocolParamsUtxo.input.outputIndex
      )
      .readOnlyTxInReference(
        tokenRegistry.input.txHash,
        tokenRegistry.input.outputIndex
      )
      .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
      .selectUtxosFrom(walletUtxos)
      .changeAddress(changeAddress);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  };

  blacklistToken = async (): Promise<void> => {
    throw new Error("blacklistToken is not yet implemented");
  };
}
