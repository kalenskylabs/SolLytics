"use client"

import type React from "react"

import { useState } from "react"
import { Search, Wallet } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface WalletSearchProps {
  onWalletSelect: (wallet: string) => void
}

export function WalletSearch({ onWalletSelect }: WalletSearchProps) {
  const [searchValue, setSearchValue] = useState("")

  const handleSearch = () => {
    if (searchValue.trim()) {
      onWalletSelect(searchValue.trim())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <Card className="p-6 bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Enter Solana wallet address..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder-slate-400 focus:border-blue-500/50"
          />
        </div>
        <Button
          onClick={handleSearch}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Analyze
        </Button>
      </div>
    </Card>
  )
}
