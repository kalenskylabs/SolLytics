"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Info } from "lucide-react"

interface Node {
  id: string
  group: number
  value: number
  label: string
  type: "deployer" | "wallet" | "contract" | "token"
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Link {
  source: string | Node
  target: string | Node
  value: number
  type: "transaction" | "creation" | "interaction"
}

interface GraphData {
  nodes: Node[]
  links: Link[]
}

export function DeployerBubbleMap({ deployerAddress }: { deployerAddress: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GraphData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/deployer-network", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: deployerAddress }),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch deployer network data: ${response.status}`)
        }

        const graphData = await response.json()
        setData(graphData)
      } catch (err) {
        console.error("Error fetching deployer network:", err)
        setError(err instanceof Error ? err.message : "Failed to load network data")
      } finally {
        setLoading(false)
      }
    }

    if (deployerAddress) {
      fetchData()
    }
  }, [deployerAddress])

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

    // Define color scale
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(["deployer", "wallet", "contract", "token"])
      .range(["#ff3e00", "#3b82f6", "#10b981", "#f59e0b"])

    // Create force simulation
    const simulation = d3
      .forceSimulation<Node>(data.nodes)
      .force(
        "link",
        d3
          .forceLink<Node, Link>(data.links)
          .id((d) => d.id)
          .distance((d) => 50 + d.value * 10)
          .strength(0.1),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => -100 - d.value * 10),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide().radius((d) => 5 + Math.sqrt(d.value) * 3),
      )

    // Create arrow markers
    const defs = container.append("defs")

    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .append("path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#666")

    // Create links
    const link = container
      .append("g")
      .selectAll("line")
      .data(data.links)
      .enter()
      .append("line")
      .attr("stroke", "#666")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.value) + 1)
      .attr("marker-end", "url(#arrowhead)")

    // Create node groups
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, Node>().on("start", dragstarted).on("drag", dragged).on("end", dragended))

    // Add circles for nodes
    nodeGroup
      .append("circle")
      .attr("r", (d) => {
        if (d.type === "deployer") return 15
        return 5 + Math.sqrt(d.value) * 2
      })
      .attr("fill", (d) => colorScale(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", (d) => (d.type === "deployer" ? 3 : 1.5))
      .attr("opacity", 0.8)

    // Add labels
    nodeGroup
      .append("text")
      .text((d) => {
        if (d.type === "deployer") return "Deployer"
        if (d.label) return d.label
        return `${d.id.substring(0, 4)}...${d.id.substring(d.id.length - 4)}`
      })
      .attr("font-size", (d) => (d.type === "deployer" ? 12 : 10))
      .attr("dx", (d) => (d.type === "deployer" ? 20 : 12))
      .attr("dy", 4)
      .attr("fill", "#fff")
      .attr("font-weight", (d) => (d.type === "deployer" ? "bold" : "normal"))

    // Add hover effects
    nodeGroup
      .on("mouseover", function (event, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", (d) => {
            const baseRadius = d.type === "deployer" ? 15 : 5 + Math.sqrt(d.value) * 2
            return baseRadius * 1.2
          })
          .attr("opacity", 1)

        // Show tooltip
        const tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")

        tooltip
          .html(`
          <div><strong>${d.type === "deployer" ? "Deployer" : d.label || "Address"}</strong></div>
          <div style="font-family: monospace; font-size: 10px;">${d.id}</div>
          <div>Type: ${d.type}</div>
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
          .attr("r", (d) => (d.type === "deployer" ? 15 : 5 + Math.sqrt(d.value) * 2))
          .attr("opacity", 0.8)

        // Remove tooltip
        d3.selectAll(".tooltip").remove()
      })

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!)

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    // Drag functions
    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    // Cleanup function
    return () => {
      simulation.stop()
      d3.selectAll(".tooltip").remove()
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-300">Loading deployer network...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20 h-full flex items-center justify-center">
        <CardContent className="p-4 text-center">
          <p className="text-red-400">Failed to load network data: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="bg-slate-800/30 border-slate-700/30 h-full flex items-center justify-center">
        <CardContent className="p-4 text-center">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-400">No network data available for this deployer</p>
          <p className="text-slate-500 text-sm mt-1">The deployer may have limited transaction history</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-900/90 p-3 rounded-lg text-xs text-slate-300 z-10 border border-slate-700/50">
        <div className="font-medium mb-2">Network Legend</div>
        <div className="space-y-1">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Deployer</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>Wallets</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span>Contracts</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <span>Tokens</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400">Drag nodes • Scroll to zoom</div>
      </div>

      {/* Network Stats */}
      <div className="absolute top-4 right-4 bg-slate-900/90 p-3 rounded-lg text-xs text-slate-300 z-10 border border-slate-700/50">
        <div className="font-medium mb-2">Network Stats</div>
        <div className="space-y-1">
          <div>Nodes: {data.nodes.length}</div>
          <div>Connections: {data.links.length}</div>
          <div>Wallets: {data.nodes.filter((n) => n.type === "wallet").length}</div>
          <div>Contracts: {data.nodes.filter((n) => n.type === "contract").length}</div>
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}
