import { useState, useEffect } from "react";
import { useWallet, useAddress } from "@meshsdk/react";
import { resolveSmartWalletAddress } from "@meshsdk/contract";
import { TransactionResultPanel } from "./TransactionResultPanel";
import getBalance, { TokenBalance } from "../lib/balance";
import provider from "../lib/provider";
import { handleTransaction } from "../lib/tx-handler";
import { getContract } from "../lib/contract";
import { deserializeAddress } from "@meshsdk/core";

export const BurnToken = () => {
  const { wallet, connected } = useWallet();
  const address = useAddress();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [formData, setFormData] = useState({
    selectedToken: "",
    quantity: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokens = async () => {
      if (!connected || !wallet || !address) {
        setTokens([]);
        return;
      }

      setLoadingTokens(true);
      try {
        const balanceResult = await getBalance(provider, address);
        const nonAdaTokens = balanceResult.tokens.filter(
          (t) => t.unit !== "lovelace",
        );
        setTokens(nonAdaTokens);
      } catch (err) {
        console.error("Error fetching tokens:", err);
        setTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [connected, wallet, address]);

  const selectedToken = tokens.find((t) => t.unit === formData.selectedToken);
  const availableQuantity = selectedToken
    ? parseInt(selectedToken.quantity)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !wallet || !address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!formData.selectedToken || !selectedToken) {
      setError("Please select a token");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const contract = getContract(wallet);
      const issuerAdminPkh = deserializeAddress(address).pubKeyHash;

      // 1. Resolve smart wallet and fetch UTxO for the token
      const smartWalletAddr = await resolveSmartWalletAddress(address, 0);
      const utxos = await provider.fetchAddressUTxOs(smartWalletAddr);
      const utxoToBurn = utxos.find((u) =>
        u.output.amount.some((a) => a.unit === selectedToken.unit),
      );

      if (!utxoToBurn || !selectedToken) {
        throw new Error("Target token UTxO not found in smart wallet");
      }

      // 2. Call contract method
      const txHex = await contract.burnToken(
        selectedToken.assetName || "",
        formData.quantity,
        utxoToBurn.input.txHash,
        utxoToBurn.input.outputIndex,
        issuerAdminPkh
      );

      if (txHex) {
        await handleTransaction(
          Promise.resolve(txHex),
          wallet,
          { setIsLoading, setTxHash, setError },
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to burn tokens");
      setIsLoading(false);
    }
  };


  const handleCloseResult = () => {
    setTxHash(null);
    setError(null);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
        <h3 className="text-2xl font-bold text-orange-900 mb-6">Burn Tokens</h3>
        <p className="text-sm text-orange-700 mb-4">
          Permanently destroy programmable tokens. Only tokens in your smart
          wallet can be burned.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-orange-800 mb-2">
              Select Token
            </label>
            {loadingTokens ? (
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading tokens...
              </div>
            ) : tokens.length === 0 ? (
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                No tokens available. Connect your wallet to see tokens.
              </div>
            ) : (
              <>
                <select
                  value={formData.selectedToken}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      selectedToken: e.target.value,
                      quantity: "",
                    })
                  }
                  className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                  required
                >
                  <option value="">-- Select a token --</option>
                  {tokens.map((token) => (
                    <option key={token.unit} value={token.unit}>
                      {token.assetName || "Unknown Token"} (
                      {parseInt(token.quantity).toLocaleString()} available)
                    </option>
                  ))}
                </select>
                {selectedToken && (
                  <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-xs text-orange-800 space-y-1">
                      <div>
                        <span className="font-semibold">Policy ID:</span>{" "}
                        <span className="font-mono break-all">
                          {selectedToken.policyId}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Available:</span>{" "}
                        {parseInt(selectedToken.quantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-orange-800 mb-2">
              Quantity to Burn
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              min="1"
              max={availableQuantity}
              className="w-full px-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="1"
              required
              disabled={!selectedToken}
            />
            {selectedToken && (
              <p className="mt-1 text-xs text-orange-600">
                Maximum: {availableQuantity.toLocaleString()} tokens
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !connected || !selectedToken}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-lg font-semibold hover:from-orange-500 hover:to-red-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Burn Tokens"}
          </button>
        </form>
      </div>
      <TransactionResultPanel
        txHash={txHash}
        error={error}
        isLoading={isLoading}
        onClose={handleCloseResult}
      />
    </>
  );
};
