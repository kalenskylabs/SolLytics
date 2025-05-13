"use client"

import { cn } from "@/lib/utils"
import {
  BarChart3,
  History,
  Network,
  Wallet,
  TrendingUp,
  Activity,
  Grid3X3,
  Shield,
  Search,
  LogOut,
} from "lucide-react"
import { SolanaPriceWidget } from "@/components/solana-price-widget"
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navigation = [
  { id: "overview", name: "Overview", icon: BarChart3 },
  { id: "analytics", name: "Analytics", icon: Activity },
  { id: "transactions", name: "Transactions", icon: History },
  { id: "graph", name: "Network Graph", icon: Network },
  { id: "portfolio", name: "Portfolio", icon: Wallet },
  { id: "nfts", name: "NFTs", icon: Grid3X3 },
  { id: "reputability", name: "Reputability", icon: Shield },
  { id: "check-ca", name: "Check CA", icon: Search },
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { walletAddress, disconnect } = useWallet()

  return (
    <div className="fixed left-0 top-0 h-full w-56 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800/50 flex flex-col">
      <div className="p-4 flex-1">
        <div className="flex items-center space-x-2 mb-6">
          <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Sollytics</span>
        </div>

        {/* Wallet Info */}
        <div className="mb-6 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wallet className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xs font-medium text-blue-400">Connected</p>
                <p className="text-xs text-slate-400 truncate w-24">
                  {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
            >
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-200",
                  activeTab === item.id
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{item.name}</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-6 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Sollytics</span>
          </div>
          <p className="text-xs text-slate-400">Enhanced transaction parsing and real-time data</p>
        </div>
      </div>

      {/* Live Solana Price Widget */}
      <div className="p-3">
        <SolanaPriceWidget />
      </div>
    </div>
  )
}
