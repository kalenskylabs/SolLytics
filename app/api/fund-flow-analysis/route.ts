import { type NextRequest, NextResponse } from "next/server"

const HELIUS_API_KEY = "2a3ff752-d3ef-4b7c-a44a-159dfe9538b6"
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`

interface FundFlowNode {
  id: string
  group: number
  value: number
  label: string
  type: "developer" | "fund_source" | "exchange" | "whale" | "contract" | "unknown"
  amount: number
  transactionCount: number
  fundDirection: "incoming" | "outgoing" | "both"
  riskLevel: "low" | "medium" | "high"
}

interface FundFlowLink {
  source: string
  target: string
  value: number
  amount: number
  type: "funding" | "withdrawal" | "exchange" | "contract_interaction"
  frequency: number
  direction: "to_developer" | "from_developer"
}

interface FundFlowData {
  nodes: FundFlowNode[]
  links: FundFlowLink[]
  totalFundsReceived: number
  totalFundsSent: number
  fundingSources: number
  riskScore: number
  suspiciousPatterns: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { developerAddress } = await request.json()

    if (!developerAddress) {
      return NextResponse.json({ error: "Developer address is required" }, { status: 400 })
    }

    console.log("Analyzing fund flows for developer:", developerAddress)

    // Get fund flow data
    const fundFlowData = await analyzeFundFlows(developerAddress)

    return NextResponse.json(fundFlowData)
  } catch (error) {
    console.error("Error in fund-flow-analysis API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze fund flows" },
      { status: 500 },
    )
  }
}

async function analyzeFundFlows(developerAddress: string): Promise<FundFlowData> {
  try {
    const nodes: FundFlowNode[] = []
    const links: FundFlowLink[] = []
    let totalFundsReceived = 0
    let totalFundsSent = 0
    let fundingSources = 0
    let riskScore = 0
    const suspiciousPatterns: string[] = []

    // Add developer as central node
    nodes.push({
      id: developerAddress,
      group: 0,
      value: 0,
      label: "Developer",
      type: "developer",
      amount: 0,
      transactionCount: 0,
      fundDirection: "both",
      riskLevel: "medium",
    })

    // Get developer's transaction history with focus on fund flows
    const signatures = await getSignaturesForAddress(developerAddress, 200)

    // Track fund flows and sources
    const fundSources = new Map<
      string,
      {
        amount: number
        count: number
        type: string
        lastSeen: number
        direction: "incoming" | "outgoing" | "both"
        riskLevel: "low" | "medium" | "high"
      }
    >()

    // Analyze transactions for fund flow patterns
    for (const sig of signatures.slice(0, 100)) {
      try {
        const tx = await getTransaction(sig.signature)
        if (!tx) continue

        const fundFlow = analyzeFundFlow(tx, developerAddress)

        fundFlow.flows.forEach((flow) => {
          const existing = fundSources.get(flow.address)
          if (existing) {
            existing.amount += flow.amount
            existing.count += 1
            existing.lastSeen = Math.max(existing.lastSeen, sig.blockTime || 0)
            if (existing.direction !== flow.direction) {
              existing.direction = "both"
            }
          } else {
            fundSources.set(flow.address, {
              amount: flow.amount,
              count: 1,
              type: flow.type,
              lastSeen: sig.blockTime || 0,
              direction: flow.direction,
              riskLevel: assessAddressRisk(flow.address, flow.amount, flow.type),
            })
          }

          if (flow.direction === "incoming") {
            totalFundsReceived += flow.amount
          } else {
            totalFundsSent += flow.amount
          }
        })
      } catch (error) {
        console.warn("Error analyzing fund flow transaction:", error)
      }
    }

    // Convert fund sources to nodes and links
    let nodeIndex = 1
    fundSources.forEach((data, address) => {
      if (data.amount > 0.001 * 1e9 && address !== developerAddress) {
        // Only significant amounts (> 0.001 SOL)
        const nodeType = classifyFundSource(address, data.type, data.amount)

        nodes.push({
          id: address,
          group: nodeIndex++,
          value: data.count,
          label: getAddressLabel(address) || `${nodeType.toUpperCase()}`,
          type: nodeType as any,
          amount: data.amount,
          transactionCount: data.count,
          fundDirection: data.direction,
          riskLevel: data.riskLevel,
        })

        links.push({
          source: data.direction === "incoming" ? address : developerAddress,
          target: data.direction === "incoming" ? developerAddress : address,
          value: data.count,
          amount: data.amount,
          type: classifyFlowType(data.type),
          frequency: data.count,
          direction: data.direction === "incoming" ? "to_developer" : "from_developer",
        })

        if (data.direction === "incoming") {
          fundingSources++
        }
      }
    })

    // Update developer node with totals
    const developerNode = nodes.find((n) => n.id === developerAddress)
    if (developerNode) {
      developerNode.amount = totalFundsReceived + totalFundsSent
      developerNode.transactionCount = signatures.length
      developerNode.value = fundingSources
    }

    // Analyze suspicious patterns
    suspiciousPatterns.push(...detectSuspiciousPatterns(nodes, links, totalFundsReceived, totalFundsSent))

    // Calculate risk score based on fund flow patterns
    riskScore = calculateFundFlowRiskScore(nodes, links, totalFundsReceived, totalFundsSent, suspiciousPatterns)

    // Add secondary connections for major fund sources
    const majorSources = nodes
      .filter((n) => n.type !== "developer" && n.amount > 1 * 1e9) // > 1 SOL
      .slice(0, 3)

    for (const source of majorSources) {
      try {
        const secondaryFlows = await getSecondaryFundFlows(source.id, 5)
        secondaryFlows.forEach((flow, index) => {
          if (!nodes.find((n) => n.id === flow.address) && index < 2) {
            nodes.push({
              id: flow.address,
              group: 200 + index,
              value: flow.count,
              label: getAddressLabel(flow.address) || "Secondary",
              type: classifyFundSource(flow.address, flow.type, flow.amount) as any,
              amount: flow.amount,
              transactionCount: flow.count,
              fundDirection: flow.direction,
              riskLevel: assessAddressRisk(flow.address, flow.amount, flow.type),
            })

            links.push({
              source: flow.direction === "incoming" ? flow.address : source.id,
              target: flow.direction === "incoming" ? source.id : flow.address,
              value: flow.count,
              amount: flow.amount,
              type: "funding",
              frequency: flow.count,
              direction: flow.direction === "incoming" ? "to_developer" : "from_developer",
            })
          }
        })
      } catch (error) {
        console.warn("Error getting secondary fund flows:", error)
      }
    }

    return {
      nodes: nodes.slice(0, 30), // Limit for performance
      links: links.slice(0, 50),
      totalFundsReceived,
      totalFundsSent,
      fundingSources,
      riskScore,
      suspiciousPatterns: suspiciousPatterns.slice(0, 5),
    }
  } catch (error) {
    console.error("Error analyzing fund flows:", error)

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
          transactionCount: 0,
          fundDirection: "both",
          riskLevel: "medium",
        },
      ],
      links: [],
      totalFundsReceived: 0,
      totalFundsSent: 0,
      fundingSources: 0,
      riskScore: 50,
      suspiciousPatterns: ["Unable to analyze fund flows"],
    }
  }
}

async function getSignaturesForAddress(address: string, limit = 100) {
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

function analyzeFundFlow(tx: any, developerAddress: string) {
  const flows: Array<{
    address: string
    amount: number
    type: string
    direction: "incoming" | "outgoing"
  }> = []

  try {
    const preBalances = tx.meta?.preBalances || []
    const postBalances = tx.meta?.postBalances || []
    const accountKeys = tx.transaction?.message?.accountKeys || []

    // Find developer's position in the transaction
    const developerIndex = accountKeys.findIndex(
      (key: any) => (typeof key === "string" ? key : key.pubkey) === developerAddress,
    )

    if (developerIndex === -1) return { flows }

    const developerBalanceChange = (postBalances[developerIndex] || 0) - (preBalances[developerIndex] || 0)

    // Analyze balance changes for all accounts
    for (let i = 0; i < accountKeys.length; i++) {
      if (i !== developerIndex) {
        const address = typeof accountKeys[i] === "string" ? accountKeys[i] : accountKeys[i].pubkey
        const balanceChange = (postBalances[i] || 0) - (preBalances[i] || 0)

        // Determine if this is a fund flow to/from developer
        if (Math.abs(balanceChange) > 10000) {
          // > 0.00001 SOL
          const direction = developerBalanceChange > 0 ? "incoming" : "outgoing"

          flows.push({
            address,
            amount: Math.abs(balanceChange),
            type: determineFundFlowType(tx, address),
            direction,
          })
        }
      }
    }
  } catch (error) {
    console.error("Error analyzing fund flow:", error)
  }

  return { flows }
}

function determineFundFlowType(tx: any, address: string): string {
  const instructions = tx.transaction?.message?.instructions || []

  for (const instruction of instructions) {
    const programId = instruction.programId || instruction.program

    if (programId === "11111111111111111111111111111111") return "transfer"
    if (programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") return "token_transfer"
    if (programId === "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin") return "dex_trade"
    if (programId?.includes("Stake")) return "staking"
  }

  return "unknown"
}

function classifyFundSource(address: string, flowType: string, amount: number): string {
  // Known exchange addresses
  const exchanges = [
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Binance
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // FTX
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S", // Coinbase
  ]

  if (exchanges.includes(address)) return "exchange"

  // Classify as whale if large amounts
  if (amount > 10 * 1e9) return "whale" // > 10 SOL

  // Classify based on flow type
  if (flowType === "dex_trade") return "exchange"
  if (flowType === "staking") return "contract"
  if (flowType === "token_transfer") return "contract"

  // Check if it's a program/contract
  if (address.length === 44 && (address.includes("1111") || address.startsWith("So1"))) {
    return "contract"
  }

  return "fund_source"
}

function classifyFlowType(type: string): "funding" | "withdrawal" | "exchange" | "contract_interaction" {
  switch (type) {
    case "transfer":
      return "funding"
    case "dex_trade":
      return "exchange"
    case "token_transfer":
      return "contract_interaction"
    case "staking":
      return "contract_interaction"
    default:
      return "funding"
  }
}

function assessAddressRisk(address: string, amount: number, type: string): "low" | "medium" | "high" {
  // Known safe addresses (exchanges, etc.)
  const safeAddresses = [
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Binance
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // FTX
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S", // Coinbase
  ]

  if (safeAddresses.includes(address)) return "low"

  // High amounts from unknown sources are risky
  if (amount > 100 * 1e9 && type === "unknown") return "high" // > 100 SOL

  // Medium risk for large amounts
  if (amount > 10 * 1e9) return "medium" // > 10 SOL

  return "low"
}

function getAddressLabel(address: string): string | undefined {
  const labels: Record<string, string> = {
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "Binance",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "FTX",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "Coinbase",
    So11111111111111111111111111111111111111112: "Wrapped SOL",
    "11111111111111111111111111111111": "System Program",
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": "Serum DEX",
    TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "Token Program",
  }

  return labels[address]
}

async function getSecondaryFundFlows(address: string, limit = 5) {
  try {
    const signatures = await getSignaturesForAddress(address, limit)
    const flows: Array<{
      address: string
      amount: number
      count: number
      type: string
      direction: "incoming" | "outgoing" | "both"
    }> = []

    for (const sig of signatures.slice(0, 3)) {
      try {
        const tx = await getTransaction(sig.signature)
        if (!tx) continue

        const analysis = analyzeFundFlow(tx, address)
        analysis.flows.forEach((flow) => {
          const existing = flows.find((f) => f.address === flow.address)
          if (existing) {
            existing.amount += flow.amount
            existing.count += 1
            if (existing.direction !== flow.direction) {
              existing.direction = "both"
            }
          } else {
            flows.push({
              address: flow.address,
              amount: flow.amount,
              count: 1,
              type: flow.type,
              direction: flow.direction,
            })
          }
        })
      } catch (error) {
        console.warn("Error analyzing secondary fund flow:", error)
      }
    }

    return flows.filter((f) => f.amount > 0.1 * 1e9).slice(0, 2) // > 0.1 SOL, top 2
  } catch (error) {
    console.error("Error getting secondary fund flows:", error)
    return []
  }
}

function detectSuspiciousPatterns(
  nodes: FundFlowNode[],
  links: FundFlowLink[],
  totalReceived: number,
  totalSent: number,
): string[] {
  const patterns: string[] = []

  // Check for circular funding
  const incomingNodes = nodes.filter((n) => n.fundDirection === "incoming" && n.type !== "developer")
  const outgoingNodes = nodes.filter((n) => n.fundDirection === "outgoing" && n.type !== "developer")

  const commonAddresses = incomingNodes.filter((incoming) =>
    outgoingNodes.some((outgoing) => outgoing.id === incoming.id),
  )

  if (commonAddresses.length > 0) {
    patterns.push("Circular funding detected")
  }

  // Check for wash trading patterns
  if (totalSent > totalReceived * 0.8 && totalSent > 5 * 1e9) {
    patterns.push("Potential wash trading")
  }

  // Check for suspicious funding sources
  const unknownSources = nodes.filter((n) => n.type === "unknown" && n.amount > 1 * 1e9)
  if (unknownSources.length > 3) {
    patterns.push("Multiple unknown funding sources")
  }

  // Check for rapid fund movement
  const highFrequencyLinks = links.filter((l) => l.frequency > 20)
  if (highFrequencyLinks.length > 2) {
    patterns.push("High frequency transactions")
  }

  // Check for lack of exchange funding
  const exchangeNodes = nodes.filter((n) => n.type === "exchange")
  if (exchangeNodes.length === 0 && totalReceived > 10 * 1e9) {
    patterns.push("No exchange funding detected")
  }

  return patterns
}

function calculateFundFlowRiskScore(
  nodes: FundFlowNode[],
  links: FundFlowLink[],
  totalReceived: number,
  totalSent: number,
  suspiciousPatterns: string[],
): number {
  let score = 30 // Start with low-medium score

  // Suspicious patterns increase risk significantly
  score += suspiciousPatterns.length * 15

  // High volume without exchange funding is risky
  const exchangeNodes = nodes.filter((n) => n.type === "exchange")
  if (exchangeNodes.length === 0 && totalReceived > 10 * 1e9) {
    score += 20
  }

  // Many unknown sources increase risk
  const unknownSources = nodes.filter((n) => n.type === "unknown")
  score += unknownSources.length * 5

  // High-risk nodes increase overall risk
  const highRiskNodes = nodes.filter((n) => n.riskLevel === "high")
  score += highRiskNodes.length * 10

  // Whale funding can be risky or legitimate
  const whaleNodes = nodes.filter((n) => n.type === "whale")
  if (whaleNodes.length > 2) {
    score += 10
  }

  // Exchange funding reduces risk
  score -= exchangeNodes.length * 8

  // Contract interactions can be positive
  const contractNodes = nodes.filter((n) => n.type === "contract")
  if (contractNodes.length > 0 && contractNodes.length < 5) {
    score -= 5
  }

  // Ensure score is within bounds
  return Math.max(0, Math.min(100, score))
}
