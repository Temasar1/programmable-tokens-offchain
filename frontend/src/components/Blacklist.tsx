import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { addToBlacklist } from "../../../offchain/transactions/type-1/addBlacklist";
import { removeFromBlacklist } from "../../../offchain/transactions/type-1/removeBlacklist";
import BlacklistBootstrapJson from "../../../offchain/blacklist.json";
import { BlacklistBootstrap } from "../../../offchain/types";
import { TransactionResultPanel } from "./TransactionResultPanel";

const blacklistBootstrap = BlacklistBootstrapJson as unknown as BlacklistBootstrap;

export const Blacklist = () => {
  const { wallet, connected } = useWallet();
  const [formData, setFormData] = useState({
    address: "",
    action: "add" as "add" | "remove",
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

    if (!formData.address) {
      setError("Please enter an address");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const unsignedTx =
        formData.action === "add"
          ? await addToBlacklist(blacklistBootstrap, formData.address, wallet, 0)
          : await removeFromBlacklist(formData.address, blacklistBootstrap, wallet, 0);

      const signedTx = await wallet.signTx(unsignedTx);
      const hash = await wallet.submitTx(signedTx);

      const hashString = typeof hash === "string" ? hash : String(hash);
      if (hashString && hashString !== "[object Object]") {
        setTxHash(hashString);
      } else {
        throw new Error("Invalid transaction hash received");
      }
    } catch (err: unknown) {
      console.error("Blacklist error:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
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
        <h3 className="text-2xl font-bold text-blue-900 mb-6">
          Blacklist Management
        </h3>
        <p className="text-sm text-blue-700 mb-4">
          Add or remove addresses from the blacklist (admin function)
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="addr1..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Action
            </label>
            <select
              value={formData.action}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  action: e.target.value as "add" | "remove",
                })
              }
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="add">Add to Blacklist</option>
              <option value="remove">Remove from Blacklist</option>
            </select>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800 space-y-1">
            <div>
              <span className="font-semibold">Admin PKH:</span>{" "}
              <span className="font-mono break-all">
                {blacklistBootstrap.blacklistMintBootstrap.adminPubKeyHash}
              </span>
            </div>
            <div>
              <span className="font-semibold">Mint Script Hash:</span>{" "}
              <span className="font-mono break-all">
                {blacklistBootstrap.blacklistMintBootstrap.scriptHash}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !connected}
            className={`w-full text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
              formData.action === "add"
                ? "bg-gradient-to-r from-blue-800 to-sky-400 hover:from-blue-700 hover:to-sky-300"
                : "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500"
            }`}
          >
            {isLoading
              ? "Processing..."
              : formData.action === "add"
              ? "Add to Blacklist"
              : "Remove from Blacklist"}
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
