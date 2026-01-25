"use client";

import { useState } from "react";
import { HeroPanel } from "@/components/HeroPanel";
import { RegisterToken } from "@/components/RegisterToken";
import { MintTokens } from "@/components/MintTokens";
import { TransferToken } from "@/components/TransferToken";
import { SeizeToken } from "@/components/SeizeToken";
import { FreezeToken } from "@/components/FreezeToken";
import { Blacklist } from "@/components/Blacklist";

type TabType =
  | "register"
  | "mint"
  | "transfer"
  | "seize"
  | "freeze"
  | "blacklist";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("register");

  const tabs = [
    { 
      id: "register" as TabType, 
      label: "Register", 
      activeColor: "from-blue-900 to-blue-700",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
    { 
      id: "mint" as TabType, 
      label: "Mint", 
      activeColor: "from-blue-800 to-sky-500",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
    { 
      id: "transfer" as TabType, 
      label: "Transfer", 
      activeColor: "from-sky-600 to-blue-600",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
    { 
      id: "seize" as TabType, 
      label: "Seize", 
      activeColor: "from-blue-900 to-sky-600",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
    { 
      id: "freeze" as TabType, 
      label: "Freeze", 
      activeColor: "from-sky-500 to-blue-700",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
    { 
      id: "blacklist" as TabType, 
      label: "Blacklist", 
      activeColor: "from-blue-800 to-sky-400",
      inactiveColor: "bg-white text-blue-800 hover:bg-sky-50 border border-blue-200"
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "register":
        return <RegisterToken />;
      case "mint":
        return <MintTokens />;
      case "transfer":
        return <TransferToken />;
      case "seize":
        return <SeizeToken />;
      case "freeze":
        return <FreezeToken />;
      case "blacklist":
        return <Blacklist />;
      default:
        return <RegisterToken />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-r from-white via-sky-50 to-sky-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-linear-to-r from-blue-900 via-blue-700 to-sky-600 bg-clip-text text-transparent mb-3">
            Programmable Tokens
          </h1>
          <p className="text-xl text-blue-800">
            CIP-113 Token Management Interface
          </p>
        </div>

        {/* Hero Panel */}
        <div className="mb-8">
          <HeroPanel />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 border-2 border-blue-200">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-lg font-semibold transition-all ${
                  activeTab === tab.id
                    ? `bg-linear-to-r ${tab.activeColor} text-white shadow-lg transform scale-105`
                    : tab.inactiveColor
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">{renderContent()}</div>

        {/* Footer */}
        <div className="text-center text-blue-700 text-sm">
          <p>Programmable Tokens Interface - UI Only (No Transaction Logic)</p>
        </div>
      </div>
    </div>
  );
}
