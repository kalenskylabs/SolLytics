"use client"

import { useState } from "react"
import { WalletSearch } from "@/components/wallet-search"
import { WalletOverview } from "@/components/wallet-overview"
import { TransactionHistory } from "@/components/transaction-history"
import { TransactionGraph } from "@/components/transaction-graph"
import { TokenPortfolio } from "@/components/token-portfolio"
import { Sidebar } from "@/components/sidebar"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { NFTSummary } from "@/components/nft-summary"
import { ReputabilityDashboard } from "@/components/reputability-dashboard"
import { CheckCADashboard } from "@/components/check-ca-dashboard"

export default function HomePage() {
  const [selectedWallet, setSelectedWallet] = useState<string>("")
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      <div className="flex">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 p-4 ml-56">
          <div className="max-w-full mx-auto space-y-4">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent mb-1">
                Sollytics
              </h1>
              <p className="text-slate-400 text-base">Advanced wallet analytics powered by Sollytics</p>
            </div>

            {/* Show different interfaces based on active tab */}
            {activeTab === "reputability" ? (
              <ReputabilityDashboard />
            ) : activeTab === "check-ca" ? (
              <CheckCADashboard />
            ) : (
              <>
                <WalletSearch onWalletSelect={setSelectedWallet} />
                {selectedWallet && (
                  <div className="space-y-4">
                    {activeTab === "overview" && <WalletOverview wallet={selectedWallet} />}
                    {activeTab === "analytics" && <AnalyticsDashboard wallet={selectedWallet} />}
                    {activeTab === "transactions" && <TransactionHistory wallet={selectedWallet} />}
                    {activeTab === "graph" && <TransactionGraph wallet={selectedWallet} />}
                    {activeTab === "portfolio" && <TokenPortfolio wallet={selectedWallet} />}
                    {activeTab === "nfts" && <NFTSummary wallet={selectedWallet} />}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
