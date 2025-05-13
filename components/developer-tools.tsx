"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, Play, Download, Copy, Check } from "lucide-react"

interface DeveloperToolsProps {
  wallet: string
}

export function DeveloperTools({ wallet }: DeveloperToolsProps) {
  const [apiEndpoint, setApiEndpoint] = useState("transactions")
  const [apiResponse, setApiResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Replace the handleApiCall function with this real API implementation
  const handleApiCall = async () => {
    setLoading(true)
    try {
      let url = ""
      const method = "GET"
      const body = null

      // Construct the appropriate API call based on the selected endpoint
      switch (apiEndpoint) {
        case "transactions":
          url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6&limit=10`
          break
        case "balance":
          url = `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6`
          break
        case "tokens":
          // For tokens, we'll use the balances endpoint but focus on tokens
          url = `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6`
          break
        case "nfts":
          url = `https://api.helius.xyz/v0/addresses/${wallet}/nfts?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6`
          break
        default:
          url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=2a3ff752-d3ef-4b7c-a44a-159dfe9538b6&limit=10`
      }

      // Make the API call
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setApiResponse(JSON.stringify(data, null, 2))
    } catch (error) {
      console.error("API call failed:", error)
      setApiResponse(JSON.stringify({ error: `Failed to fetch data: ${error.message}` }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(apiResponse)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportData = () => {
    const blob = new Blob([apiResponse], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${wallet}_${apiEndpoint}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Code className="w-5 h-5" />
            <span>API Playground</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="explorer" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="explorer">API Explorer</TabsTrigger>
              <TabsTrigger value="examples">Code Examples</TabsTrigger>
              <TabsTrigger value="export">Export Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="explorer" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Endpoint</label>
                  <select
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white"
                  >
                    <option value="transactions">Get Transactions</option>
                    <option value="balance">Get Balance</option>
                    <option value="tokens">Get Token Holdings</option>
                    <option value="nfts">Get NFTs</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Wallet Address</label>
                  <Input value={wallet} readOnly className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>

              <Button
                onClick={handleApiCall}
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Play className="w-4 h-4 mr-2" />
                {loading ? "Loading..." : "Execute API Call"}
              </Button>

              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Response</label>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                      className="border-slate-700 text-slate-400"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportData}
                      className="border-slate-700 text-slate-400"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={apiResponse}
                  readOnly
                  className="h-64 bg-slate-950 border-slate-700 text-green-400 font-mono text-sm"
                  placeholder="API response will appear here..."
                />
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-medium mb-2">JavaScript Example</h3>
                  <div className="bg-slate-950 p-4 rounded border border-slate-700">
                    <pre className="text-green-400 text-sm overflow-x-auto">
                      {`const response = await fetch(
  'https://api.helius.xyz/v0/addresses/${wallet}/transactions/?api-key=YOUR_KEY'
);
const data = await response.json();
console.log(data);`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-medium mb-2">Python Example</h3>
                  <div className="bg-slate-950 p-4 rounded border border-slate-700">
                    <pre className="text-green-400 text-sm overflow-x-auto">
                      {`import requests

url = f"https://api.helius.xyz/v0/addresses/${wallet}/transactions/"
params = {"api-key": "YOUR_KEY"}
response = requests.get(url, params=params)
data = response.json()`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-medium mb-2">cURL Example</h3>
                  <div className="bg-slate-950 p-4 rounded border border-slate-700">
                    <pre className="text-green-400 text-sm overflow-x-auto">
                      {`curl "https://api.helius.xyz/v0/addresses/${wallet}/transactions/?api-key=YOUR_KEY"`}
                    </pre>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-white font-medium mb-2">Transaction History</h3>
                    <p className="text-slate-400 text-sm mb-4">Export complete transaction history</p>
                    <Button variant="outline" className="w-full border-slate-700 text-slate-400">
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-white font-medium mb-2">Token Portfolio</h3>
                    <p className="text-slate-400 text-sm mb-4">Export token holdings and balances</p>
                    <Button variant="outline" className="w-full border-slate-700 text-slate-400">
                      <Download className="w-4 h-4 mr-2" />
                      Export JSON
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-white font-medium mb-2">Network Graph</h3>
                    <p className="text-slate-400 text-sm mb-4">Export transaction network data</p>
                    <Button variant="outline" className="w-full border-slate-700 text-slate-400">
                      <Download className="w-4 h-4 mr-2" />
                      Export PNG
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-white font-medium mb-2">Analytics Report</h3>
                    <p className="text-slate-400 text-sm mb-4">Generate comprehensive PDF report</p>
                    <Button variant="outline" className="w-full border-slate-700 text-slate-400">
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded">
              <div>
                <Badge className="bg-green-500/20 text-green-400 mr-2">GET</Badge>
                <span className="text-white font-mono text-sm">/v0/addresses/{"{address}"}/transactions</span>
              </div>
              <span className="text-slate-400 text-sm">Get transaction history</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded">
              <div>
                <Badge className="bg-blue-500/20 text-blue-400 mr-2">POST</Badge>
                <span className="text-white font-mono text-sm">/v0/transactions</span>
              </div>
              <span className="text-slate-400 text-sm">Parse transaction signatures</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded">
              <div>
                <Badge className="bg-green-500/20 text-green-400 mr-2">GET</Badge>
                <span className="text-white font-mono text-sm">/v0/addresses/{"{address}"}/balances</span>
              </div>
              <span className="text-slate-400 text-sm">Get token balances</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
