"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Search } from "lucide-react"

interface ReputabilityData {
  score: number
  explanation: string
  factors: {
    name: string
    impact: number
    description: string
    type: "positive" | "negative" | "neutral"
  }[]
  riskLevel: "low" | "medium" | "high"
  recommendations: string[]
}

export function ReputabilityDashboard() {
  const [walletAddress, setWalletAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReputabilityData | null>(null)
  const [error, setError] = useState<string>("")

  const analyzeWallet = async () => {
    if (!walletAddress.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/reputability-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setData(result)
    } catch (error) {
      console.error("Error analyzing wallet:", error)
      setError(error instanceof Error ? error.message : "Failed to analyze wallet")
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400"
    if (score >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  const getRiskBadgeColor = (risk: string | undefined) => {
    if (!risk) return "bg-gray-500/20 text-gray-400 border-gray-500/30"

    switch (risk) {
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  // Example wallet addresses for testing
  const exampleWallets = [
    { address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", label: "High Reputation", type: "high" },
    { address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", label: "Medium Reputation", type: "medium" },
    { address: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC7Prokg2ugeD7", label: "Low Reputation", type: "low" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Wallet Reputability Score</h1>
      </div>

      <Card className="bg-slate-900/50 border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">AI-Powered Trust Assessment</CardTitle>
          <CardDescription className="text-slate-400">
            Analyze wallet behavior and generate a comprehensive reputability score using advanced AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter wallet address..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="bg-slate-800/50 border-slate-700/50 text-white"
            />
            <Button
              onClick={analyzeWallet}
              disabled={loading || !walletAddress.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Analyze
            </Button>
          </div>

          {/* Example wallet addresses */}
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Try these example wallets:</p>
            <div className="flex flex-wrap gap-2">
              {exampleWallets.map((wallet) => (
                <Button
                  key={wallet.address}
                  variant="outline"
                  size="sm"
                  onClick={() => setWalletAddress(wallet.address)}
                  className={`text-xs ${
                    wallet.type === "high"
                      ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                      : wallet.type === "medium"
                        ? "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                  }`}
                >
                  {wallet.label}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Overview */}
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Trust Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(data.score)}`}>{data.score}/100</div>
                <Badge className={getRiskBadgeColor(data.riskLevel)}>
                  {data.riskLevel ? data.riskLevel.toUpperCase() : "UNKNOWN"} RISK
                </Badge>
              </div>
              <Progress value={data.score} className="h-2" />
            </CardContent>
          </Card>

          {/* AI Explanation */}
          <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 leading-relaxed">{data.explanation}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {data && (
        <Tabs defaultValue="factors" className="space-y-4">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="factors">Contributing Factors</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="factors" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.factors.map((factor, index) => (
                <Card key={index} className="bg-slate-900/50 border-slate-800/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white">{factor.name}</h3>
                      <div className="flex items-center space-x-1">
                        {factor.type === "positive" ? (
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        ) : factor.type === "negative" ? (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            factor.type === "positive"
                              ? "text-green-400"
                              : factor.type === "negative"
                                ? "text-red-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {factor.impact > 0 ? "+" : ""}
                          {factor.impact}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">{factor.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommendations">
            <Card className="bg-slate-900/50 border-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
