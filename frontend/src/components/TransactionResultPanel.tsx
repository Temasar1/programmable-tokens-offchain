import { useEffect } from "react";

interface TransactionResultPanelProps {
  txHash: string | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export const TransactionResultPanel = ({
  txHash,
  error,
  isLoading,
  onClose,
}: TransactionResultPanelProps) => {
  useEffect(() => {
    if (txHash || error) {
      const timer = setTimeout(() => {
        // Auto-close after 10 seconds if successful
        if (txHash) {
          onClose();
        }
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [txHash, error, onClose]);

  if (!txHash && !error && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h3 className="text-xl font-bold text-blue-900 text-center mb-2">
            Processing Transaction
          </h3>
          <p className="text-gray-600 text-center">
            Please wait while we process your transaction...
          </p>
        </div>
      </div>
    );
  }

  // Ensure we only render valid content
  const renderContent = () => {
    if (txHash && typeof txHash === 'string') {
      return (
        <>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-green-600 text-center mb-4">
              Transaction Successful!
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Hash:
              </label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-xs font-mono text-gray-800 break-all">
                  {String(txHash)}
                </code>
                <button
                  onClick={() => {
                    if (txHash && typeof txHash === 'string') {
                      navigator.clipboard.writeText(txHash);
                    }
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <a
                href={`https://preview.cardanoscan.io/transaction/${String(txHash)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
              >
                View on Cardanoscan
              </a>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        );
    }
    
    if (error && typeof error === 'string') {
      return (
        <>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-red-600 text-center mb-4">
            Transaction Failed
          </h3>
          <div className="bg-red-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{String(error)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        {renderContent()}
      </div>
    </div>
  );
};
