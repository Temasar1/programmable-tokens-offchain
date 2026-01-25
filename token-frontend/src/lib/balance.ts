import { buildBaseAddress, CredentialType, deserializeAddress, Hash28ByteBase16 } from "@meshsdk/core-cst";
import ProtocolBootstrapParams from "../../../offchain/protocol.json";
import { IFetcher, stringToHex } from "@meshsdk/core";
import { Cip113_scripts_standard } from "../../../offchain/deployment/standard";

export interface TokenBalance {
    unit: string;
    quantity: string;
    assetName?: string;
    policyId?: string;
}

export interface BalanceResult {
    tokens: TokenBalance[];
    adaBalance: string;
    adaBalanceFormatted: string; // in ADA
    senderBaseAddress: string;
}

const getBalance = async (provider: IFetcher, walletAddress: string): Promise<BalanceResult> => {
    const sender_credential = deserializeAddress(walletAddress).asBase()
        ?.getStakeCredential().hash;

    if (!ProtocolBootstrapParams.programmableLogicBaseParams.scriptHash) {
        throw new Error("Protocol bootstrap params are required");
    }
    const standardScript = new Cip113_scripts_standard(0);
    const logic_base = await standardScript.programmable_logic_base(ProtocolBootstrapParams);

    const senderBaseAddress = buildBaseAddress(
        0,
        logic_base.policyId as Hash28ByteBase16,
        sender_credential!,
        CredentialType.ScriptHash,
        CredentialType.KeyHash,
    );

    const utxos = await provider.fetchAddressUTxOs(senderBaseAddress.toAddress().toBech32());
    const walletUtxos = await provider.fetchAddressUTxOs(walletAddress);

    let adaBalance = "0";
    const adaAsset = walletUtxos.map(utxo => utxo.output.amount.find(asset => asset.unit === "lovelace"))
    .reduce((acc, asset) => acc + (Number(asset?.quantity) || 0), 0);
    const adaBalanceFormatted = (adaAsset / 1_000_000).toString();

    const tokenBalances: TokenBalance[] = [];
    const tokenMap = new Map<string, { quantity: bigint; unit: string }>();

    utxos.forEach((utxo) => {
        utxo.output.amount.forEach((amount) => {
            if (amount.unit !== "lovelace") {
                const existing = tokenMap.get(amount.unit);
                if (existing) {
                    existing.quantity += BigInt(amount.quantity);
                } else {
                    tokenMap.set(amount.unit, {
                        quantity: BigInt(amount.quantity),
                        unit: amount.unit,
                    });
                }
            }
        });
    });

    // Convert to TokenBalance format
    tokenMap.forEach((value, unit) => {
        const policyId = unit.substring(0, 56);
        const assetNameHex = stringToHex(unit.substring(56));

        // Try to decode asset name from hex
        let assetName = assetNameHex;
        if (unit.substring(56)) {
            try {
                // Convert hex to string (browser-compatible)
                const hexString = unit.substring(56);
                let decoded = '';
                for (let i = 0; i < hexString.length; i += 2) {
                    const charCode = parseInt(hexString.substring(i, i + 2), 16);
                    if (charCode > 0 && charCode < 127) {
                        decoded += String.fromCharCode(charCode);
                    }
                }
                assetName = decoded.trim() || assetNameHex;
            } catch (e) {
                assetName = assetNameHex;
            }
        }

        tokenBalances.push({
            unit,
            quantity: value.quantity.toString(),
            assetName: assetName || assetNameHex,
            policyId,
        });
    });

    // Also include ADA in the tokens list for display
    if (adaBalance !== "0") {
        tokenBalances.unshift({
            unit: "lovelace",
            quantity: adaBalance,
            assetName: "ADA",
            policyId: undefined,
        });
    }

    return {
        tokens: tokenBalances,
        adaBalance,
        adaBalanceFormatted,
        senderBaseAddress: senderBaseAddress.toAddress().toBech32(),
    };
};

export default getBalance;