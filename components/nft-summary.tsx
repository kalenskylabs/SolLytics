"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImageIcon, ExternalLink, Grid3X3 } from "lucide-react"
import { heliusAPI } from "@/lib/helius-api"

interface NFT {
  id: string
  content: {
    files?: Array<{
      uri: string
      type: string
    }>
    metadata: {
      name: string
      symbol?: string
      description?: string
      image?: string
    }
  }
  grouping?: Array<{
    group_key: string
    group_value: string
  }>
  creators?: Array<{
    address: string
    verified: boolean
    share: number
  }>
  ownership: {
    owner: string
    delegate?: string
  }
}

interface NFTSummaryProps {
  wallet: string
}

export function NFTSummary({ wallet }: NFTSummaryProps) {
  const [nfts, setNfts] = useState<NFT[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!wallet || wallet.trim() === "") {
        setError("Please enter a valid wallet address")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await heliusAPI.getAssetsByOwner(wallet, 1, 20)
        const nftList = result?.items || []
        setNfts(nftList)

        // Calculate estimated total value (this would need real floor price data)
        const estimatedValue = nftList.length * 0.1 // Placeholder - should use real floor prices
        setTotalValue(estimatedValue)
      } catch (error) {
        console.error("Error fetching NFTs:", error)
        setError(error instanceof Error ? error.message : "Failed to fetch NFTs")
      } finally {
        setLoading(false)
      }
    }

    fetchNFTs()
  }, [wallet])

  const formatSOL = (amount: number): string => {
    return amount.toFixed(2)
  }

  const openNFTInExplorer = (mint: string) => {
    window.open(`https://solscan.io/token/${mint}`, "_blank")
  }

  const getNFTImage = (nft: NFT): string => {
    // Try to get image from content.files first
    if (nft.content?.files && nft.content.files.length > 0) {
      const imageFile = nft.content.files.find(
        (file) => file.type?.includes("image") || file.uri?.match(/\.(jpg|jpeg|png|gif|webp)$/i),
      )
      if (imageFile) return imageFile.uri
    }

    // Fall back to metadata.image
    if (nft.content?.metadata?.image) {
      return nft.content.metadata.image
    }

    return ""
  }

  const getNFTName = (nft: NFT): string => {
    return nft.content?.metadata?.name || "Unnamed NFT"
  }

  const getNFTCollection = (nft: NFT): string => {
    if (nft.grouping && nft.grouping.length > 0) {
      const collectionGroup = nft.grouping.find((g) => g.group_key === "collection")
      if (collectionGroup) return collectionGroup.group_value
    }

    return nft.content?.metadata?.symbol || "Unknown Collection"
  }

  const isVerified = (nft: NFT): boolean => {
    return nft.creators?.some((creator) => creator.verified) || false
  }

  if (loading) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4">
                <div className="w-16 h-16 bg-slate-700 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-400 mb-2">Error loading NFTs</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center space-x-2">
              <Grid3X3 className="w-5 h-5" />
              <span>NFT Collection</span>
            </CardTitle>
            <Badge variant="outline" className="border-slate-600 text-slate-400">
              {nfts.length} NFTs
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-slate-400 mb-1">Total NFTs</p>
              <p className="text-2xl font-bold text-white">{nfts.length}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Estimated Value</p>
              <p className="text-2xl font-bold text-white">{formatSOL(totalValue)} SOL</p>
            </div>
          </div>

          {nfts.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No NFTs found in this wallet</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {nfts.slice(0, 10).map((nft) => (
                <div
                  key={nft.id}
                  className="flex items-center space-x-4 p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
                >
                  <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden">
                    {getNFTImage(nft) ? (
                      <img
                        src={getNFTImage(nft) || "/placeholder.svg"}
                        alt={getNFTName(nft)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                          target.parentElement?.querySelector(".fallback-icon")?.classList.remove("hidden")
                        }}
                      />
                    ) : null}
                    <ImageIcon className={`w-8 h-8 text-slate-500 fallback-icon ${getNFTImage(nft) ? "hidden" : ""}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-white font-medium truncate">{getNFTName(nft)}</h3>
                      {isVerified(nft) && <Badge className="bg-blue-500/20 text-blue-400 text-xs">Verified</Badge>}
                    </div>
                    <p className="text-sm text-slate-400 truncate">{getNFTCollection(nft)}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{nft.id}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openNFTInExplorer(nft.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {nfts.length > 10 && (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm">Showing 10 of {nfts.length} NFTs</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
