import { useState } from "react";
import { mint_programmable_tokens } from "../../../offchain/transactions/type-1/mint";
import ProtocolBootstrapParams from "../../../offchain/protocol.json";

export const MintTokens = () => {
  const [formData, setFormData] = useState({
    assetName: "",
    quantity: "1",
    mintingLogicScript: "",
    transferLogicScript: "",
    transferRedeemerValue: "{}",
    recipientAddress: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Mint Tokens:", formData);
    mint_programmable_tokens(ProtocolBootstrapParams, formData.assetName, formData.quantity, 0, formData.recipientAddress);
  };

  return (
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
          className="w-full bg-linear-to-r from-blue-800 to-sky-500 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-sky-400 transition-all shadow-lg hover:shadow-xl"
        >
          Mint Tokens
        </button>
      </form>
    </div>
  );
};
