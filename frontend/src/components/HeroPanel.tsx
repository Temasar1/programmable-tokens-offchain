"use client";

import { useWallet } from "@meshsdk/react";
import { useEffect, useState } from "react";
import getBalance, { TokenBalance } from "../lib/balance";
import provider from "../lib/provider";

export const HeroPanel = () => {
  const { wallet, connected, address } = useWallet();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [adaBalance, setAdaBalance] = useState<string>("0");
  const [adaBalanceFormatted, setAdaBalanceFormatted] = useState<string>("0");
  const [senderBaseAddress, setSenderBaseAddress] = useState<string>("");
  useEffect(() => {
    const fetchTokens = async () => {
      if (!connected || !wallet || !address) {
        setTokens([]);
        setTotalTokens(0);
        setAdaBalance("0");
        setAdaBalanceFormatted("0");
        return;
      }

      setLoading(true);
      try {
        const balanceResult = await getBalance(provider, address);
        setTokens(balanceResult.tokens);
        setTotalTokens(balanceResult.tokens.filter(t => t.unit !== "lovelace").length);
        setAdaBalance(balanceResult.adaBalance);
        setAdaBalanceFormatted(balanceResult.adaBalanceFormatted);
        setSenderBaseAddress(balanceResult.senderBaseAddress);
      } catch (error) {
        console.error("Error fetching tokens:", error);
        setTokens([]);
        setTotalTokens(0);
        setAdaBalance("0");
        setAdaBalanceFormatted("0");
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [connected, wallet, address]);

  if (!connected) {
    return (
      <div className="bg-linear-to-r from-blue-900 via-blue-700 to-sky-600 rounded-2xl p-8 shadow-2xl border-2 border-blue-800">
        <div className="text-center text-white">
          <h2 className="text-3xl font-bold mb-2">Programmable Tokens</h2>
          <p className="text-sky-100 mb-4">Connect your wallet to view your token balance</p>
          <div className="mt-6">
            <div className="text-5xl font-bold mb-2">-</div>
            <div className="text-lg text-sky-200">Tokens in Wallet</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-linear-to-r from-blue-900 via-blue-700 to-sky-600 rounded-2xl p-8 shadow-2xl border-2 border-blue-800">
        <div className="text-center text-white">
          <h2 className="text-3xl font-bold mb-2">Programmable Tokens</h2>
          <p className="text-sky-100">Loading...</p>
        </div>
      </div>
    );
  }

  const nonAdaTokens = tokens.filter(t => t.unit !== "lovelace");

  return (
    <div className="bg-linear-to-r from-blue-900 via-blue-700 to-sky-600 rounded-2xl p-8 shadow-2xl border-2 border-blue-800">
      <div className="text-white">
        <h2 className="text-3xl font-bold mb-2">Programmable Tokens</h2>
        <p className="text-sky-100 mb-6">Your wallet balance</p>
        <p className="text-sky-100 mb-6">Smart wallet address: {senderBaseAddress}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="text-4xl font-bold mb-1">{parseFloat(adaBalanceFormatted).toLocaleString()}</div>
            <div className="text-sm text-sky-200">ADA Balance</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="text-4xl font-bold mb-1">{totalTokens}</div>
            <div className="text-sm text-sky-200">Token Types</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="text-4xl font-bold mb-1">
              {tokens.length > 0 ? (
                <span className="inline-block w-8 h-8 rounded-full bg-sky-400 border-2 border-white"></span>
              ) : (
                <span className="inline-block w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></span>
              )}
            </div>
          </div>
        </div>

        {nonAdaTokens.length > 0 && (
          <div className="mt-6 max-h-48 overflow-y-auto">
            <div className="space-y-2">
              {nonAdaTokens.slice(0, 5).map((token, index) => (
                <div
                  key={token.unit || index}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 flex justify-between items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{token.assetName || "Unknown Token"}</div>
                    <div className="text-xs text-sky-200 truncate">
                      {token.policyId ? `${token.policyId.substring(0, 20)}...` : token.unit.substring(0, 20) + "..."}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="font-bold">{parseInt(token.quantity).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {nonAdaTokens.length > 5 && (
                <div className="text-center text-sky-200 text-sm">
                  +{nonAdaTokens.length - 5} more tokens
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
