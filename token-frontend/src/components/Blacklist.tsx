import { useState } from "react";

export const Blacklist = () => {
  const [formData, setFormData] = useState({
    address: "",
    action: "add" as "add" | "remove",
    thirdPartyLogicScript: "",
    redeemerValue: "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Blacklist Action:", formData);
    // UI only - no transaction logic
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
      <h3 className="text-2xl font-bold text-blue-900 mb-6">Blacklist Management</h3>
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
          className={`w-full text-white py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl ${
            formData.action === "add"
              ? "bg-linear-to-r from-blue-800 to-sky-400 hover:from-blue-700 hover:to-sky-300"
              : "bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500"
          }`}
        >
          {formData.action === "add" ? "Add to Blacklist" : "Remove from Blacklist"}
        </button>
      </form>
    </div>
  );
};
