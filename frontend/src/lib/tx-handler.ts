import { IWallet } from "@meshsdk/core";

export interface TxCallbacks {
  setIsLoading: (b: boolean) => void;
  setTxHash: (s: string | null) => void;
  setError: (s: string | null) => void;
}

/**
 * Cleanly handle a transaction request from the UI.
 * This takes an unsigned transaction (Promise), prompts for signing, 
 * submits, and manages all React component state.
 */
export const handleTransaction = async (
  txPromise: Promise<string>,
  wallet: IWallet,
  { setIsLoading, setTxHash, setError }: TxCallbacks,
  partialSign?: boolean,
): Promise<string | null> => {
  setIsLoading(true);
  setError(null);
  setTxHash(null);

  try {
    const unsignedTx = await txPromise;
    const signedTx = await wallet.signTx(unsignedTx, partialSign);
    const hash = await wallet.submitTx(signedTx);
    
    // Ensure hash is a string and not an object/null
    const hashString = typeof hash === 'string' ? hash : String(hash);
    if (hashString && hashString !== '[object Object]') {
      setTxHash(hashString);
      return hashString;
    } else {
      throw new Error("Invalid transaction hash received");
    }
  } catch (err: unknown) {
    console.error("Transaction Error:", err);
    setError(err instanceof Error ? err.message : "Failed to execute transaction");
    return null;
  } finally {
    setIsLoading(false);
  }
};
