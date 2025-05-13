"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, AlertCircle } from "lucide-react"
import * as d3 from "d3"
import { heliusAPI } from "@/lib/helius-api"

interface Node {
  id: string
  address: string
  balance: number
  transactionCount: number
  type: "main" | "frequent" | "occasional"
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
  radius?: number
}

interface Link {
  source: string | Node
  target: string | Node
  value: number
  type: "transfer" | "swap" | "stake"
  count: number
  direction: "incoming" | "outgoing" | "both"
}

interface TransactionGraphProps {
  wallet: string
}

// System addresses to exclude from visualization
const SYSTEM_ADDRESSES = new Set([
  "11111111111111111111111111111111", // System Program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token Program
  "ComputeBudget111111111111111111111111111111", // Compute Budget Program
  "SysvarRent111111111111111111111111111111111", // Sysvar Rent
  "SysvarC1ock11111111111111111111111111111111", // Sysvar Clock
])

export function TransactionGraph({ wallet }: TransactionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchProgress, setFetchProgress] = useState<string | null>(null)

  useEffect(() => {
    console.log("TransactionGraph useEffect triggered with wallet:", wallet)
    console.log("SVG ref available:", !!svgRef.current)

    if (!wallet || wallet.trim() === "") {
      console.log("No wallet provided, setting error state")
      setLoading(false)
      setError("No wallet address provided")
      return
    }

    let frameId: number
    let cancelled = false

    // Wait for SVG to mount using requestAnimationFrame for better React sync
    const waitForSVG = (retries = 0) => {
      if (cancelled) return

      if (svgRef.current) {
        console.log("SVG ref is now available, proceeding with graph creation")
        fetchTransactionGraph()
      } else if (retries < 20) {
        console.log(`SVG ref not available yet, retry ${retries + 1}/20`)
        frameId = requestAnimationFrame(() => waitForSVG(retries + 1))
      } else {
        console.error("SVG ref never became available after maximum retries")
        setError("Unable to initialize graph visualization - SVG element not found")
        setLoading(false)
      }
    }

    waitForSVG()

    async function fetchTransactionGraph() {
      if (cancelled) return

      console.log("Starting fetchTransactionGraph for wallet:", wallet)
      setLoading(true)
      setError(null)
      setFetchProgress("Initializing...")

      try {
        // Validate wallet address format first
        const trimmedWallet = wallet.trim()
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedWallet)) {
          throw new Error(`Invalid wallet address format: ${trimmedWallet}`)
        }

        setFetchProgress("Fetching transaction history...")
        console.log("Fetching transaction history for:", trimmedWallet)

        // Fetch transaction history with retry logic
        let transactions: any[] = []
        let retryCount = 0
        const maxRetries = 3

        while (retryCount < maxRetries) {
          try {
            transactions = await fetchWithTimeout(
              () => heliusAPI.getTransactionHistory(trimmedWallet, 100),
              15000, // 15 second timeout
            )
            console.log(`Successfully fetched ${transactions.length} transactions`)
            break
          } catch (apiError) {
            retryCount++
            console.error(`API Error fetching transactions (attempt ${retryCount}/${maxRetries}):`, apiError)
            if (retryCount >= maxRetries) {
              console.error("Maximum retries reached for transaction fetch")
              // Continue with empty transactions to show at least the main wallet
              transactions = []
            } else {
              // Wait before retrying (exponential backoff)
              await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
            }
          }
        }

        if (cancelled) return

        // Process transaction data to create graph nodes and links
        setFetchProgress("Processing transaction data...")
        const nodeMap = new Map<string, Node>()
        const linkMap = new Map<string, Link>()
        const addressFrequency: Record<string, number> = {}
        const addressBalance: Record<string, number> = {}
        const addressIncoming: Record<string, number> = {}
        const addressOutgoing: Record<string, number> = {}

        // Initialize main wallet node
        const mainNode: Node = {
          id: trimmedWallet,
          address: trimmedWallet,
          balance: 0,
          transactionCount: transactions.length,
          type: "main",
        }
        nodeMap.set(trimmedWallet, mainNode)

        // Try to get balance for the main wallet
        try {
          setFetchProgress("Fetching main wallet balance...")
          const balanceData = await fetchWithTimeout(() => heliusAPI.getBalances(trimmedWallet), 10000)
          mainNode.balance = balanceData.nativeBalance / 1000000000
          console.log(`Main wallet balance: ${mainNode.balance} SOL`)
        } catch (balanceError) {
          console.log("Could not fetch main wallet balance:", balanceError)
        }

        if (transactions.length === 0) {
          console.log("No transactions found, showing single node")
          if (!cancelled) {
            renderGraph([mainNode], [])
            setLoading(false)
          }
          return
        }

        console.log("Processing transactions...")
        setFetchProgress("Analyzing transaction patterns...")

        // Process transactions to find connected wallets
        for (const tx of transactions) {
          // Process native transfers
          if (tx.nativeTransfers && Array.isArray(tx.nativeTransfers)) {
            tx.nativeTransfers.forEach((transfer: any) => {
              const fromAddress = transfer.fromUserAccount
              const toAddress = transfer.toUserAccount
              const amount = (transfer.amount || 0) / 1000000000 // Convert lamports to SOL

              // Skip system addresses
              if (SYSTEM_ADDRESSES.has(fromAddress) || SYSTEM_ADDRESSES.has(toAddress)) {
                return
              }

              // Track transaction frequencies
              if (fromAddress && fromAddress !== trimmedWallet && typeof fromAddress === "string") {
                addressFrequency[fromAddress] = (addressFrequency[fromAddress] || 0) + 1
                addressOutgoing[fromAddress] = (addressOutgoing[fromAddress] || 0) + amount
              }
              if (toAddress && toAddress !== trimmedWallet && typeof toAddress === "string") {
                addressFrequency[toAddress] = (addressFrequency[toAddress] || 0) + 1
                addressIncoming[toAddress] = (addressIncoming[toAddress] || 0) + amount
              }

              // Track SOL balances (approximate based on transfers)
              if (fromAddress && typeof fromAddress === "string" && !SYSTEM_ADDRESSES.has(fromAddress)) {
                addressBalance[fromAddress] = (addressBalance[fromAddress] || 0) - amount
              }
              if (toAddress && typeof toAddress === "string" && !SYSTEM_ADDRESSES.has(toAddress)) {
                addressBalance[toAddress] = (addressBalance[toAddress] || 0) + amount
              }

              // Create link between addresses
              if (fromAddress && toAddress && !SYSTEM_ADDRESSES.has(fromAddress) && !SYSTEM_ADDRESSES.has(toAddress)) {
                const linkKey = `${fromAddress}-${toAddress}`

                if (linkMap.has(linkKey)) {
                  const existingLink = linkMap.get(linkKey)!
                  existingLink.value += amount
                  existingLink.count += 1
                } else {
                  // Determine direction relative to main wallet
                  let direction: "incoming" | "outgoing" | "both" = "both"
                  if (fromAddress === trimmedWallet) direction = "outgoing"
                  if (toAddress === trimmedWallet) direction = "incoming"

                  linkMap.set(linkKey, {
                    source: fromAddress,
                    target: toAddress,
                    value: amount,
                    type: "transfer",
                    count: 1,
                    direction,
                  })
                }
              }
            })
          }

          // Process token transfers
          if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
            tx.tokenTransfers.forEach((transfer: any) => {
              const fromAddress = transfer.fromUserAccount
              const toAddress = transfer.toUserAccount

              // Skip system addresses
              if (SYSTEM_ADDRESSES.has(fromAddress) || SYSTEM_ADDRESSES.has(toAddress)) {
                return
              }

              if (fromAddress && fromAddress !== trimmedWallet && typeof fromAddress === "string") {
                addressFrequency[fromAddress] = (addressFrequency[fromAddress] || 0) + 1
              }
              if (toAddress && toAddress !== trimmedWallet && typeof toAddress === "string") {
                addressFrequency[toAddress] = (addressFrequency[toAddress] || 0) + 1
              }

              // Create link for token transfers
              if (fromAddress && toAddress && !SYSTEM_ADDRESSES.has(fromAddress) && !SYSTEM_ADDRESSES.has(toAddress)) {
                const linkKey = `${fromAddress}-${toAddress}`

                if (linkMap.has(linkKey)) {
                  const existingLink = linkMap.get(linkKey)!
                  existingLink.count += 1
                  if (transfer.symbol) existingLink.type = "swap"
                } else {
                  // Determine direction relative to main wallet
                  let direction: "incoming" | "outgoing" | "both" = "both"
                  if (fromAddress === trimmedWallet) direction = "outgoing"
                  if (toAddress === trimmedWallet) direction = "incoming"

                  linkMap.set(linkKey, {
                    source: fromAddress,
                    target: toAddress,
                    value: 0.1, // Token transfers get a small value for visualization
                    type: transfer.symbol ? "swap" : "transfer",
                    count: 1,
                    direction,
                  })
                }
              }
            })
          }
        }

        console.log(`Found ${Object.keys(addressFrequency).length} connected addresses`)

        // Create nodes for connected addresses (limit to top 15 most frequent)
        const topAddresses = Object.entries(addressFrequency)
          .filter(([address]) => !SYSTEM_ADDRESSES.has(address)) // Filter out system addresses
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)

        setFetchProgress("Fetching connected wallet balances...")

        // Create nodes for all connected addresses
        for (const [address, frequency] of topAddresses) {
          if (!nodeMap.has(address)) {
            const nodeType = frequency > 3 ? "frequent" : "occasional"

            // Use the approximate balance from transfers as a fallback
            const approxBalance = addressBalance[address] || 0

            nodeMap.set(address, {
              id: address,
              address: address,
              balance: approxBalance,
              transactionCount: frequency,
              type: nodeType,
            })
          }
        }

        // Fetch actual balances for the top connected wallets
        const balanceFetchPromises = topAddresses.slice(0, 5).map(async ([address]) => {
          if (address === trimmedWallet) return // Skip main wallet, already fetched

          try {
            const balanceData = await fetchWithTimeout(() => heliusAPI.getBalances(address), 5000)
            const node = nodeMap.get(address)
            if (node) {
              node.balance = balanceData.nativeBalance / 1000000000
              console.log(`Fetched balance for ${address}: ${node.balance} SOL`)
            }
          } catch (error) {
            console.log(`Could not fetch balance for ${address}:`, error)
            // Keep the approximate balance
          }
        })

        // Wait for balance fetches with a timeout
        try {
          await Promise.all(balanceFetchPromises.map((p) => p.catch((e) => console.error(e))))
        } catch (error) {
          console.error("Error fetching connected wallet balances:", error)
        }

        if (cancelled) return

        // Ensure all nodes have at least one connection to prevent disconnected bubbles
        setFetchProgress("Building network graph...")

        // Convert maps to arrays
        const nodes = Array.from(nodeMap.values())
        let links = Array.from(linkMap.values())

        // Filter links to only include those with nodes in our graph
        links = links.filter((link) => {
          const sourceExists = nodes.some(
            (n) => n.id === (typeof link.source === "string" ? link.source : link.source.id),
          )
          const targetExists = nodes.some(
            (n) => n.id === (typeof link.target === "string" ? link.target : link.target.id),
          )
          return sourceExists && targetExists
        })

        // Ensure all nodes have at least one connection to the main wallet
        const connectedNodeIds = new Set<string>()
        links.forEach((link) => {
          const sourceId = typeof link.source === "string" ? link.source : link.source.id
          const targetId = typeof link.target === "string" ? link.target : link.target.id
          connectedNodeIds.add(sourceId)
          connectedNodeIds.add(targetId)
        })

        // Add connections for any disconnected nodes
        nodes.forEach((node) => {
          if (node.id !== trimmedWallet && !connectedNodeIds.has(node.id)) {
            console.log(`Adding missing connection for node: ${node.id}`)
            links.push({
              source: trimmedWallet,
              target: node.id,
              value: 0.01,
              type: "transfer",
              count: 1,
              direction: "outgoing", // Default direction
            })
          }
        })

        console.log(`Rendering graph with ${nodes.length} nodes and ${links.length} links`)

        // Render the graph
        renderGraph(nodes, links)
        setLoading(false)
      } catch (error) {
        console.error("Error creating transaction graph:", error)
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Failed to load transaction graph")
          setLoading(false)
        }
      }
    }

    // Helper function to add timeout to any promise
    async function fetchWithTimeout(fetchFn: () => Promise<any>, timeoutMs: number) {
      return Promise.race([
        fetchFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ])
    }

    function renderGraph(nodes: Node[], links: Link[]) {
      if (cancelled) return

      console.log("Starting renderGraph with", nodes.length, "nodes and", links.length, "links")

      if (!svgRef.current) {
        console.error("SVG ref not available in renderGraph")
        setError("Unable to render graph - SVG element not found")
        return
      }

      const svg = d3.select(svgRef.current)
      svg.selectAll("*").remove()

      const width = 800
      const height = 600

      // Calculate node radii and store them
      const calculateNodeRadius = (node: Node) => {
        const balanceScale = Math.sqrt(Math.max(0.1, node.balance)) * 2
        if (node.type === "main") return Math.max(20, Math.min(40, balanceScale))
        if (node.type === "frequent") return Math.max(12, Math.min(25, balanceScale * 0.7))
        return Math.max(8, Math.min(18, balanceScale * 0.5))
      }

      // Pre-calculate radii for all nodes
      nodes.forEach((node) => {
        node.radius = calculateNodeRadius(node)
      })

      // Calculate dynamic spacing based on node sizes
      const maxRadius = Math.max(...nodes.map((n) => n.radius || 10))
      const minRadius = Math.min(...nodes.map((n) => n.radius || 10))
      const avgRadius = nodes.reduce((sum, n) => sum + (n.radius || 10), 0) / nodes.length

      // Dynamic link distance based on connected node sizes
      const calculateLinkDistance = (link: any) => {
        const sourceNode = nodes.find((n) => n.id === (typeof link.source === "string" ? link.source : link.source.id))
        const targetNode = nodes.find((n) => n.id === (typeof link.target === "string" ? link.target : link.target.id))

        const sourceRadius = sourceNode?.radius || avgRadius
        const targetRadius = targetNode?.radius || avgRadius

        // Base distance plus radius-based spacing plus value-based adjustment
        const baseDistance = 80
        const radiusSpacing = (sourceRadius + targetRadius) * 1.5
        const valueAdjustment = Math.min(30, Math.sqrt(link.value) * 5)

        return baseDistance + radiusSpacing - valueAdjustment
      }

      // Create simulation with improved forces for dynamic spacing
      const simulation = d3
        .forceSimulation(nodes as any)
        .force(
          "link",
          d3
            .forceLink(links)
            .id((d: any) => d.id)
            .distance(calculateLinkDistance)
            .strength(0.4), // Slightly reduced for more flexibility
        )
        .force(
          "charge",
          d3.forceManyBody().strength((d: any) => {
            // Charge strength based on node size and type
            const nodeRadius = d.radius || avgRadius
            const baseCharge = -200
            const radiusMultiplier = nodeRadius / avgRadius

            if (d.id === wallet.trim()) return baseCharge * 3 * radiusMultiplier
            return baseCharge * radiusMultiplier
          }),
        )
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force(
          "collision",
          d3
            .forceCollide()
            .radius((d: any) => {
              // Collision radius with padding to prevent overlap
              const nodeRadius = d.radius || avgRadius
              const padding = Math.max(5, nodeRadius * 0.3) // Dynamic padding
              return nodeRadius + padding
            })
            .strength(0.8), // Strong collision to prevent overlap
        )
        // Radial force to spread nodes in a circle around the main wallet
        .force(
          "radial",
          d3
            .forceRadial(
              (d: any) => {
                if (d.id === wallet.trim()) return 0 // Main wallet stays in center

                // Distance from center based on node importance and size
                const baseDistance = 150
                const sizeMultiplier = (d.radius || avgRadius) / avgRadius
                const importanceMultiplier = d.type === "frequent" ? 1.2 : 1.5

                return baseDistance * sizeMultiplier * importanceMultiplier
              },
              width / 2,
              height / 2,
            )
            .strength(0.3),
        )
        // Add x and y forces to prevent clustering
        .force("x", d3.forceX(width / 2).strength(0.02))
        .force("y", d3.forceY(height / 2).strength(0.02))

      // Create zoom behavior
      const zoomBehavior = d3
        .zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform)
          setZoom(event.transform.k)
        })

      svg.call(zoomBehavior as any)

      const g = svg.append("g")

      // Add gradient definitions
      const defs = svg.append("defs")

      // Main wallet gradient
      const mainGradient = defs
        .append("radialGradient")
        .attr("id", "main-gradient")
        .attr("cx", "30%")
        .attr("cy", "30%")
        .attr("r", "70%")

      mainGradient.append("stop").attr("offset", "0%").attr("stop-color", "#60a5fa").attr("stop-opacity", 1)
      mainGradient.append("stop").attr("offset", "100%").attr("stop-color", "#1e40af").attr("stop-opacity", 0.8)

      // Frequent wallet gradient
      const frequentGradient = defs
        .append("radialGradient")
        .attr("id", "frequent-gradient")
        .attr("cx", "30%")
        .attr("cy", "30%")
        .attr("r", "70%")

      frequentGradient.append("stop").attr("offset", "0%").attr("stop-color", "#a855f7").attr("stop-opacity", 0.9)
      frequentGradient.append("stop").attr("offset", "100%").attr("stop-color", "#7c3aed").attr("stop-opacity", 0.7)

      // Add arrow markers for directional links
      defs
        .append("marker")
        .attr("id", "arrow-incoming")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", "#3b82f6")
        .attr("d", "M0,-5L10,0L0,5")

      defs
        .append("marker")
        .attr("id", "arrow-outgoing")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("fill", "#8b5cf6")
        .attr("d", "M0,-5L10,0L0,5")

      // Links with improved styling
      const link = g
        .append("g")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("stroke", (d) => {
          switch (d.type) {
            case "transfer":
              return d.direction === "incoming" ? "#3b82f6" : "#8b5cf6"
            case "swap":
              return "#8b5cf6"
            case "stake":
              return "#10b981"
            default:
              return "#6b7280"
          }
        })
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", (d) => Math.max(1, Math.min(5, Math.sqrt(d.value) + d.count * 0.2)))
        .attr("marker-end", (d) => {
          // Only add arrows for significant transfers
          if (d.value < 0.1) return null
          return d.direction === "incoming" ? "url(#arrow-incoming)" : "url(#arrow-outgoing)"
        })
        .attr("fill", "none")
        .attr("class", "link")

      // Nodes with improved styling
      const node = g
        .append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => {
          if (d.type === "main") return "url(#main-gradient)"
          if (d.type === "frequent") return "url(#frequent-gradient)"
          return "#6b7280"
        })
        .attr("stroke", (d) => (d.type === "main" ? "#ffffff" : "#e2e8f0"))
        .attr("stroke-width", (d) => (d.type === "main" ? 3 : 2))
        .style("cursor", "pointer")
        .call(d3.drag<any, any>().on("start", dragstarted).on("drag", dragged).on("end", dragended))
        .on("click", (event, d) => {
          setSelectedNode(d)
        })
        .on("mouseover", function (event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", (d: any) => (d.radius || 10) * 1.2)

          // Highlight connected links
          link.style("stroke-opacity", (l: any) => {
            if (l.source.id === d.id || l.target.id === d.id) {
              return 1
            } else {
              return 0.2
            }
          })

          // Highlight connected nodes
          node.style("opacity", (n: any) => {
            if (n.id === d.id) return 1
            let connected = false
            links.forEach((l) => {
              const sourceId = typeof l.source === "string" ? l.source : l.source.id
              const targetId = typeof l.target === "string" ? l.target : l.target.id
              if ((sourceId === d.id && targetId === n.id) || (sourceId === n.id && targetId === d.id)) {
                connected = true
              }
            })
            return connected ? 1 : 0.4
          })
        })
        .on("mouseout", function (event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", (d: any) => d.radius || 10)

          // Reset link opacity
          link.style("stroke-opacity", 0.6)

          // Reset node opacity
          node.style("opacity", 1)
        })

      // Labels with improved positioning
      const labels = g
        .append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text((d) => {
          if (d.type === "main") return "Main Wallet"
          return d.address.substring(0, 6) + "..."
        })
        .attr("font-size", (d) => (d.type === "main" ? 12 : 10))
        .attr("fill", "#e2e8f0")
        .attr("text-anchor", "middle")
        .attr("dy", (d) => (d.radius || 10) + 15)
        .attr("font-weight", (d) => (d.type === "main" ? "bold" : "normal"))

      // Add balance labels for significant wallets
      const balanceLabels = g
        .append("g")
        .selectAll("text")
        .data(nodes.filter((n) => n.balance > 1)) // Only show for wallets with >1 SOL
        .join("text")
        .text((d) => `${d.balance.toFixed(1)} SOL`)
        .attr("font-size", 9)
        .attr("fill", "#a3e635")
        .attr("text-anchor", "middle")
        .attr("dy", (d) => (d.radius || 10) + 28)
        .attr("font-weight", "normal")

      // Update link paths on simulation tick
      function updateLinkPaths() {
        link.attr("d", (d: any) => {
          const sourceX = d.source.x
          const sourceY = d.source.y
          const targetX = d.target.x
          const targetY = d.target.y

          // For self-loops
          if (d.source.id === d.target.id) {
            const radius = 30
            return `M${sourceX},${sourceY} A${radius},${radius} 0 1,1 ${sourceX + 1},${sourceY + 1}`
          }

          // Calculate edge points to avoid overlapping with nodes
          const dx = targetX - sourceX
          const dy = targetY - sourceY
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance === 0) return `M${sourceX},${sourceY}L${targetX},${targetY}`

          const sourceRadius = d.source.radius || 10
          const targetRadius = d.target.radius || 10

          const sourceEdgeX = sourceX + (dx / distance) * sourceRadius
          const sourceEdgeY = sourceY + (dy / distance) * sourceRadius
          const targetEdgeX = targetX - (dx / distance) * targetRadius
          const targetEdgeY = targetY - (dy / distance) * targetRadius

          // For regular links, add a slight curve for better visibility
          if (d.value < 0.5) {
            return `M${sourceEdgeX},${sourceEdgeY}L${targetEdgeX},${targetEdgeY}`
          } else {
            const dr = distance * 1.5
            return `M${sourceEdgeX},${sourceEdgeY}A${dr},${dr} 0 0,1 ${targetEdgeX},${targetEdgeY}`
          }
        })
      }

      simulation.on("tick", () => {
        // Update node positions
        node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y)

        // Update link paths
        updateLinkPaths()

        // Update label positions
        labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)

        // Update balance label positions
        balanceLabels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y)
      })

      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      }

      function dragged(event: any, d: any) {
        d.fx = event.x
        d.fy = event.y
      }

      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      }

      // Run simulation with higher alpha for better layout
      simulation.alpha(1).restart()

      console.log("Graph rendering completed successfully")
    }

    return () => {
      cancelled = true
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [wallet])

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.5)
  }

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1 / 1.5)
  }

  const handleReset = () => {
    const svg = d3.select(svgRef.current)
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity)
  }

  const openInExplorer = (address: string) => {
    window.open(`https://solscan.io/account/${address}`, "_blank")
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatSOL = (amount: number): string => {
    if (amount < 0.001) {
      return amount.toFixed(6)
    } else if (amount < 1) {
      return amount.toFixed(4)
    } else if (amount < 1000) {
      return amount.toFixed(2)
    } else {
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Transaction Network Graph</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="border-slate-600 text-slate-400">
                Zoom: {(zoom * 100).toFixed(0)}%
              </Badge>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Always render SVG so ref is available */}
            <svg
              ref={svgRef}
              width="800"
              height="600"
              className="w-full border border-slate-700 rounded-lg bg-slate-950/50"
            ></svg>

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-2 text-slate-400">Loading transaction network...</span>
                </div>
                {fetchProgress && <div className="text-xs text-slate-500 mt-2">{fetchProgress}</div>}
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 rounded-lg">
                <div className="text-center py-8 max-w-md px-4">
                  <div className="flex justify-center mb-4">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                  </div>
                  <p className="text-red-400 mb-2 font-medium">Error loading transaction network</p>
                  <p className="text-slate-400 text-sm mb-4">{error}</p>
                  <p className="text-xs text-slate-500 mt-2">Wallet: "{wallet}"</p>
                  <p className="text-xs text-slate-500">SVG Ref: {svgRef.current ? "Available" : "Not Available"}</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setError(null)
                        setLoading(true)
                        // Trigger re-fetch by changing wallet state slightly
                        setTimeout(() => {
                          // This will trigger the useEffect again
                          window.location.reload()
                        }, 100)
                      }}
                    >
                      Retry
                    </Button>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Reload Page
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Legend - only show when not loading/error */}
            {!loading && !error && (
              <div className="absolute top-4 left-4 space-y-2 bg-slate-900/70 p-3 rounded-lg">
                <div className="text-xs text-slate-300 font-medium mb-2">Network Legend</div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
                  <span className="text-xs text-slate-400">Main Wallet</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-purple-600"></div>
                  <span className="text-xs text-slate-400">Frequent (3+ txs)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                  <span className="text-xs text-slate-400">Occasional</span>
                </div>
                <div className="border-t border-slate-700 my-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-1 w-6 bg-blue-500"></div>
                    <span className="text-xs text-slate-400">Incoming transfers</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="h-1 w-6 bg-purple-500"></div>
                    <span className="text-xs text-slate-400">Outgoing transfers</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">* System addresses excluded</div>
              </div>
            )}

            {/* Instructions - only show when not loading/error */}
            {!loading && !error && (
              <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/70 p-2 rounded">
                Click on any node to view wallet details • Drag to reposition • Hover to highlight connections
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedNode && (
        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">
                {selectedNode.type === "main" ? "Main Wallet Details" : "Connected Wallet Details"}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInExplorer(selectedNode.address)}
                className="border-slate-700 text-slate-400 hover:text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Solscan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Wallet Address</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-mono text-sm break-all">{selectedNode.address}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(selectedNode.address)}
                      className="text-slate-400 hover:text-white"
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-1">SOL Balance</p>
                  <p className="text-2xl font-bold text-white">{formatSOL(selectedNode.balance)} SOL</p>
                  <p className="text-sm text-slate-400">≈ {formatCurrency(selectedNode.balance * 162.34)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Transaction Count</p>
                  <p className="text-xl font-semibold text-white">{selectedNode.transactionCount.toLocaleString()}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-1">Connection Type</p>
                  <Badge
                    className={
                      selectedNode.type === "main"
                        ? "bg-blue-500/20 text-blue-400"
                        : selectedNode.type === "frequent"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-gray-500/20 text-gray-400"
                    }
                  >
                    {selectedNode.type === "main"
                      ? "Main Wallet"
                      : selectedNode.type === "frequent"
                        ? "Frequent Connection"
                        : "Occasional Connection"}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-1">Interaction Level</p>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        selectedNode.type === "main"
                          ? "bg-blue-500"
                          : selectedNode.type === "frequent"
                            ? "bg-purple-500"
                            : "bg-gray-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (selectedNode.transactionCount / 20) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
