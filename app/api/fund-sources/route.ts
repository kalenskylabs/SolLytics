import { type NextRequest, NextResponse } from "next/server"

const HELIUS_API_KEY = "2a3ff752-d3ef-4b7c-a44a-159dfe9538b6"
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

interface FundNode {
  id: string
  group: number
  value: number
  label: string
  type: "mint" | "deployer" | "source" | "exchange" | "whale" | "contract"
  amount: number
}

interface FundLink {
  source: string
  target: string
  value: number
  amount: number
  type: "funding" | "deployment" | "transfer" | "creation"
}

interface FundFlowData {
  nodes: FundNode[]
  links: FundLink[]
  totalFunding: number
  fundingSources: number
}

export async function POST(request: NextRequest) {
  try {
    const { mintAddress, deployerAddress } = await request.json()

    if (!mintAddress) {
      return NextResponse.json({ error: "Mint address is required" }, { status: 400 })
    }

    console.log("Analyzing fund sources for:", mintAddress)

    // Get fund flow data
    const fundFlowData = await analyzeFundSources(mintAddress, deployerAddress)

    return NextResponse.json(fundFlowData)
  } catch (error) {
    console.error("Error in fund-sources API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze fund sources" },
      { status: 500 },
    )
  }
}

async function analyzeFundSources(mintAddress: string, deployerAddress: string | null): Promise<FundFlowData> {
  try {
    const nodes: FundNode[] = []
    const links: FundLink[] = []
    let totalFunding = 0
    let fundingSources = 0

    // Add mint address as central node
    nodes.push({
      id: mintAddress,
      group: 0,
      value: 0,
      label: "Mint Address",
      type: "mint",
      amount: 0,
    })

    // Add deployer if available
    if (deployerAddress) {
      nodes.push({
        id: deployerAddress,
        group: 1,
        value: 0,
        label: "Deployer",
        type: "deployer",
        amount: 0,
      })

      // Get deployer's funding sources
      const deployerFunding = await getDeployerFunding(deployerAddress)

      deployerFunding.sources.forEach((source, index) => {
        nodes.push({
          id: source.address,
          group: 2 + index,
          value: source.transactionCount,
          label: source.label || `Source ${index + 1}`,
          type: source.type as any,
          amount: source.amount,
        })

        links.push({
          source: source.address,
          target: deployerAddress,
          value: source.transactionCount,
          amount: source.amount,
          type: "funding",
        })

        totalFunding += source.amount
        fundingSources++
      })

      // Link deployer to mint
      links.push({
        source: deployerAddress,
        target: mintAddress,
        value: 1,
        amount: deployerFunding.deploymentCost,
        type: "deployment",
      })

      // Update deployer node with total received
      const deployerNode = nodes.find((n) => n.id === deployerAddress)
      if (deployerNode) {
        deployerNode.amount = deployerFunding.totalReceived
        deployerNode.value = deployerFunding.sources.length
      }
    }

    // Get mint address funding (if any direct funding)
    const mintFunding = await getMintFunding(mintAddress)

    mintFunding.sources.forEach((source, index) => {
      // Check if node already exists
      const existingNode = nodes.find((n) => n.id === source.address)
      if (!existingNode) {
        nodes.push({
          id: source.address,
          group: 100 + index,
          value: source.transactionCount,
          label: source.label || `Direct Source ${index + 1}`,
          type: source.type as any,
          amount: source.amount,
        })
      }

      links.push({
        source: source.address,
        target: mintAddress,
        value: source.transactionCount,
        amount: source.amount,
        type: "creation",
      })

      totalFunding += source.amount
      fundingSources++
    })

    // Update mint node
    const mintNode = nodes.find((n) => n.id === mintAddress)
    if (mintNode) {
      mintNode.amount = mintFunding.totalReceived
      mintNode.value = mintFunding.sources.length
    }

    return {
      nodes,
      links,
      totalFunding,
      fundingSources,
    }
  } catch (error) {
    console.error("Error analyzing fund sources:", error)

    // Return minimal data structure on error
    return {
      nodes: [
        {
          id: mintAddress,
          group: 0,
          value: 0,
          label: "Mint Address",
          type: "mint",
          amount: 0,
        },
      ],
      links: [],
      totalFunding: 0,
      fundingSources: 0,
    }
  }
}

async function getDeployerFunding(deployerAddress: string) {
  try {
    // Get deployer's transaction history
    const signatures = await getSignaturesForAddress(deployerAddress, 50)

    const sources: Array<{
      address: string
      amount: number
      transactionCount: number
      type: string
      label?: string
    }> = []

    let totalReceived = 0
    const deploymentCost = 0.01 * 1e9 // Estimate deployment cost

    // Analyze transactions to find funding sources
    for (const sig of signatures.slice(0, 20)) {
      // Limit to recent transactions
      try {
        const tx = await getTransaction(sig.signature)
        if (!tx) continue

        // Analyze transaction for funding patterns
        const fundingInfo = analyzeFundingTransaction(tx, deployerAddress)

        if (fundingInfo.amount > 0) {
          const existingSource = sources.find((s) => s.address === fundingInfo.source)
          if (existingSource) {
            existingSource.amount += fundingInfo.amount
            existingSource.transactionCount++
          } else {
            sources.push({
              address: fundingInfo.source,
              amount: fundingInfo.amount,
              transactionCount: 1,
              type: classifyAddress(fundingInfo.source),
              label: await getAddressLabel(fundingInfo.source),
            })
          }
          totalReceived += fundingInfo.amount
        }
      } catch (error) {
        console.warn("Error analyzing transaction:", error)
      }
    }

    return {
      sources: sources.slice(0, 10), // Limit to top 10 sources
      totalReceived,
      deploymentCost,
    }
  } catch (error) {
    console.error("Error getting deployer funding:", error)
    return { sources: [], totalReceived: 0, deploymentCost: 0 }
  }
}

async function getMintFunding(mintAddress: string) {
  try {
    // Get mint's transaction history
    const signatures = await getSignaturesForAddress(mintAddress, 20)

    const sources: Array<{
      address: string
      amount: number
      transactionCount: number
      type: string
      label?: string
    }> = []

    let totalReceived = 0

    // Analyze creation and early transactions
    for (const sig of signatures.slice(-10)) {
      // Get earliest transactions
      try {
        const tx = await getTransaction(sig.signature)
        if (!tx) continue

        const fundingInfo = analyzeFundingTransaction(tx, mintAddress)

        if (fundingInfo.amount > 0) {
          const existingSource = sources.find((s) => s.address === fundingInfo.source)
          if (existingSource) {
            existingSource.amount += fundingInfo.amount
            existingSource.transactionCount++
          } else {
            sources.push({
              address: fundingInfo.source,
              amount: fundingInfo.amount,
              transactionCount: 1,
              type: classifyAddress(fundingInfo.source),
              label: await getAddressLabel(fundingInfo.source),
            })
          }
          totalReceived += fundingInfo.amount
        }
      } catch (error) {
        console.warn("Error analyzing mint transaction:", error)
      }
    }

    return {
      sources: sources.slice(0, 5), // Limit to top 5 sources
      totalReceived,
    }
  } catch (error) {
    console.error("Error getting mint funding:", error)
    return { sources: [], totalReceived: 0 }
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

function analyzeFundingTransaction(tx: any, targetAddress: string) {
  try {
    // Simplified funding analysis
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
    const balanceChange = (postBalances[targetIndex] || 0) - (preBalances[targetIndex] || 0)

    if (balanceChange > 0) {
      // Find the source of funding (simplified)
      for (let i = 0; i < accountKeys.length; i++) {
        if (i !== targetIndex) {
          const sourceChange = (preBalances[i] || 0) - (postBalances[i] || 0)
          if (sourceChange > 0 && Math.abs(sourceChange - balanceChange) < 1000) {
            // Allow for fees
            const sourceAddress = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i].pubkey
            return { source: sourceAddress, amount: balanceChange }
          }
        }
      }
    }

    return { source: "", amount: 0 }
  } catch (error) {
    console.error("Error analyzing funding transaction:", error)
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

  return "source"
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
