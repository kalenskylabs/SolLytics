"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Shield, TrendingUp } from "lucide-react"

interface WalletContextType {
  isConnected: boolean
  walletAddress: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  useEffect(() => {
    // Check if wallet was previously connected
    const savedAddress = localStorage.getItem("walletAddress")
    if (savedAddress) {
      setWalletAddress(savedAddress)
      setIsConnected(true)
    }
  }, [])

  const connect = async () => {
    try {
      // Check if Phantom wallet is available
      if (typeof window !== "undefined" && "solana" in window) {
        const solana = (window as any).solana
        if (solana.isPhantom) {
          const response = await solana.connect()
          const address = response.publicKey.toString()
          setWalletAddress(address)
          setIsConnected(true)
          localStorage.setItem("walletAddress", address)
          return
        }
      }

      // Fallback: simulate wallet connection for demo
      const demoAddress = "Demo" + Math.random().toString(36).substring(2, 15)
      setWalletAddress(demoAddress)
      setIsConnected(true)
      localStorage.setItem("walletAddress", demoAddress)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    }
  }

  const disconnect = () => {
    setIsConnected(false)
    setWalletAddress(null)
    localStorage.removeItem("walletAddress")
  }

  if (!isConnected) {
    return <WalletLoginScreen onConnect={connect} />
  }

  return (
    <WalletContext.Provider value={{ isConnected, walletAddress, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

function WalletLoginScreen({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent">
                Welcome to Sollytics
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2">
                Connect your wallet to access advanced Solana analytics
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg">
                <Shield className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white">Secure Connection</p>
                  <p className="text-xs text-slate-400">Your wallet stays in your control</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-slate-800/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-white">Advanced Analytics</p>
                  <p className="text-xs text-slate-400">Deep insights into Solana ecosystem</p>
                </div>
              </div>
            </div>

            <Button
              onClick={onConnect}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-3"
            >
              <Wallet className="w-5 h-5 mr-2" />
              Connect Wallet
            </Button>

            <p className="text-xs text-slate-500 text-center">Supports Phantom, Solflare, and other Solana wallets</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
