const HELIUS_API_KEY = "2a3ff752-d3ef-4b7c-a44a-159dfe9538b6"
const HELIUS_BASE_URL = "https://api.helius.xyz/v0"
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

export interface HeliusTransaction {
  signature: string
  slot: number
  timestamp: number
  fee: number
  feePayer: string
  instructions: any[]
  events: any[]
  nativeTransfers: any[]
  tokenTransfers: any[]
}

export interface HeliusBalance {
  mint: string
  amount: number
  decimals: number
  tokenAccount: string
}

export class HeliusAPI {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = HELIUS_API_KEY
    this.baseUrl = HELIUS_BASE_URL
  }

  async getTransactionHistory(address: string, limit = 50): Promise<HeliusTransaction[]> {
    // Validate wallet address format
    if (!address || address.trim() === "" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Invalid wallet address format")
    }

    // Ensure limit is within valid range (1-100 for Helius)
    const validLimit = Math.min(Math.max(1, Math.floor(limit)), 100)

    console.log(`Fetching transaction history for ${address} with limit ${validLimit}`)

    const response = await fetch(
      `${this.baseUrl}/addresses/${address}/transactions?limit=${validLimit}&api-key=${this.apiKey}`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return await response.json()
  }

  async parseTransactions(signatures: string[]): Promise<HeliusTransaction[]> {
    if (!signatures || signatures.length === 0) {
      throw new Error("No transaction signatures provided")
    }

    const response = await fetch(`${this.baseUrl}/transactions?api-key=${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactions: signatures }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return await response.json()
  }

  async getTokenBalances(address: string): Promise<HeliusBalance[]> {
    // Validate wallet address format
    if (!address || address.trim() === "" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Invalid wallet address format")
    }

    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`)
    }

    return data.result?.value || []
  }

  async getAccountInfo(address: string) {
    // Validate wallet address format
    if (!address || address.trim() === "" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Invalid wallet address format")
    }

    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [address, { encoding: "jsonParsed" }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`)
    }

    return data
  }

  async getAssetsByOwner(address: string, page = 1, limit = 20) {
    // Validate wallet address format
    if (!address || address.trim() === "" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Invalid wallet address format")
    }

    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: address,
          page: page,
          limit: limit,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message}`)
    }

    return data.result
  }

  async getBalances(address: string) {
    // Validate wallet address format
    if (!address || address.trim() === "" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Invalid wallet address format")
    }

    const response = await fetch(`${this.baseUrl}/addresses/${address}/balances?api-key=${this.apiKey}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error (${response.status}): ${errorText}`)
    }

    return await response.json()
  }
}

export const heliusAPI = new HeliusAPI()
