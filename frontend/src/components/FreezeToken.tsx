import { useState } from "react";

export const FreezeToken = () => {
  const [formData, setFormData] = useState({
    unit: "",
    targetAddress: "",
    thirdPartyLogicScript: "",
    redeemerValue: "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Freeze Token:", formData);
    // UI only - no transaction logic
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      <h3 className="text-2xl font-bold text-blue-900 mb-6">Freeze Token</h3>
      <p className="text-sm text-blue-700 mb-4">
        Freeze tokens at a specified address (prevents transfers)
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
            Target Address (to freeze)
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
          className="w-full bg-gradient-to-r from-sky-500 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-sky-400 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
        >
          Freeze Token
        </button>
      </form>
    </div>
  );
};
