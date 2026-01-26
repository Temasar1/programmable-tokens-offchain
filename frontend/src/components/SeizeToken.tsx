import { useState } from "react";

export const SeizeToken = () => {
  const [formData, setFormData] = useState({
    unit: "",
    quantity: "",
    targetAddress: "",
    thirdPartyLogicScript: "",
    redeemerValue: "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Seize Token:", formData);
    // UI only - no transaction logic
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      <h3 className="text-2xl font-bold text-blue-900 mb-6">Seize Token</h3>
      <p className="text-sm text-blue-700 mb-4">
        Seize tokens from a specified address (admin function)
      </p>
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
            Target Address (to seize from)
          </label>
          <input
            type="text"
            value={formData.targetAddress}
            onChange={(e) =>
              setFormData({ ...formData, targetAddress: e.target.value })
            }
            className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="addr1..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Third Party Logic Script (CBOR Hex)
          </label>
          <textarea
            value={formData.thirdPartyLogicScript}
            onChange={(e) =>
              setFormData({ ...formData, thirdPartyLogicScript: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="590820..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Redeemer (JSON)
          </label>
          <textarea
            value={formData.redeemerValue}
            onChange={(e) =>
              setFormData({ ...formData, redeemerValue: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder='{"fields": [], "constructor": 0}'
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-900 to-sky-600 text-white py-3 rounded-lg font-semibold hover:from-blue-800 hover:to-sky-500 transition-all shadow-lg hover:shadow-xl"
        >
          Seize Token
        </button>
      </form>
    </div>
  );
};
