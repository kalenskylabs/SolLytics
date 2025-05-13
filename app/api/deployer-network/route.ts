import { type NextRequest, NextResponse } from "next/server"

const HELIUS_API_KEY = "2a3ff752-d3ef-4b7c-a44a-159dfe9538b6"
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

interface Node {
  id: string
  group: number
  value: number
  label?: string
}

interface Link {
  source: string
  target: string
  value: number
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 })
    }

    // Fetch deployer network data
    const networkData = await getDeployerNetwork(address)

    return NextResponse.json(networkData)
  } catch (error) {
    console.error("Error in deployer-network API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze deployer network" },
      { status: 500 },
    )
  }
}

async function getDeployerNetwork(address: string): Promise<GraphData> {
  try {
    // Get transactions for the deployer
    const transactions = await getTransactions(address)

    // Process transactions to build network graph
    const graphData = buildNetworkGraph(address, transactions)

    return graphData
  } catch (error) {
    console.error("Error fetching deployer network:", error)
    throw error
  }
}

async function getTransactions(address: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getSignaturesForAddress",
        params: [address, { limit: 50 }],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    const signatures = data.result.map((item: any) => item.signature)

    // Get transaction details
    const txDetails = await getTransactionDetails(signatures)

    return txDetails
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return []
  }
}

async function getTransactionDetails(signatures: string[]) {
  if (signatures.length === 0) return []

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getTransactions",
        params: [signatures, { maxSupportedTransactionVersion: 0 }],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
    }

    return data.result || []
  } catch (error) {
    console.error("Error fetching transaction details:", error)
    return []
  }
}

function buildNetworkGraph(deployerAddress: string, transactions: any[]): GraphData {
  // Initialize graph data
  const nodes: Map<string, Node> = new Map()
  const links: Map<string, Link> = new Map()

  // Add deployer as the central node
  nodes.set(deployerAddress, {
    id: deployerAddress,
    group: 1, // Group 1 for deployer
    value: 10, // Larger value for the deployer
    label: "Deployer",
  })

  // Process transactions to extract nodes and links
  transactions.forEach((tx) => {
    if (!tx || !tx.transaction || !tx.transaction.message) return

    // Extract accounts from transaction
    const accounts = tx.transaction.message.accountKeys || []

    // Add nodes for each account
    accounts.forEach((account: any) => {
      const address = account.pubkey

      // Skip if it's the deployer or already processed
      if (address === deployerAddress || nodes.has(address)) return

      // Determine if it's a program (contract) or wallet
      const isProgram = account.signer === false && account.writable === false
      const group = isProgram ? 3 : 2 // Group 3 for contracts, 2 for wallets

      nodes.set(address, {
        id: address,
        group,
        value: isProgram ? 5 : 3, // Larger for programs
      })

      // Create link to deployer
      const linkId = `${deployerAddress}-${address}`
      if (!links.has(linkId)) {
        links.set(linkId, {
          source: deployerAddress,
          target: address,
          value: 1,
        })
      }
    })

    // Add links between accounts in the same transaction
    for (let i = 0; i < accounts.length; i++) {
      const source = accounts[i].pubkey
      if (source === deployerAddress) {
        for (let j = i + 1; j < accounts.length; j++) {
          const target = accounts[j].pubkey
          if (target !== deployerAddress) {
            const linkId = `${source}-${target}`
            if (!links.has(linkId)) {
              links.set(linkId, {
                source,
                target,
                value: 1,
              })
            } else {
              const link = links.get(linkId)!
              link.value += 1
              links.set(linkId, link)
            }
          }
        }
      }
    }
  })

  // Convert maps to arrays
  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()),
  }
}
