import { useState, useEffect } from "react";
import { useWallet } from "@meshsdk/react";
import { transfer_programmable_token } from "../../../offchain/transactions/type-1";
import ProtocolBootstrapParams from "../../../offchain/protocol.json";
import { TransactionResultPanel } from "./TransactionResultPanel";
import getBalance, { TokenBalance } from "../lib/balance";
import provider from "../lib/provider";

export const TransferToken = () => {
  const { wallet, connected, address } = useWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [formData, setFormData] = useState({
    selectedToken: "",
    quantity: "",
    recipientAddress: "",
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
        // Filter out ADA/lovelace tokens
        const nonAdaTokens = balanceResult.tokens.filter(t => t.unit !== "lovelace");
        setTokens(nonAdaTokens);
      } catch (error) {
        console.error("Error fetching tokens:", error);
        setTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [connected, wallet, address]);

  const selectedToken = tokens.find(t => t.unit === formData.selectedToken);
  const availableQuantity = selectedToken ? parseInt(selectedToken.quantity) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !wallet) {
      setError("Please connect your wallet first");
      return;
    }

    if (!formData.selectedToken) {
      setError("Please select a token");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Get unsigned transaction using type-1 function
      // formData.selectedToken is the full unit (policy ID + asset name hex)
      const unsignedTx = await transfer_programmable_token(
        formData.selectedToken,
        formData.quantity,
        formData.recipientAddress,
        ProtocolBootstrapParams,
        0, // Network_id: 0 for preview/testnet
        wallet
      );

      // Sign and submit
      const signedTx = await wallet.signTx(unsignedTx);
      const hash = await wallet.submitTx(signedTx);
      
      // Ensure hash is a string and not an object
      const hashString = typeof hash === 'string' ? hash : String(hash);
      if (hashString && hashString !== '[object Object]') {
        setTxHash(hashString);
        console.log("Tx Hash:", hashString);
      } else {
        throw new Error("Invalid transaction hash received");
      }
    } catch (err: unknown) {
      console.error("Error transferring token:", err);
      setError(err instanceof Error ? err.message : "Failed to transfer token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseResult = () => {
    setTxHash(null);
    setError(null);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
        <h3 className="text-2xl font-bold text-blue-900 mb-6">Transfer Token</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
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
                    setFormData({ ...formData, selectedToken: e.target.value, quantity: "" })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  required
                >
                  <option value="">-- Select a token --</option>
                  {tokens.map((token) => (
                    <option key={token.unit} value={token.unit}>
                      {token.assetName || "Unknown Token"} ({parseInt(token.quantity).toLocaleString()} available)
                    </option>
                  ))}
                </select>
                {selectedToken && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-800 space-y-1">
                      <div>
                        <span className="font-semibold">Policy ID:</span>{" "}
                        <span className="font-mono break-all">{selectedToken.policyId}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Asset Name (Hex):</span>{" "}
                        <span className="font-mono break-all">
                          {selectedToken.unit.substring(56)}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Available Quantity:</span>{" "}
                        {parseInt(selectedToken.quantity).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-semibold">Full Unit:</span>{" "}
                        <span className="font-mono break-all text-xs">{selectedToken.unit}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Quantity
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              min="1"
              max={availableQuantity}
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1"
              required
              disabled={!selectedToken}
            />
            {selectedToken && (
              <p className="mt-1 text-xs text-blue-600">
                Maximum: {availableQuantity.toLocaleString()} tokens
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={formData.recipientAddress}
              onChange={(e) =>
                setFormData({ ...formData, recipientAddress: e.target.value })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="addr1..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !connected}
            className="w-full bg-gradient-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-500 hover:to-blue-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Transfer Token"}
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
