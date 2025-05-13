"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Info, DollarSign } from "lucide-react"

interface DeveloperNode {
  id: string
  group: number
  value: number
  label: string
  type: "developer" | "wallet" | "exchange" | "contract" | "token" | "nft" | "defi" | "program" | "unknown" | "whale"
  amount: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface DeveloperLink {
  source: string | DeveloperNode
  target: string | DeveloperNode
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

export default function DeveloperBubbleMap({
  developerAddress,
}: {
  developerAddress: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DeveloperFlowData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/developer-network", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ developerAddress }),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch developer network data: ${response.status}`)
        }

        const developerData = await response.json()
        setData(developerData)
      } catch (err) {
        console.error("Error fetching developer network:", err)
        setError(err instanceof Error ? err.message : "Failed to load developer network data")
      } finally {
        setLoading(false)
      }
    }

    if (developerAddress) {
      fetchData()
    }
  }, [developerAddress])

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])

    // Create zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform)
      })

    svg.call(zoom)

    // Create container for zoomable content
    const container = svg.append("g")

    // Define color scale for developer network
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(["developer", "wallet", "exchange", "contract", "token", "nft", "defi", "program", "unknown", "whale"])
      .range([
        "#ef4444",
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#6b7280",
        "#e879f9",
        "#0ea5e9",
        "#64748b",
        "#f97316",
      ])

    // Create force simulation
    const simulation = d3
      .forceSimulation<DeveloperNode>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<DeveloperNode, DeveloperLink>(data.links)
          .id((d) => d.id)
          .distance((d) => 80 + Math.log(d.amount + 1) * 10)
          .strength(0.2),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => -200 - Math.log(d.amount + 1) * 20),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => 10 + Math.log(d.amount + 1) * 3),
      )

    // Create arrow markers for different flow types
    const defs = container.append("defs")

    const arrowColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
    arrowColors.forEach((color, i) => {
      defs
        .append("marker")
        .attr("id", `arrow-${i}`)
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .append("path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", color)
    })

    // Create links with gradient colors based on amount
    const link = container
      .append("g")
      .selectAll("line")
      .data(data.links)
      .enter()
      .append("line")
      .attr("stroke", (d) => {
        if (d.type === "funding") return "#3b82f6"
        if (d.type === "deployment") return "#10b981"
        if (d.type === "creation") return "#8b5cf6"
        return "#6b7280"
      })
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", (d) => Math.max(2, Math.log(d.amount + 1)))
      .attr("marker-end", (d, i) => `url(#arrow-${i % 4})`)

    // Create node groups
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, DeveloperNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended))

    // Add circles for nodes with size based on amount
    nodeGroup
      .append("circle")
      .attr("r", (d) => {
        if (d.type === "developer") return 20
        return Math.max(8, 5 + Math.log(d.amount + 1) * 2)
      })
      .attr("fill", (d) => colorScale(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", (d) => (d.type === "developer" ? 3 : 2))
      .attr("opacity", 0.9)

    // Add inner circles for amount visualization
    nodeGroup
      .append("circle")
      .attr("r", (d) => {
        if (d.type === "developer") return 15
        return Math.max(4, 3 + Math.log(d.amount + 1) * 1.5)
      })
      .attr("fill", (d) => colorScale(d.type))
      .attr("opacity", 0.3)

    // Add labels
    nodeGroup
      .append("text")
      .text((d) => {
        if (d.type === "developer") return "DEVELOPER"
        if (d.label) return d.label
        return `${d.id.substring(0, 4)}...${d.id.substring(d.id.length - 4)}`
      })
      .attr("font-size", (d) => {
        if (d.type === "developer") return 12
        return 9
      })
      .attr("dx", (d) => {
        if (d.type === "developer") return 25
        return 15
      })
      .attr("dy", 4)
      .attr("fill", "#fff")
      .attr("font-weight", (d) => (d.type === "developer" ? "bold" : "normal"))

    // Add amount labels
    nodeGroup
      .append("text")
      .text((d) => {
        if (d.amount > 0.01 * 1e9) {
          return `${(d.amount / 1e9).toFixed(2)} SOL`
        }
        return ""
      })
      .attr("font-size", 8)
      .attr("dx", (d) => {
        if (d.type === "developer") return 25
        return 15
      })
      .attr("dy", 16)
      .attr("fill", "#94a3b8")
      .attr("font-family", "monospace")

    // Add hover effects
    nodeGroup
      .on("mouseover", function (event, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", (d) => {
            const baseRadius = d.type === "developer" ? 20 : Math.max(8, 5 + Math.log(d.amount + 1) * 2)
            return baseRadius * 1.3
          })
          .attr("opacity", 1)

        // Show detailed tooltip
        const tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "developer-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.9)")
          .style("color", "white")
          .style("padding", "12px")
          .style("border-radius", "8px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .style("border", "1px solid #374151")

        tooltip
          .html(`
          <div><strong>${d.type === "developer" ? "Developer Address" : d.label || "Connected Address"}</strong></div>
          <div style="font-family: monospace; font-size: 10px; margin: 4px 0;">${d.id}</div>
          <div>Type: <span style="color: ${colorScale(d.type)}">${d.type.toUpperCase()}</span></div>
          <div>Amount: <span style="color: #10b981">${(d.amount / 1e9).toFixed(4)} SOL</span></div>
          <div>Connections: ${d.value}</div>
        `)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px")
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", (d) => {
            if (d.type === "developer") return 20
            return Math.max(8, 5 + Math.log(d.amount + 1) * 2)
          })
          .attr("opacity", 0.9)

        // Remove tooltip
        d3.selectAll(".developer-tooltip").remove()
      })

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as DeveloperNode).x!)
        .attr("y1", (d) => (d.source as DeveloperNode).y!)
        .attr("x2", (d) => (d.target as DeveloperNode).x!)
        .attr("y2", (d) => (d.target as DeveloperNode).y!)

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    // Drag functions
    function dragstarted(event: any, d: DeveloperNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: DeveloperNode) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: DeveloperNode) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    // Cleanup function
    return () => {
      simulation.stop()
      d3.selectAll(".developer-tooltip").remove()
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-300">Analyzing developer network...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20 h-full flex items-center justify-center">
        <CardContent className="p-4 text-center">
          <p className="text-red-400">Failed to load developer network data: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="bg-slate-800/30 border-slate-700/30 h-full flex items-center justify-center">
        <CardContent className="p-4 text-center">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-400">No developer network data available</p>
          <p className="text-slate-500 text-sm mt-1">Unable to trace developer connections</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-900/95 p-3 rounded-lg text-xs text-slate-300 z-10 border border-slate-700/50">
        <div className="font-medium mb-2 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Developer Network Legend
        </div>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Developer</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>Wallets</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>Exchanges</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <span>Contracts</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            <span>Tokens</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
            <span>Whales</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400">
          Drag nodes • Scroll to zoom • Hover for details
        </div>
      </div>

      {/* Developer Network Stats */}
      <div className="absolute top-4 right-4 bg-slate-900/95 p-3 rounded-lg text-xs text-slate-300 z-10 border border-slate-700/50">
        <div className="font-medium mb-2">Developer Network Analysis</div>
        <div className="space-y-1">
          <div>
            Total Volume: <span className="text-green-400">{(data.totalFunding / 1e9).toFixed(2)} SOL</span>
          </div>
          <div>
            Connected Addresses: <span className="text-blue-400">{data.fundingSources}</span>
          </div>
          <div>
            Network Nodes: <span className="text-purple-400">{data.nodes.length}</span>
          </div>
          <div>
            Connections: <span className="text-yellow-400">{data.links.length}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="text-xs text-slate-400">
            {data.totalFunding > 100e9
              ? "🚨 High activity volume"
              : data.totalFunding > 10e9
                ? "⚠️ Moderate activity"
                : "✅ Normal activity levels"}
          </div>
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}
