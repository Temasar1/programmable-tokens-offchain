import ProtocolBootstrapParams from "../../../offchain/protocol.json";
import { IFetcher, stringToHex } from "@meshsdk/core";
import { getSmartWalletAddress } from "../../../offchain/utils";

export interface TokenBalance {
    unit: string;
    quantity: string;
    assetName?: string;
    policyId?: string;
}

export interface BalanceResult {
    tokens: TokenBalance[];
    adaBalance: string;
    adaBalanceFormatted: string;
    smartWalletAddress: string;
    senderBaseAddress: string;
}

const getBalance = async (provider: IFetcher, walletAddress: string): Promise<BalanceResult> => {
    const networkId: 0 | 1 = walletAddress.startsWith("addr_test") ? 0 : 1;

    const smartWalletAddress = await getSmartWalletAddress(walletAddress, ProtocolBootstrapParams, networkId);

    const utxos = await provider.fetchAddressUTxOs(smartWalletAddress);
    const walletUtxos = await provider.fetchAddressUTxOs(walletAddress);
    const adaAsset = walletUtxos
        .map(utxo => utxo.output.amount.find(asset => asset.unit === "lovelace"))
        .reduce((acc, asset) => acc + (Number(asset?.quantity) || 0), 0);
    const adaBalance = adaAsset.toString();
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
            } catch {
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
        smartWalletAddress,
        senderBaseAddress: smartWalletAddress,
    };
};

export default getBalance;
