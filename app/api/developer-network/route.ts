import { type NextRequest, NextResponse } from "next/server"

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || ""

interface DeveloperNode {
  id: string
  group: number
  value: number
  label: string
  type: "developer" | "wallet" | "exchange" | "contract" | "token" | "nft" | "defi" | "program" | "unknown" | "whale"
  amount: number
}

interface DeveloperLink {
  source: string
  target: string
  value: number
  amount: number
  type: "funding" | "deployment" | "transfer" | "creation"
}

interface DeveloperFlowData {
  nodes: DeveloperNode[]
  links: DeveloperLink[]
  totalFunding: number
  fundingSources: number
}

export async function POST(request: NextRequest) {
  try {
    const { developerAddress } = await request.json()

    if (!developerAddress) {
      return NextResponse.json({ error: "Developer address is required" }, { status: 400 })
    }

    console.log("Analyzing developer network for:", developerAddress)

    // Get developer network data
    const developerFlowData = await analyzeDeveloperNetwork(developerAddress)

    return NextResponse.json(developerFlowData)
  } catch (error) {
    console.error("Error in developer-network API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze developer network" },
      { status: 500 },
    )
  }
}

async function analyzeDeveloperNetwork(developerAddress: string): Promise<DeveloperFlowData> {
  try {
    const nodes: DeveloperNode[] = []
    const links: DeveloperLink[] = []
    let totalFunding = 0
    let fundingSources = 0

    // Add developer address as central node
    nodes.push({
      id: developerAddress,
      group: 0,
      value: 0,
      label: "Developer",
      type: "developer",
      amount: 0,
    })

    // Get developer's transaction connections
    const developerConnections = await getDeveloperConnections(developerAddress)

    developerConnections.sources.forEach((source, index) => {
      nodes.push({
        id: source.address,
        group: 1 + index,
        value: source.transactionCount,
        label: source.label || `Connection ${index + 1}`,
        type: source.type as any,
        amount: source.amount,
      })

      links.push({
        source: source.address,
        target: developerAddress,
        value: source.transactionCount,
        amount: source.amount,
        type: "funding",
      })

      totalFunding += source.amount
      fundingSources++
    })

    // Update developer node with total activity
    const developerNode = nodes.find((n) => n.id === developerAddress)
    if (developerNode) {
      developerNode.amount = developerConnections.totalActivity
      developerNode.value = developerConnections.sources.length
    }

    return {
      nodes,
      links,
      totalFunding,
      fundingSources,
    }
  } catch (error) {
    console.error("Error analyzing developer network:", error)

    // Return minimal data structure on error
    return {
      nodes: [
        {
          id: developerAddress,
          group: 0,
          value: 0,
          label: "Developer",
          type: "developer",
          amount: 0,
        },
      ],
      links: [],
      totalFunding: 0,
      fundingSources: 0,
    }
  }
}

async function getDeveloperConnections(developerAddress: string) {
  try {
    // Get developer's transaction history
    const signatures = await getSignaturesForAddress(developerAddress, 50)

    const sources: Array<{
      address: string
      amount: number
      transactionCount: number
      type: string
      label?: string
    }> = []

    let totalActivity = 0

    // Analyze transactions to find connected addresses
    for (const sig of signatures.slice(0, 20)) {
      try {
        const tx = await getTransaction(sig.signature)
        if (!tx) continue

        // Analyze transaction for connections
        const connectionInfo = analyzeConnectionTransaction(tx, developerAddress)

        if (connectionInfo.amount > 0) {
          const existingSource = sources.find((s) => s.address === connectionInfo.source)
          if (existingSource) {
            existingSource.amount += connectionInfo.amount
            existingSource.transactionCount++
          } else {
            sources.push({
              address: connectionInfo.source,
              amount: connectionInfo.amount,
              transactionCount: 1,
              type: classifyAddress(connectionInfo.source),
              label: await getAddressLabel(connectionInfo.source),
            })
          }
          totalActivity += connectionInfo.amount
        }
      } catch (error) {
        console.warn("Error analyzing transaction:", error)
      }
    }

    return {
      sources: sources.slice(0, 10), // Limit to top 10 connections
      totalActivity,
    }
  } catch (error) {
    console.error("Error getting developer connections:", error)
    return { sources: [], totalActivity: 0 }
  }
}

async function getSignaturesForAddress(address: string, limit = 20) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit }],
      }),
    })

    const data = await response.json()
    return data.result || []
  } catch (error) {
    console.error("Error getting signatures:", error)
    return []
  }
}

async function getTransaction(signature: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { maxSupportedTransactionVersion: 0 }],
      }),
    })

    const data = await response.json()
    return data.result
  } catch (error) {
    console.error("Error getting transaction:", error)
    return null
  }
}

function analyzeConnectionTransaction(tx: any, targetAddress: string) {
  try {
    // Simplified connection analysis
    const preBalances = tx.meta?.preBalances || []
    const postBalances = tx.meta?.postBalances || []
    const accountKeys = tx.transaction?.message?.accountKeys || []

    // Find target address index
    const targetIndex = accountKeys.findIndex(
      (key: any) => (typeof key === "string" ? key : key.pubkey) === targetAddress,
    )

    if (targetIndex === -1) {
      return { source: "", amount: 0 }
    }

    // Calculate balance change
    const balanceChange = Math.abs((postBalances[targetIndex] || 0) - (preBalances[targetIndex] || 0))

    if (balanceChange > 0) {
      // Find the connected address (simplified)
      for (let i = 0; i < accountKeys.length; i++) {
        if (i !== targetIndex) {
          const sourceChange = Math.abs((preBalances[i] || 0) - (postBalances[i] || 0))
          if (sourceChange > 0) {
            const sourceAddress = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i].pubkey
            return { source: sourceAddress, amount: balanceChange }
          }
        }
      }
    }

    return { source: "", amount: 0 }
  } catch (error) {
    console.error("Error analyzing connection transaction:", error)
    return { source: "", amount: 0 }
  }
}

function classifyAddress(address: string): string {
  // Known exchange addresses (simplified)
  const exchanges = [
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Binance
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // FTX
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S", // Coinbase
  ]

  if (exchanges.includes(address)) {
    return "exchange"
  }

  // Check if it's a program/contract (simplified)
  if (address.length === 44 && address.includes("1111")) {
    return "contract"
  }

  // Default classification based on patterns
  if (address.startsWith("So1")) return "contract"
  if (address.startsWith("11111")) return "contract"

  return "wallet"
}

async function getAddressLabel(address: string): Promise<string | undefined> {
  // Known address labels (simplified)
  const labels: Record<string, string> = {
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "Binance",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "FTX",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "Coinbase",
    So11111111111111111111111111111111111111112: "Wrapped SOL",
    "11111111111111111111111111111111": "System Program",
  }

  return labels[address]
}
