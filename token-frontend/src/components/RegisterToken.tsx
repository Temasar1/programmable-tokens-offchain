import { useState } from "react";

export const RegisterToken = () => {
  const [formData, setFormData] = useState({
    assetName: "",
    mintingLogicScript: "",
    transferLogicScript: "",
    transferRedeemerValue: "{}",
    recipientAddress: "",
    globalStateLogicScript: "",
    thirdPartyLogicScript: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Register Token:", formData);
    // UI only - no transaction logic
  };

  return (
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Minting Logic Script (CBOR Hex)
          </label>
          <textarea
            value={formData.mintingLogicScript}
            onChange={(e) =>
              setFormData({ ...formData, mintingLogicScript: e.target.value })
            }
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="590820..."
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

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Global State Logic Script (optional)
          </label>
          <textarea
            value={formData.globalStateLogicScript}
            onChange={(e) =>
              setFormData({ ...formData, globalStateLogicScript: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="590820..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-800 mb-2">
            Third Party Logic Script (optional)
          </label>
          <textarea
            value={formData.thirdPartyLogicScript}
            onChange={(e) =>
              setFormData({ ...formData, thirdPartyLogicScript: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            placeholder="590820..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-linear-to-r from-blue-900 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-800 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
        >
          Register Token
        </button>
      </form>
    </div>
  );
};
