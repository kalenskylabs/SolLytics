"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Activity,
  Coins,
  BarChart3,
} from "lucide-react"
import { heliusAPI } from "@/lib/helius-api"

interface AnalyticsData {
  inflowOutflow: {
    inflow: number
    outflow: number
    netChange: number
    inflowTxCount: number
    outflowTxCount: number
  }
  fees: {
    total: number
    average: number
    highest: number
    count: number
  }
  categories: Record<string, number>
  topTokens: Array<{
    symbol: string
    count: number
    volume: number
    mint: string
  }>
  timeframe: {
    days: number
    totalTransactions: number
  }
}

interface AnalyticsDashboardProps {
  wallet: string
}

export function AnalyticsDashboard({ wallet }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!wallet || wallet.trim() === "") {
        setError("Please enter a valid wallet address")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log("Fetching analytics for wallet:", wallet)

        const transactions = await heliusAPI.getTransactionHistory(wallet, 50)

        console.log(`Successfully fetched ${transactions.length} transactions`)

        // Initialize analytics data
        let totalInflow = 0
        let totalOutflow = 0
        let inflowTxCount = 0
        let outflowTxCount = 0
        let totalFees = 0
        let highestFee = 0
        const categories: Record<string, number> = {}
        const tokenActivity: Record<string, { count: number; volume: number; mint: string }> = {}

        // Analyze each transaction
        transactions.forEach((tx: any) => {
          // Fee analysis
          const fee = tx.fee / 1000000000
          totalFees += fee
          if (fee > highestFee) highestFee = fee

          // Transaction categorization
          let category = "Other"
          if (tx.type === "SWAP" || tx.description?.toLowerCase().includes("swap")) {
            category = "Swap"
          } else if (tx.type === "TRANSFER" || tx.nativeTransfers?.length > 0) {
            category = "Transfer"
          } else if (tx.description?.toLowerCase().includes("stake")) {
            category = "Staking"
          } else if (tx.events?.nft || tx.type?.includes("NFT")) {
            category = "NFT"
          } else if (tx.description?.toLowerCase().includes("vote")) {
            category = "Governance"
          } else if (tx.instructions?.some((inst: any) => inst.programId === "11111111111111111111111111111111")) {
            category = "System"
          }

          categories[category] = (categories[category] || 0) + 1

          // Inflow/Outflow analysis
          if (tx.nativeTransfers) {
            tx.nativeTransfers.forEach((transfer: any) => {
              const amount = transfer.amount / 1000000000
              if (transfer.toUserAccount === wallet) {
                totalInflow += amount
                inflowTxCount += 1
              } else if (transfer.fromUserAccount === wallet) {
                totalOutflow += amount
                outflowTxCount += 1
              }
            })
          }

          // Token activity analysis
          if (tx.tokenTransfers) {
            tx.tokenTransfers.forEach((transfer: any) => {
              const symbol = transfer.symbol || "Unknown"
              const mint = transfer.mint || ""

              if (!tokenActivity[symbol]) {
                tokenActivity[symbol] = { count: 0, volume: 0, mint }
              }
              tokenActivity[symbol].count += 1
              tokenActivity[symbol].volume += transfer.tokenAmount || 0
            })
          }
        })

        // Process top tokens
        const topTokens = Object.entries(tokenActivity)
          .map(([symbol, data]) => ({ symbol, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)

        // Calculate timeframe
        const oldestTx = transactions[transactions.length - 1]
        const newestTx = transactions[0]
        const timeframeDays =
          oldestTx && newestTx ? Math.ceil((newestTx.timestamp - oldestTx.timestamp) / (24 * 60 * 60)) : 30

        setAnalytics({
          inflowOutflow: {
            inflow: totalInflow,
            outflow: totalOutflow,
            netChange: totalInflow - totalOutflow,
            inflowTxCount,
            outflowTxCount,
          },
          fees: {
            total: totalFees,
            average: totalFees / transactions.length,
            highest: highestFee,
            count: transactions.length,
          },
          categories,
          topTokens,
          timeframe: {
            days: timeframeDays,
            totalTransactions: transactions.length,
          },
        })
      } catch (error) {
        console.error("Error fetching analytics:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch analytics data")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [wallet])

  const formatSOL = (amount: number): string => {
    if (amount < 0.001) {
      return amount.toFixed(6)
    } else if (amount < 1) {
      return amount.toFixed(4)
    } else {
      return amount.toFixed(2)
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.ceil(amount * 100) / 100)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-slate-700 rounded w-1/3"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-400 mb-2">Error loading analytics</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-slate-400">No analytics data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalCategoryTx = Object.values(analytics.categories).reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-6">
      {/* Inflow/Outflow Summary */}
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Flow Analysis ({analytics.timeframe.days} days)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ArrowDownLeft className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-400">Inflow</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{formatSOL(analytics.inflowOutflow.inflow)} SOL</div>
              <p className="text-xs text-slate-400">{analytics.inflowOutflow.inflowTxCount} transactions</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ArrowUpRight className="w-4 h-4 text-red-400" />
                <span className="text-sm text-slate-400">Outflow</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{formatSOL(analytics.inflowOutflow.outflow)} SOL</div>
              <p className="text-xs text-slate-400">{analytics.inflowOutflow.outflowTxCount} transactions</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {analytics.inflowOutflow.netChange >= 0 ? (
                  <TrendingUp className="w-4 w-4 text-blue-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-orange-400" />
                )}
                <span className="text-sm text-slate-400">Net Change</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  analytics.inflowOutflow.netChange >= 0 ? "text-blue-400" : "text-orange-400"
                }`}
              >
                {analytics.inflowOutflow.netChange >= 0 ? "+" : ""}
                {formatSOL(analytics.inflowOutflow.netChange)} SOL
              </div>
              <p className="text-xs text-slate-400">≈ {formatCurrency(analytics.inflowOutflow.netChange * 148.52)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Categories */}
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Transaction Categories</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(analytics.categories)
              .sort(([, a], [, b]) => b - a)
              .map(([category, count]) => {
                const percentage = totalCategoryTx > 0 ? (count / totalCategoryTx) * 100 : 0
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{category}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 text-sm">{count} txs</span>
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Fee Summary */}
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Fee Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-sm text-slate-400">Total Fees Paid</span>
              <div className="text-2xl font-bold text-white">{formatSOL(analytics.fees.total)} SOL</div>
              <p className="text-xs text-slate-400">≈ {formatCurrency(analytics.fees.total * 148.52)}</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-slate-400">Average Fee</span>
              <div className="text-2xl font-bold text-white">{formatSOL(analytics.fees.average)} SOL</div>
              <p className="text-xs text-slate-400">Per transaction</p>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-slate-400">Highest Fee</span>
              <div className="text-2xl font-bold text-white">{formatSOL(analytics.fees.highest)} SOL</div>
              <p className="text-xs text-slate-400">Single transaction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Token Activity */}
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Coins className="w-5 h-5" />
            <span>Top Token Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.topTokens.length > 0 ? (
              analytics.topTokens.map((token, index) => (
                <div key={token.symbol} className="flex items-center space-x-4 p-3 bg-slate-800/30 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xs">{token.symbol.substring(0, 2)}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{token.symbol}</span>
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        #{index + 1}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {token.count} transactions • Volume: {token.volume.toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{token.count}</div>
                    <div className="text-xs text-slate-400">transactions</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-400">No token activity found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
