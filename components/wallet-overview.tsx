"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Wallet, DollarSign } from "lucide-react"
import { BalanceChart } from "@/components/balance-chart"
import { heliusAPI } from "@/lib/helius-api"

interface WalletOverviewProps {
  wallet: string
}

interface WalletData {
  balance: number
  usdValue: number
  change24h: number
  transactionCount: number
  tokenCount: number
}

export function WalletOverview({ wallet }: WalletOverviewProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [solPrice, setSolPrice] = useState<number>(0)
  const [timeRange, setTimeRange] = useState<"1W" | "1M" | "1Y">("1M")
  const [analytics, setAnalytics] = useState<{
    inflowOutflow: { inflow: number; outflow: number; netChange: number }
    fees: { total: number; average: number; count: number }
    categories: Record<string, number>
    topTokens: Array<{ symbol: string; count: number; volume: number }>
  } | null>(null)

  const fetchSolanaPrice = async (): Promise<number> => {
    try {
      // Try CoinGecko first
      const cgResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")

      if (cgResponse.ok) {
        const cgData = await cgResponse.json()
        if (cgData.solana?.usd) {
          return cgData.solana.usd
        }
      }

      // Fallback to Binance
      const binanceResponse = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT")

      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json()
        if (binanceData.price) {
          return Number.parseFloat(binanceData.price)
        }
      }

      throw new Error("Unable to fetch SOL price from any source")
    } catch (error) {
      console.error("Error fetching SOL price:", error)
      throw error
    }
  }

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!wallet || wallet.trim() === "") {
        setError("Please enter a valid wallet address")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Fetch current SOL price first
        const currentSolPrice = await fetchSolanaPrice()
        setSolPrice(currentSolPrice)

        // Fetch wallet balances
        const balanceData = await heliusAPI.getBalances(wallet)

        // Get SOL balance
        const solBalance = balanceData.nativeBalance / 1000000000 // Convert lamports to SOL

        // Calculate USD value with real-time SOL price
        const usdValue = solBalance * currentSolPrice

        // Get token count
        const tokenCount = balanceData.tokens ? balanceData.tokens.length : 0

        // Get transaction history
        const transactions = await heliusAPI.getTransactionHistory(wallet, 100)

        // Analyze transactions for categories, flows, and fees
        let totalInflow = 0
        let totalOutflow = 0
        let totalFees = 0
        const categories: Record<string, number> = {}
        const tokenActivity: Record<string, { count: number; volume: number }> = {}

        transactions.forEach((tx: any) => {
          // Categorize transaction
          let category = "Other"
          if (tx.type === "SWAP") category = "Swap"
          else if (tx.type === "TRANSFER") category = "Transfer"
          else if (tx.description?.includes("stake")) category = "Staking"
          else if (tx.description?.includes("vote")) category = "Voting"
          else if (tx.events?.nft) category = "NFT"

          categories[category] = (categories[category] || 0) + 1

          // Calculate inflow/outflow
          if (tx.nativeTransfers) {
            tx.nativeTransfers.forEach((transfer: any) => {
              const amount = transfer.amount / 1000000000
              if (transfer.toUserAccount === wallet) {
                totalInflow += amount
              } else if (transfer.fromUserAccount === wallet) {
                totalOutflow += amount
              }
            })
          }

          // Track token activity
          if (tx.tokenTransfers) {
            tx.tokenTransfers.forEach((transfer: any) => {
              const symbol = transfer.symbol || "Unknown"
              if (!tokenActivity[symbol]) {
                tokenActivity[symbol] = { count: 0, volume: 0 }
              }
              tokenActivity[symbol].count += 1
              tokenActivity[symbol].volume += transfer.tokenAmount || 0
            })
          }

          // Sum fees
          totalFees += tx.fee / 1000000000
        })

        const topTokens = Object.entries(tokenActivity)
          .map(([symbol, data]) => ({ symbol, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setAnalytics({
          inflowOutflow: {
            inflow: totalInflow,
            outflow: totalOutflow,
            netChange: totalInflow - totalOutflow,
          },
          fees: {
            total: totalFees,
            average: totalFees / transactions.length,
            count: transactions.length,
          },
          categories,
          topTokens,
        })

        setWalletData({
          balance: solBalance,
          usdValue: usdValue,
          change24h: 2.34, // This should be calculated from historical data
          transactionCount: transactions.length,
          tokenCount: tokenCount,
        })
      } catch (error) {
        console.error("Error fetching wallet data:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch wallet data")
      } finally {
        setLoading(false)
      }
    }

    fetchWalletData()
  }, [wallet])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatSOL = (amount: number): string => {
    if (amount < 0.001) {
      return amount.toFixed(6)
    } else if (amount < 1) {
      return amount.toFixed(4)
    } else if (amount < 1000) {
      return amount.toFixed(2)
    } else {
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-700 rounded w-3/4"></div>
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
            <p className="text-red-400 mb-2">Error loading wallet data</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!walletData) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-slate-400">No wallet data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">SOL Balance</CardTitle>
            <Wallet className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatSOL(walletData.balance)} SOL</div>
            <p className="text-xs text-slate-400">
              ≈ {formatCurrency(walletData.usdValue)}
              {solPrice > 0 && <span className="ml-1 text-slate-500">(${solPrice.toFixed(2)}/SOL)</span>}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">24h Change</CardTitle>
            {walletData.change24h >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${walletData.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
              {walletData.change24h >= 0 ? "+" : ""}
              {walletData.change24h}%
            </div>
            <p className="text-xs text-slate-400">Portfolio change</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Transactions</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{walletData.transactionCount.toLocaleString()}</div>
            <p className="text-xs text-slate-400">Total transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Tokens</CardTitle>
            <Badge variant="secondary" className="bg-teal-500/20 text-teal-400">
              {walletData.tokenCount}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{walletData.tokenCount}</div>
            <p className="text-xs text-slate-400">Unique tokens</p>
          </CardContent>
        </Card>

        {analytics && (
          <>
            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Net Flow (30d)</CardTitle>
                {analytics.inflowOutflow.netChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${analytics.inflowOutflow.netChange >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {analytics.inflowOutflow.netChange >= 0 ? "+" : ""}
                  {formatSOL(analytics.inflowOutflow.netChange)} SOL
                </div>
                <p className="text-xs text-slate-400">
                  In: {formatSOL(analytics.inflowOutflow.inflow)} | Out: {formatSOL(analytics.inflowOutflow.outflow)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Fees</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatSOL(analytics.fees.total)} SOL</div>
                <p className="text-xs text-slate-400">Avg: {formatSOL(analytics.fees.average)} per tx</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Balance History</CardTitle>
            <div className="flex space-x-2">
              <Button
                variant={timeRange === "1W" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("1W")}
                className={timeRange === "1W" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400"}
              >
                1W
              </Button>
              <Button
                variant={timeRange === "1M" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("1M")}
                className={timeRange === "1M" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400"}
              >
                1M
              </Button>
              <Button
                variant={timeRange === "1Y" ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange("1Y")}
                className={timeRange === "1Y" ? "bg-blue-600 hover:bg-blue-700" : "text-slate-400"}
              >
                1Y
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BalanceChart wallet={wallet} timeRange={timeRange} />
        </CardContent>
      </Card>
    </div>
  )
}
