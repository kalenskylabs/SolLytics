"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle, CheckCircle, Info } from "lucide-react"

interface ActivityItem {
  type: string
  description: string
  impact: "positive" | "negative" | "neutral"
  timestamp: string
}

interface WalletActivityProps {
  activity: ActivityItem[]
}

export function WalletActivity({ activity }: WalletActivityProps) {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case "negative":
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      default:
        return <Info className="w-4 h-4 text-blue-400" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive":
        return "border-green-500/50 bg-green-900/20"
      case "negative":
        return "border-red-500/50 bg-red-900/20"
      default:
        return "border-blue-500/50 bg-blue-900/20"
    }
  }

  const getBadgeVariant = (impact: string) => {
    switch (impact) {
      case "positive":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "negative":
        return "bg-red-500/20 text-red-400 border-red-500/50"
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
    }
  }

  return (
    <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span>Recent Activity</span>
          <Activity className="w-5 h-5 text-orange-400" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No recent activity detected</p>
          ) : (
            activity.map((item, index) => (
              <div key={index} className={`p-3 rounded-lg border ${getImpactColor(item.impact)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getImpactIcon(item.impact)}
                    <span className="text-white font-medium text-sm">{item.type}</span>
                  </div>
                  <Badge className={`text-xs ${getBadgeVariant(item.impact)}`}>{item.impact}</Badge>
                </div>
                <p className="text-slate-300 text-sm mb-2">{item.description}</p>
                <p className="text-slate-400 text-xs">{item.timestamp}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
