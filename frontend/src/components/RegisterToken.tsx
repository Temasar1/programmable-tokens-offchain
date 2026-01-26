import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { register_programmable_token } from "../../../offchain/transactions/type-1";
import ProtocolBootstrapParams from "../../../offchain/protocol.json";
import { TransactionResultPanel } from "./TransactionResultPanel";

export const RegisterToken = () => {
  const { wallet, connected } = useWallet();
  const [formData, setFormData] = useState({
    assetName: "",
    quantity: "1",
    subStandardName: "issuance" as "issuance" | "transfer",
    recipientAddress: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !wallet) {
      setError("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Get unsigned transaction using type-1 function
      const unsignedTx = await register_programmable_token(
        formData.assetName,
        formData.quantity,
        ProtocolBootstrapParams,
        formData.subStandardName,
        wallet,
        0, // Network_id: 0 for preview/testnet
        formData.recipientAddress || null
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
      console.error("Error registering token:", err);
      setError(err instanceof Error ? err.message : "Failed to register token");
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
        <h3 className="text-2xl font-bold text-blue-900 mb-6">Register Token</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Asset Name
            </label>
            <input
              type="text"
              value={formData.assetName}
              onChange={(e) =>
                setFormData({ ...formData, assetName: e.target.value })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="MyToken"
              required
            />
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
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Sub Standard Name
            </label>
            <select
              value={formData.subStandardName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  subStandardName: e.target.value as "issuance" | "transfer",
                })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="issuance">Issuance</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Recipient Address (optional)
            </label>
            <input
              type="text"
              value={formData.recipientAddress}
              onChange={(e) =>
                setFormData({ ...formData, recipientAddress: e.target.value })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="addr1..."
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !connected}
            className="w-full bg-gradient-to-r from-blue-900 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-800 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Register Token"}
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
