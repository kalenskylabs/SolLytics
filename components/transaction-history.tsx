"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ArrowUpRight, ArrowDownLeft, Repeat, Download, ExternalLink } from "lucide-react"

interface Transaction {
  signature: string
  type: "transfer" | "swap" | "stake" | "nft"
  amount: number
  token: string
  from: string
  to: string
  timestamp: Date
  fee: number
  status: "success" | "failed"
  category: string
}

interface TransactionHistoryProps {
  wallet: string
}

export function TransactionHistory({ wallet }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      try {
        // Fetch real transaction history using Helius API
        const response = await fetch(
          `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6&limit=20`,
        )

        if (!response.ok) {
          throw new Error(`Error fetching transactions: ${response.status}`)
        }

        const data = await response.json()

        // Transform the Helius API response to match our Transaction interface
        const transformedTransactions: Transaction[] = data.map((tx: any) => {
          // Enhanced transaction categorization
          let type: Transaction["type"] = "transfer"
          let category = "Transfer"

          if (tx.type === "SWAP" || tx.description?.toLowerCase().includes("swap")) {
            type = "swap"
            category = "Swap"
          } else if (tx.type === "NFT_SALE" || tx.type === "NFT_BID" || tx.events?.nft) {
            type = "nft"
            category = "NFT"
          } else if (
            tx.description?.toLowerCase().includes("stake") ||
            tx.description?.toLowerCase().includes("delegate")
          ) {
            type = "stake"
            category = "Staking"
          } else if (tx.description?.toLowerCase().includes("vote")) {
            category = "Voting"
          } else if (
            tx.description?.toLowerCase().includes("create") &&
            tx.description?.toLowerCase().includes("account")
          ) {
            category = "Account Creation"
          } else if (tx.instructions?.some((inst: any) => inst.programId === "11111111111111111111111111111111")) {
            category = "System"
          }

          // Get amount from native transfers or token transfers
          let amount = 0
          let token = "SOL"

          if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
            amount = tx.nativeTransfers[0].amount / 1000000000 // Convert lamports to SOL
          } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
            amount = tx.tokenTransfers[0].tokenAmount
            token = tx.tokenTransfers[0].symbol || "Unknown"
          }

          return {
            signature: tx.signature,
            type: type,
            amount: amount,
            token: token,
            from: tx.feePayer || wallet,
            to: tx.nativeTransfers?.[0]?.toUserAccount || tx.tokenTransfers?.[0]?.toUserAccount || "Unknown",
            timestamp: new Date(tx.timestamp * 1000),
            fee: tx.fee / 1000000000, // Convert lamports to SOL
            status: tx.err ? "failed" : "success",
            category: category,
          }
        })

        setTransactions(transformedTransactions)
      } catch (error) {
        console.error("Error fetching transactions:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [wallet])

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.signature.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.token.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === "all" || tx.type === filter
    return matchesSearch && matchesFilter
  })

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "transfer":
        return <ArrowUpRight className="w-4 h-4" />
      case "swap":
        return <Repeat className="w-4 h-4" />
      case "stake":
        return <ArrowDownLeft className="w-4 h-4" />
      case "nft":
        return <ArrowUpRight className="w-4 h-4" />
      default:
        return <ArrowUpRight className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: Transaction["type"]) => {
    switch (type) {
      case "transfer":
        return "bg-blue-500/20 text-blue-400"
      case "swap":
        return "bg-purple-500/20 text-purple-400"
      case "stake":
        return "bg-green-500/20 text-green-400"
      case "nft":
        return "bg-orange-500/20 text-orange-400"
      default:
        return "bg-gray-500/20 text-gray-400"
    }
  }

  const formatSOL = (amount: number): string => {
    if (amount < 0.001) {
      return amount.toFixed(6)
    } else if (amount < 1) {
      return amount.toFixed(4)
    } else {
      return amount.toFixed(2)
    }
  }

  const openTransactionInSolscan = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, "_blank")
  }

  if (loading) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-700 rounded-full"></div>
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
    <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Transaction History</CardTitle>
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-400">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="flex items-center space-x-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700/50 text-white"
            />
          </div>

          <div className="flex space-x-2">
            {["all", "transfer", "swap", "stake", "nft", "system"].map((type) => (
              <Button
                key={type}
                variant={filter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(type)}
                className={filter === type ? "bg-blue-500 hover:bg-blue-600" : "border-slate-700 text-slate-400"}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.signature}
              className="flex items-center space-x-4 p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              <div className={`p-2 rounded-full ${getTypeColor(tx.type)}`}>{getTransactionIcon(tx.type)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openTransactionInSolscan(tx.signature)}
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <span className="truncate">
                      {tx.signature.substring(0, 8)}...{tx.signature.substring(tx.signature.length - 8)}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <Badge className={getTypeColor(tx.type)}>{tx.type}</Badge>
                  <Badge variant={tx.status === "success" ? "default" : "destructive"}>{tx.status}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {tx.timestamp.toLocaleDateString()} {tx.timestamp.toLocaleTimeString()}
                </p>
                <p className="text-xs text-slate-400">Category: {tx.category}</p>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-white">
                  {formatSOL(tx.amount)} {tx.token}
                </p>
                <p className="text-xs text-slate-400">Fee: {formatSOL(tx.fee)} SOL</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
