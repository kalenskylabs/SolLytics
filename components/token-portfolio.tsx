"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react"

interface Token {
  mint: string
  symbol: string
  name: string
  balance: number
  decimals: number
  usdValue: number
  change24h: number
  logo?: string
}

interface TokenPortfolioProps {
  wallet: string
}

export function TokenPortfolio({ wallet }: TokenPortfolioProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true)
      try {
        // Fetch token balances using Helius API
        const response = await fetch(
          `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6`,
        )

        if (!response.ok) {
          throw new Error(`Error fetching token balances: ${response.status}`)
        }

        const data = await response.json()

        // Transform the Helius API response to match our Token interface
        const tokens: Token[] = []

        // Add SOL balance
        if (data.nativeBalance) {
          const solBalance = data.nativeBalance / 1000000000 // Convert lamports to SOL
          const solPrice = 148.52 // Current SOL price in USD

          tokens.push({
            mint: "So11111111111111111111111111111111111111112",
            symbol: "SOL",
            name: "Solana",
            balance: solBalance,
            decimals: 9,
            usdValue: solBalance * solPrice,
            change24h: 2.34, // Placeholder - would need price API for real data
          })
        }

        // Add other tokens with better filtering
        if (data.tokens) {
          // Fetch token metadata for symbols and names
          const tokenList = await fetch("https://token.jup.ag/all")
            .then((res) => res.json())
            .catch(() => [])

          // Create a map of verified tokens with market data
          const verifiedTokens = new Map()
          tokenList.forEach((token: any) => {
            if (token.symbol && token.name && !token.name.includes("Unknown")) {
              verifiedTokens.set(token.address, {
                symbol: token.symbol,
                name: token.name,
                verified: true,
              })
            }
          })

          // Well-known token addresses with approximate prices
          const knownTokenPrices: Record<string, number> = {
            EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1.0, // USDC
            Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1.0, // USDT
            "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": 1.5, // RAY
            SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt: 0.5, // SRM
            mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 145, // mSOL
            "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": 145, // stSOL
          }

          for (const token of data.tokens) {
            const tokenInfo = verifiedTokens.get(token.mint)
            const decimals = token.decimals || 0
            const balance = token.amount / Math.pow(10, decimals)

            // Only include tokens that are verified or have known prices
            if (tokenInfo || knownTokenPrices[token.mint]) {
              const price = knownTokenPrices[token.mint] || 0
              const usdValue = balance * price

              // Only include if balance is meaningful (> 0.001) and has some USD value
              if (
                balance > 0.001 &&
                (usdValue > 0.01 || token.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
              ) {
                const change24h = Math.random() * 10 - 5 // Random value between -5 and 5

                tokens.push({
                  mint: token.mint,
                  symbol: tokenInfo?.symbol || "USDC",
                  name: tokenInfo?.name || "USD Coin",
                  balance: balance,
                  decimals: decimals,
                  usdValue: usdValue,
                  change24h: change24h,
                })
              }
            }
          }
        }

        setTokens(tokens)
        setTotalValue(tokens.reduce((sum, token) => sum + token.usdValue, 0))
      } catch (error) {
        console.error("Error fetching tokens:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [wallet])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.ceil(amount * 100) / 100) // Round up to nearest cent
  }

  const formatTokenBalance = (balance: number, decimals: number, symbol: string): string => {
    if (symbol === "SOL") {
      if (balance < 0.001) {
        return balance.toFixed(6)
      } else if (balance < 1) {
        return balance.toFixed(4)
      } else if (balance < 1000) {
        return balance.toFixed(2)
      } else {
        return balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      }
    } else {
      // For other tokens, use appropriate decimal places
      if (balance < 1) {
        return balance.toFixed(Math.min(6, decimals))
      } else if (balance < 1000) {
        return balance.toFixed(Math.min(4, decimals))
      } else {
        return balance.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: Math.min(4, decimals),
        })
      }
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4">
                <div className="w-12 h-12 bg-slate-700 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-slate-700 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">{formatCurrency(totalValue)}</div>
          <p className="text-slate-400">Total Portfolio Value</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">Token Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tokens.map((token) => (
              <div
                key={token.mint}
                className="flex items-center space-x-4 p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{token.symbol.substring(0, 2)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-medium">{token.name}</h3>
                    <Badge variant="outline" className="border-slate-600 text-slate-400">
                      {token.symbol}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400">
                    {formatTokenBalance(token.balance, token.decimals, token.symbol)} {token.symbol}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-white font-medium">{formatCurrency(token.usdValue)}</p>
                  <div className="flex items-center space-x-1">
                    {token.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-sm ${token.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {token.change24h >= 0 ? "+" : ""}
                      {token.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
