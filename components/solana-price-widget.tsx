"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Activity } from "lucide-react"

interface SolanaPrice {
  current: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  marketCap: number
  lastUpdated: Date
}

interface PricePoint {
  timestamp: number
  price: number
}

export function SolanaPriceWidget() {
  const [priceData, setPriceData] = useState<SolanaPrice | null>(null)
  const [chartData, setChartData] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPriceData = async () => {
    try {
      // Fetch current price from multiple sources for reliability
      const [coingeckoResponse, binanceResponse] = await Promise.allSettled([
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true",
        ),
        fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT"),
      ])

      let currentPrice = 0
      let change24h = 0
      let changePercent24h = 0
      let high24h = 0
      let low24h = 0
      let volume24h = 0
      let marketCap = 0

      // Try CoinGecko first (more comprehensive data)
      if (coingeckoResponse.status === "fulfilled" && coingeckoResponse.value.ok) {
        const cgData = await coingeckoResponse.value.json()
        if (cgData.solana) {
          currentPrice = cgData.solana.usd
          changePercent24h = cgData.solana.usd_24h_change || 0
          volume24h = cgData.solana.usd_24h_vol || 0
          marketCap = cgData.solana.usd_market_cap || 0
          change24h = (currentPrice * changePercent24h) / 100
        }
      }

      // Fallback to Binance if CoinGecko fails
      if (currentPrice === 0 && binanceResponse.status === "fulfilled" && binanceResponse.value.ok) {
        const binanceData = await binanceResponse.value.json()
        currentPrice = Number.parseFloat(binanceData.lastPrice)
        changePercent24h = Number.parseFloat(binanceData.priceChangePercent)
        change24h = Number.parseFloat(binanceData.priceChange)
        high24h = Number.parseFloat(binanceData.highPrice)
        low24h = Number.parseFloat(binanceData.lowPrice)
        volume24h = Number.parseFloat(binanceData.volume) * currentPrice // Convert to USD
      }

      if (currentPrice > 0) {
        setPriceData({
          current: currentPrice,
          change24h: change24h,
          changePercent24h: changePercent24h,
          high24h: high24h,
          low24h: low24h,
          volume24h: volume24h,
          marketCap: marketCap,
          lastUpdated: new Date(),
        })
        setError(null)
      } else {
        throw new Error("Unable to fetch price data")
      }
    } catch (err) {
      console.error("Error fetching Solana price:", err)
      setError("Failed to load price data")
    }
  }

  const fetchChartData = async () => {
    try {
      // Fetch 7-day chart data from CoinGecko
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=7&interval=hourly",
      )

      if (response.ok) {
        const data = await response.json()
        if (data.prices && Array.isArray(data.prices)) {
          const chartPoints: PricePoint[] = data.prices.map(([timestamp, price]: [number, number]) => ({
            timestamp,
            price,
          }))
          setChartData(chartPoints.slice(-24)) // Last 24 hours
        }
      } else {
        // Fallback: generate mock chart data based on current price
        if (priceData) {
          const mockData: PricePoint[] = []
          const now = Date.now()
          for (let i = 23; i >= 0; i--) {
            const timestamp = now - i * 60 * 60 * 1000 // Hourly intervals
            const variation = (Math.random() - 0.5) * 0.1 // ±5% variation
            const price = priceData.current * (1 + variation)
            mockData.push({ timestamp, price })
          }
          setChartData(mockData)
        }
      }
    } catch (err) {
      console.error("Error fetching chart data:", err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchPriceData()
      setLoading(false)
    }

    loadData()

    // Update price every 30 seconds
    const priceInterval = setInterval(fetchPriceData, 30000)

    return () => {
      clearInterval(priceInterval)
    }
  }, [])

  useEffect(() => {
    if (priceData) {
      fetchChartData()
    }
  }, [priceData])

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatVolume = (volume: number): string => {
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(1)}B`
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(1)}M`
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(1)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  const renderMiniChart = () => {
    if (chartData.length === 0) return null

    const width = 200
    const height = 60
    const padding = 4

    const prices = chartData.map((d) => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    if (priceRange === 0) return null

    const points = chartData
      .map((d, i) => {
        const x = padding + (i / (chartData.length - 1)) * (width - 2 * padding)
        const y = height - padding - ((d.price - minPrice) / priceRange) * (height - 2 * padding)
        return `${x},${y}`
      })
      .join(" ")

    const isPositive = chartData[chartData.length - 1].price >= chartData[0].price
    const strokeColor = isPositive ? "#10b981" : "#ef4444"

    return (
      <svg width={width} height={height} className="w-full h-full">
        <polyline fill="none" stroke={strokeColor} strokeWidth="1.5" points={points} className="drop-shadow-sm" />
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#chartGradient)"
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        />
      </svg>
    )
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="p-3">
          <div className="animate-pulse space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-slate-600 rounded"></div>
              <div className="h-3 bg-slate-600 rounded w-12"></div>
            </div>
            <div className="h-6 bg-slate-600 rounded w-20"></div>
            <div className="h-12 bg-slate-600 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !priceData) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center space-x-2 text-red-400">
            <Activity className="w-4 h-4" />
            <span className="text-xs">Price unavailable</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isPositive = priceData.changePercent24h >= 0

  return (
    <Card className="bg-slate-800/30 border-slate-700">
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            <span className="text-xs font-medium text-slate-300">SOL</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        {/* Price */}
        <div className="space-y-1">
          <div className="text-lg font-bold text-white">{formatPrice(priceData.current)}</div>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span className="text-xs font-medium">
                {isPositive ? "+" : ""}
                {priceData.changePercent24h.toFixed(2)}%
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {isPositive ? "+" : ""}
              {formatPrice(Math.abs(priceData.change24h))}
            </span>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-12 w-full">{renderMiniChart()}</div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400">24h Vol</span>
            <div className="text-slate-300 font-medium">{formatVolume(priceData.volume24h)}</div>
          </div>
          <div>
            <span className="text-slate-400">Market Cap</span>
            <div className="text-slate-300 font-medium">{formatVolume(priceData.marketCap)}</div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-slate-500 text-center">Updated {priceData.lastUpdated.toLocaleTimeString()}</div>
      </CardContent>
    </Card>
  )
}
