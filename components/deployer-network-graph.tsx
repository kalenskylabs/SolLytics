"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface Node {
  id: string
  group: number
  value: number
  label: string
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

export function DeployerNetworkGraph({ deployerAddress }: { deployerAddress: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GraphData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch deployer network data
        const response = await fetch("/api/deployer-network", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: deployerAddress }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch deployer network data")
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

    fetchData()
  }, [deployerAddress])

  useEffect(() => {
    if (!data || !svgRef.current) return

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Create the simulation
    const simulation = d3
      .forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d: any) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1))

    // Create the SVG elements
    const svg = d3.select(svgRef.current)

    // Define arrow markers for links
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#999")
      .style("stroke", "none")

    // Create links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(data.links)
      .enter()
      .append("line")
      .attr("stroke", "#666")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.value))
      .attr("marker-end", "url(#arrowhead)")

    // Create a group for each node
    const nodeGroup = svg
      .append("g")
      .selectAll("g")
      .data(data.nodes)
      .enter()
      .append("g")
      .call(d3.drag<SVGGElement, Node>().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any)

    // Add circles to each node group
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

    nodeGroup
      .append("circle")
      .attr("r", (d) => 5 + Math.sqrt(d.value) * 2)
      .attr("fill", (d) => {
        // Highlight the deployer node
        if (d.id === deployerAddress) {
          return "#ff3e00"
        }
        return colorScale(d.group.toString()) as string
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)

    // Add labels to each node
    nodeGroup
      .append("text")
      .text((d) => {
        // Show full address for deployer, truncated for others
        if (d.id === deployerAddress) {
          return "Deployer"
        }
        // Truncate address for display
        return d.label || `${d.id.substring(0, 4)}...${d.id.substring(d.id.length - 4)}`
      })
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("fill", "#fff")

    // Add title for hover tooltip
    nodeGroup.append("title").text((d) => d.id)

    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, any>, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, any>, d: any) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, any>, d: any) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-300">Loading network data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/20">
        <CardContent className="p-4 text-center">
          <p className="text-red-400">Failed to load network data: {error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="bg-slate-800/30 border-slate-700/30">
        <CardContent className="p-4 text-center">
          <p className="text-slate-400">No network data available for this deployer</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 bg-slate-900/80 p-2 rounded-md text-xs text-slate-300 z-10">
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span>Deployer</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span>Connected Wallets</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span>Contracts</span>
        </div>
      </div>
      <svg ref={svgRef} width="100%" height="100%" className="overflow-hidden"></svg>
    </div>
  )
}
