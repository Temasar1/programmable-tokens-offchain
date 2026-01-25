import { useState } from "react";

export const TransferToken = () => {
  const [formData, setFormData] = useState({
    unit: "",
    quantity: "",
    recipientAddress: "",
    transferLogicScript: "",
    transferRedeemerValue: "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Transfer Token:", formData);
    // UI only - no transaction logic
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      <h3 className="text-2xl font-bold text-blue-900 mb-6">Transfer Token</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Token Unit (Policy ID + Asset Name)
          </label>
          <input
            type="text"
            value={formData.unit}
            onChange={(e) =>
              setFormData({ ...formData, unit: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="a1b2c3d4...MyToken"
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Transfer Logic Script (CBOR Hex)
          </label>
          <textarea
            value={formData.transferLogicScript}
            onChange={(e) =>
              setFormData({ ...formData, transferLogicScript: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="590820..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Transfer Redeemer (JSON)
          </label>
          <textarea
            value={formData.transferRedeemerValue}
            onChange={(e) =>
              setFormData({ ...formData, transferRedeemerValue: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder='{"fields": [], "constructor": 0}'
          />
        </div>

        <button
          type="submit"
          className="w-full bg-linear-to-r from-sky-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-sky-500 hover:to-blue-500 transition-all shadow-lg hover:shadow-xl"
        >
          Transfer Token
        </button>
      </form>
    </div>
  );
};
