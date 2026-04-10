import { useState } from "react";
import { useWallet, useAddress } from "@meshsdk/react";
import { resolveSmartWalletAddress } from "@meshsdk/contract";
import { TransactionResultPanel } from "./TransactionResultPanel";
import { handleTransaction } from "../lib/tx-handler";
import { getContract } from "../lib/contract";
import { deserializeAddress } from "@meshsdk/core";

export const MintTokens = () => {
  const { wallet, connected } = useWallet();
  const address = useAddress();
  
  const [formData, setFormData] = useState({
    assetName: "",
    quantity: "1",
    recipientAddress: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !wallet || !address) {
      setError("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    try {
      const contract = getContract(wallet);
      const recipientAddress = formData.recipientAddress || address;
      const smartAddress = await resolveSmartWalletAddress(recipientAddress, 0);
      const issuerAdminPkh = deserializeAddress(address).pubKeyHash;

      const txHex = await contract.mintToken(
        formData.assetName,
        formData.quantity,
        issuerAdminPkh,
        smartAddress
      );

      if (txHex) {
        await handleTransaction(
          Promise.resolve(txHex),
          wallet,
          { setIsLoading, setTxHash, setError },
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint tokens");
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
        <h3 className="text-2xl font-bold text-blue-900 mb-6">Mint Tokens</h3>
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
            className="w-full bg-gradient-to-r from-blue-800 to-sky-50 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-sky-400 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Mint Tokens"}
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
