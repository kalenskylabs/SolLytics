import { type NextRequest, NextResponse } from "next/server"

const HELIUS_API_KEY = "2a3ff752-d3ef-4b7c-a44a-159dfe9538b6"
const HELIUS_BASE_URL = "https://api.helius.xyz/v0"
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

interface TokenInfo {
  mintAddress: string
  name: string
  symbol: string
  decimals: number
  supply: string
  mintAuthority: string | null
  freezeAuthority: string | null
  metadataUri: string | null
  deployer: string | null
  isMutable: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { mintAddress } = await request.json()

    if (!mintAddress) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 })
    }

    // Validate mint address format
    if (!isValidMintAddress(mintAddress)) {
      return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 })
    }

    // Get token information using multiple APIs
    const tokenInfo = await getTokenInfo(mintAddress)

    return NextResponse.json(tokenInfo)
  } catch (error) {
    console.error("Error in check-ca API:", error)
    let errorMessage = "Failed to analyze token contract"
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

function isValidMintAddress(address: string): boolean {
  // Basic validation: Check if it's a 32-44 character base58 string
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
}

async function getTokenInfo(mintAddress: string): Promise<TokenInfo> {
  try {
    console.log("Fetching token info for:", mintAddress)

    // 1. Get mint account info for supply and decimals (most reliable)
    console.log("Fetching mint account info...")
    const mintInfo = await getMintInfo(mintAddress)

    // 2. Get token metadata using Helius token-metadata endpoint (includes creator)
    console.log("Fetching token metadata from Helius...")
    const tokenMetadata = await getTokenMetadata(mintAddress)

    // Combine all information
    return {
      mintAddress,
      name: tokenMetadata.name || "Unknown",
      symbol: tokenMetadata.symbol || "Unknown",
      decimals: mintInfo.decimals || tokenMetadata.decimals || 0,
      supply: mintInfo.supply || "0",
      mintAuthority: tokenMetadata.mintAuthority,
      freezeAuthority: tokenMetadata.freezeAuthority,
      metadataUri: tokenMetadata.metadataUri,
      deployer: tokenMetadata.creator,
      isMutable: tokenMetadata.isMutable || false,
    }
  } catch (error) {
    console.error("Error fetching token info:", error)
    throw error
  }
}

async function getMintInfo(mintAddress: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mintAddress, { encoding: "jsonParsed" }],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    if (!data.result?.value?.data?.parsed?.info) {
      throw new Error("Invalid contract address or token not found")
    }

    const mintInfo = data.result.value.data.parsed.info

    return {
      decimals: mintInfo.decimals,
      supply: mintInfo.supply,
    }
  } catch (error: any) {
    console.error("Error fetching mint info:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch contract info: ${error.message}`)
    } else {
      throw new Error(`Failed to fetch contract info: ${error}`)
    }
  }
}

async function getTokenMetadata(mintAddress: string) {
  try {
    const response = await fetch(`${HELIUS_BASE_URL}/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mintAccounts: [mintAddress],
      }),
    })

    if (!response.ok) {
      console.warn(`Token metadata API error: ${response.status}`)
      return {
        name: "",
        symbol: "",
        mintAuthority: null,
        freezeAuthority: null,
        metadataUri: null,
        isMutable: false,
        decimals: 0,
        creator: null,
      }
    }

    const data = await response.json()
    console.log("Token metadata response:", data)

    const tokenData = data[0] || {}

    // Extract creator from metadata
    let creator = null
    if (
      tokenData.onChainMetadata?.metadata?.data?.creators &&
      tokenData.onChainMetadata.metadata.data.creators.length > 0
    ) {
      creator = tokenData.onChainMetadata.metadata.data.creators[0].address
      console.log("Found creator from Helius metadata:", creator)
    }

    return {
      name: tokenData.onChainMetadata?.metadata?.data?.name || "",
      symbol: tokenData.onChainMetadata?.metadata?.data?.symbol || "",
      mintAuthority: tokenData.account?.mintAuthority,
      freezeAuthority: tokenData.account?.freezeAuthority,
      metadataUri: tokenData.onChainMetadata?.metadata?.data?.uri,
      isMutable: tokenData.onChainMetadata?.metadata?.isMutable || false,
      decimals: tokenData.account?.decimals || 0,
      creator,
    }
  } catch (error) {
    console.warn("Error fetching token metadata (non-fatal):", error)
    return {
      name: "",
      symbol: "",
      mintAuthority: null,
      freezeAuthority: null,
      metadataUri: null,
      isMutable: false,
      decimals: 0,
      creator: null,
    }
  }
}
