import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import { heliusAPI } from "@/lib/helius-api"

// Known scam addresses and blacklisted programs
const SCAM_ADDRESSES = new Set([
  "9hFtS2YFdEYjLzuM1jMjqTADVPT3R7RLLxd3nJyHzLh1",
  "8JzMwDj9N5LNUKRuCJz2PGwHwwMqZHNBVHLvFVGZnNcJ",
  "7YttLkHDoNj9wyDur5pM1ejNaAvUTZQEUzprmjpeyNX1",
  "ScamProgram111111111111111111111111111111111",
  "FakeToken22222222222222222222222222222222222",
])

const BLACKLISTED_PROGRAMS = new Set([
  "ScamProgram111111111111111111111111111111111",
  "FakeToken22222222222222222222222222222222222",
  "MaliciousDEX1111111111111111111111111111111",
])

// Known legitimate programs (positive indicators)
const LEGITIMATE_PROGRAMS = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // Raydium
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD", // Marinade
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpool
])

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json()

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    // Validate wallet address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 })
    }

    console.log(`Analyzing wallet: ${walletAddress}`)

    // Fetch real blockchain data using Helius API with better error handling
    let transactions = []
    let tokenBalances = []
    let accountInfo = null

    try {
      transactions = await heliusAPI.getTransactionHistory(walletAddress, 100)
      console.log(`Successfully fetched ${transactions.length} transactions`)
    } catch (error) {
      console.warn("Failed to fetch transaction history:", error)
      transactions = []
    }

    try {
      tokenBalances = await heliusAPI.getTokenBalances(walletAddress)
      console.log(`Successfully fetched ${tokenBalances.length} token balances`)
    } catch (error) {
      console.warn("Failed to fetch token balances:", error)
      tokenBalances = []
    }

    try {
      accountInfo = await heliusAPI.getAccountInfo(walletAddress)
      console.log("Successfully fetched account info")
    } catch (error) {
      console.warn("Failed to fetch account info:", error)
      accountInfo = null
    }

    // Analyze wallet data
    const walletAnalysis = analyzeWalletData(transactions, tokenBalances, accountInfo, walletAddress)

    // Calculate reputability score
    const { score, factors } = calculateReputabilityScore(walletAnalysis)

    // Generate AI explanation using Grok
    const explanation = await generateAIExplanation(walletAnalysis, score)

    // Determine risk level
    const riskLevel = score >= 80 ? "low" : score >= 60 ? "medium" : "high"

    // Generate recommendations
    const recommendations = generateRecommendations(walletAnalysis, score)

    return NextResponse.json({
      score,
      explanation,
      factors,
      riskLevel,
      recommendations,
      walletAnalysis, // Include raw analysis for debugging
    })
  } catch (error) {
    console.error("Error generating reputability score:", error)
    return NextResponse.json({ error: "Failed to generate reputability score. Please try again." }, { status: 500 })
  }
}

function analyzeWalletData(transactions: any[], tokenBalances: any[], accountInfo: any, walletAddress: string) {
  const now = Date.now()
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

  // Analyze transactions
  let flaggedInteractions = 0
  let blacklistedProgramUsage = 0
  let legitimateProgramUsage = 0
  let largeTransfers = 0
  let totalVolume = 0
  const counterparties = new Set<string>()
  const programsUsed = new Set<string>()
  let stakingTransactions = 0
  let oldestTransaction = now

  // Only analyze if we have transactions
  if (transactions && transactions.length > 0) {
    transactions.forEach((tx) => {
      const txTime = tx.timestamp * 1000
      if (txTime < oldestTransaction) {
        oldestTransaction = txTime
      }

      // Check for flagged address interactions
      if (tx.nativeTransfers && Array.isArray(tx.nativeTransfers)) {
        tx.nativeTransfers.forEach((transfer: any) => {
          if (SCAM_ADDRESSES.has(transfer.fromUserAccount) || SCAM_ADDRESSES.has(transfer.toUserAccount)) {
            flaggedInteractions++
          }
          if (transfer.fromUserAccount !== walletAddress) counterparties.add(transfer.fromUserAccount)
          if (transfer.toUserAccount !== walletAddress) counterparties.add(transfer.toUserAccount)

          // Track large transfers (>10 SOL)
          if (transfer.amount > 10 * 1e9) {
            largeTransfers++
          }
          totalVolume += transfer.amount || 0
        })
      }

      // Check token transfers
      if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
        tx.tokenTransfers.forEach((transfer: any) => {
          if (transfer.fromUserAccount !== walletAddress) counterparties.add(transfer.fromUserAccount)
          if (transfer.toUserAccount !== walletAddress) counterparties.add(transfer.toUserAccount)
        })
      }

      // Analyze program interactions
      if (tx.instructions && Array.isArray(tx.instructions)) {
        tx.instructions.forEach((instruction: any) => {
          const programId = instruction.programId
          if (programId) {
            programsUsed.add(programId)

            if (BLACKLISTED_PROGRAMS.has(programId)) {
              blacklistedProgramUsage++
            }

            if (LEGITIMATE_PROGRAMS.has(programId)) {
              legitimateProgramUsage++
            }

            // Check for staking-related instructions
            if (
              programId === "Stake11111111111111111111111111111111111111" ||
              (instruction.data && instruction.data.includes && instruction.data.includes("stake")) ||
              (instruction.data && instruction.data.includes && instruction.data.includes("delegate"))
            ) {
              stakingTransactions++
            }
          }
        })
      }
    })
  }

  // Calculate wallet age in months
  const walletAgeMs = now - oldestTransaction
  const walletAgeMonths = transactions.length > 0 ? Math.max(0.1, walletAgeMs / (30 * 24 * 60 * 60 * 1000)) : 0.1

  // Calculate activity metrics
  const recentTransactions = transactions.filter((tx) => tx.timestamp * 1000 > oneMonthAgo).length
  const transactionFrequency = recentTransactions / 30 // transactions per day

  // Calculate counterparty diversity (0-1 scale)
  const counterpartyDiversity =
    transactions.length > 0 ? Math.min(1, counterparties.size / Math.max(1, transactions.length * 0.5)) : 0

  // Calculate staking activity ratio
  const stakingActivityRatio = transactions.length > 0 ? stakingTransactions / transactions.length : 0

  // Analyze token portfolio
  const tokenCount = tokenBalances ? tokenBalances.length : 0
  const hasStakedTokens =
    tokenBalances && tokenBalances.length > 0
      ? tokenBalances.some((token: any) => {
          const tokenData = token.account?.data?.parsed?.info
          return tokenData?.state === "staked" || tokenData?.delegatedAmount > 0
        })
      : false

  return {
    flaggedInteractions,
    blacklistedProgramUsage,
    legitimateProgramUsage,
    largeTransfers,
    totalVolume,
    counterpartyCount: counterparties.size,
    counterpartyDiversity,
    walletAgeMonths,
    transactionCount: transactions.length,
    recentTransactions,
    transactionFrequency,
    stakingTransactions,
    stakingActivityRatio,
    tokenCount,
    hasStakedTokens,
    programsUsed: Array.from(programsUsed),
    uniquePrograms: programsUsed.size,
  }
}

function calculateReputabilityScore(analysis: any) {
  let score = 50 // Base score
  const factors = []

  // Negative factors
  const flaggedPenalty = analysis.flaggedInteractions * 15
  score -= flaggedPenalty
  factors.push({
    name: "Flagged Address Interactions",
    impact: -flaggedPenalty,
    description: `${analysis.flaggedInteractions} interactions with known scam/malicious addresses`,
    type: analysis.flaggedInteractions > 0 ? "negative" : "positive",
  })

  const blacklistedPenalty = analysis.blacklistedProgramUsage * 20
  score -= blacklistedPenalty
  factors.push({
    name: "Blacklisted Program Usage",
    impact: -blacklistedPenalty,
    description: `${analysis.blacklistedProgramUsage} interactions with blacklisted programs`,
    type: analysis.blacklistedProgramUsage > 0 ? "negative" : "positive",
  })

  const largeTransferPenalty = Math.min(analysis.largeTransfers * 3, 30)
  score -= largeTransferPenalty
  factors.push({
    name: "Large Transfer Activity",
    impact: -largeTransferPenalty,
    description: `${analysis.largeTransfers} large transfers (>10 SOL) detected`,
    type: analysis.largeTransfers > 5 ? "negative" : "neutral",
  })

  // Positive factors
  const diversityBonus = Math.round(analysis.counterpartyDiversity * 20)
  score += diversityBonus
  factors.push({
    name: "Counterparty Diversity",
    impact: diversityBonus,
    description: `${analysis.counterpartyCount} unique counterparties (${(analysis.counterpartyDiversity * 100).toFixed(1)}% diversity)`,
    type: analysis.counterpartyDiversity > 0.3 ? "positive" : "neutral",
  })

  const stakingBonus = Math.round(analysis.stakingActivityRatio * 25)
  score += stakingBonus
  factors.push({
    name: "Staking Activity",
    impact: stakingBonus,
    description: `${analysis.stakingTransactions} staking transactions (${(analysis.stakingActivityRatio * 100).toFixed(1)}% of activity)`,
    type: analysis.stakingActivityRatio > 0.1 ? "positive" : "neutral",
  })

  const ageBonus = Math.min(Math.round(analysis.walletAgeMonths * 2), 24)
  score += ageBonus
  factors.push({
    name: "Wallet Age",
    impact: ageBonus,
    description: `${analysis.walletAgeMonths.toFixed(1)} months of on-chain history`,
    type: analysis.walletAgeMonths > 3 ? "positive" : "neutral",
  })

  const legitimateBonus = Math.min(analysis.legitimateProgramUsage * 2, 20)
  score += legitimateBonus
  factors.push({
    name: "Legitimate Program Usage",
    impact: legitimateBonus,
    description: `${analysis.legitimateProgramUsage} interactions with verified DeFi protocols`,
    type: analysis.legitimateProgramUsage > 0 ? "positive" : "neutral",
  })

  const activityBonus = Math.min(Math.round(analysis.transactionFrequency * 5), 15)
  score += activityBonus
  factors.push({
    name: "Transaction Activity",
    impact: activityBonus,
    description: `${analysis.transactionFrequency.toFixed(2)} transactions per day (recent activity)`,
    type: analysis.transactionFrequency > 0.1 && analysis.transactionFrequency < 10 ? "positive" : "neutral",
  })

  // Normalize score to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)))

  return { score, factors }
}

async function generateAIExplanation(analysis: any, score: number) {
  try {
    const prompt = `
    Analyze this Solana wallet's reputability based on real blockchain data:
    
    Wallet Metrics:
    - Flagged address interactions: ${analysis.flaggedInteractions}
    - Blacklisted program usage: ${analysis.blacklistedProgramUsage}
    - Large transfers (>10 SOL): ${analysis.largeTransfers}
    - Counterparty diversity: ${(analysis.counterpartyDiversity * 100).toFixed(1)}%
    - Staking activity ratio: ${(analysis.stakingActivityRatio * 100).toFixed(1)}%
    - Wallet age: ${analysis.walletAgeMonths.toFixed(1)} months
    - Total transactions: ${analysis.transactionCount}
    - Recent activity: ${analysis.recentTransactions} transactions in last 30 days
    - Legitimate DeFi usage: ${analysis.legitimateProgramUsage} interactions
    - Unique programs used: ${analysis.uniquePrograms}
    
    Calculated reputability score: ${score}/100
    
    Provide a clear, professional explanation (2-3 sentences) of this wallet's trustworthiness. Focus on the most significant factors that influenced the score, both positive and negative. Be specific about what the data reveals about the wallet's behavior patterns.
    `

    const { text } = await generateText({
      model: xai("grok-3-mini"),
      prompt,
      maxTokens: 250,
      temperature: 0.7,
    })

    return text
  } catch (error) {
    console.error("Error generating AI explanation:", error)

    // Fallback explanation based on score
    if (score >= 80) {
      return `This wallet demonstrates excellent reputability with a score of ${score}/100. The analysis shows no interactions with flagged addresses, consistent staking activity, and healthy transaction patterns across ${analysis.counterpartyCount} unique counterparties. The ${analysis.walletAgeMonths.toFixed(1)}-month history and ${analysis.legitimateProgramUsage} verified DeFi interactions support its trustworthiness.`
    } else if (score >= 60) {
      return `This wallet shows good reputability with a score of ${score}/100. While there are ${analysis.flaggedInteractions} flagged interactions and ${analysis.largeTransfers} large transfers, the ${analysis.stakingTransactions} staking transactions and diverse counterparty interactions indicate legitimate usage patterns over ${analysis.walletAgeMonths.toFixed(1)} months.`
    } else {
      return `This wallet has concerning reputability indicators with a score of ${score}/100. The analysis reveals ${analysis.flaggedInteractions} flagged address interactions, ${analysis.blacklistedProgramUsage} blacklisted program usage, and ${analysis.largeTransfers} large transfers. The limited staking activity and ${analysis.walletAgeMonths.toFixed(1)}-month age suggest elevated risk.`
    }
  }
}

function generateRecommendations(analysis: any, score: number) {
  const recommendations = []

  if (analysis.flaggedInteractions > 0) {
    recommendations.push("Avoid future interactions with flagged or suspicious addresses to improve reputation")
  }

  if (analysis.blacklistedProgramUsage > 0) {
    recommendations.push("Cease using blacklisted programs and stick to verified DeFi protocols")
  }

  if (analysis.stakingActivityRatio < 0.1) {
    recommendations.push("Consider staking SOL or tokens to demonstrate long-term commitment to the ecosystem")
  }

  if (analysis.counterpartyDiversity < 0.3) {
    recommendations.push("Diversify transaction counterparties to show legitimate usage patterns")
  }

  if (analysis.legitimateProgramUsage < 3) {
    recommendations.push("Increase usage of verified DeFi protocols like Jupiter, Raydium, or Marinade")
  }

  if (analysis.walletAgeMonths < 3) {
    recommendations.push("Continue building transaction history over time to establish credibility")
  }

  if (analysis.largeTransfers > 10) {
    recommendations.push("Reduce frequency of large transfers to avoid triggering risk algorithms")
  }

  if (recommendations.length === 0) {
    recommendations.push("Maintain current positive behavior patterns and continue regular DeFi participation")
    recommendations.push("Consider increasing staking activity to further improve reputation score")
  }

  return recommendations
}
