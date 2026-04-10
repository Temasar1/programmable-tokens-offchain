import { useState } from "react";
import { useWallet, useAddress } from "@meshsdk/react";
import { resolveSmartWalletAddress, resolveStakeCredential } from "@meshsdk/contract";
import { TransactionResultPanel } from "./TransactionResultPanel";
import provider from "../lib/provider";
import { handleTransaction } from "../lib/tx-handler";
import { getContract } from "../lib/contract";

export const SeizeToken = () => {
  const { wallet, connected } = useWallet();
  const address = useAddress();
  const [formData, setFormData] = useState({
    unit: "",
    targetAddress: "", // Original address to seize from
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
    setError(null);

    try {
      const contract = getContract(wallet);
      const issuerAdminPkh = resolveStakeCredential(address);
      const adminSmartWallet = await resolveSmartWalletAddress(address, 0);

      // 1. Resolve smart wallet of target
      const targetSmartWallet = await resolveSmartWalletAddress(formData.targetAddress, 0);

      // 2. Fetch UTxO for the unit at target smart wallet
      const utxos = await provider.fetchAddressUTxOs(targetSmartWallet);
      const utxoToSeize = utxos.find((u) =>
        u.output.amount.some((a) => a.unit === formData.unit),
      );

      if (!utxoToSeize) {
        throw new Error("Token UTxO not found at target smart wallet");
      }

      // 3. Call contract method
      const txHex = await contract.seizeToken(
        formData.unit,
        utxoToSeize.input.txHash,
        utxoToSeize.input.outputIndex,
        issuerAdminPkh,
        adminSmartWallet
      );

      if (txHex) {
        await handleTransaction(
          Promise.resolve(txHex),
          wallet,
          { setIsLoading, setTxHash, setError },
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seize tokens");
      setIsLoading(false);
    }
  };


  const handleCloseResult = () => {
    setTxHash(null);
    setError(null);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
        <h3 className="text-2xl font-bold text-red-900 mb-6">Seize Tokens</h3>
        <p className="text-sm text-red-700 mb-4">
          Admin function: Seize programmable tokens from a blacklisted
          user&apos;s smart wallet.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-800 mb-2">
              Token Unit (Policy ID + Asset Name)
            </label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-sm"
              placeholder="a1b2c3d4..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-red-800 mb-2">
              Target User Address (to seize from)
            </label>
            <input
              type="text"
              value={formData.targetAddress}
              onChange={(e) =>
                setFormData({ ...formData, targetAddress: e.target.value })
              }
              className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="addr1..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !connected}
            className="w-full bg-gradient-to-r from-red-800 to-red-600 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Seize Tokens"}
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
