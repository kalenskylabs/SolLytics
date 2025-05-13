"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"

interface Feature {
  name: string
  importance: number
  impact: "positive" | "negative" | "neutral"
}

interface FeatureImportanceProps {
  features: Feature[]
}

export function FeatureImportance({ features }: FeatureImportanceProps) {
  const sortedFeatures = [...features].sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive":
        return "bg-green-500"
      case "negative":
        return "bg-red-500"
      default:
        return "bg-blue-500"
    }
  }

  const getImpactWidth = (importance: number) => {
    // Convert to percentage (0-100)
    return `${Math.abs(importance) * 100}%`
  }

  return (
    <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span>Feature Importance</span>
          <BarChart3 className="w-5 h-5 text-purple-400" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedFeatures.map((feature, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">{feature.name}</span>
                <span
                  className={`text-xs font-medium ${
                    feature.impact === "positive"
                      ? "text-green-400"
                      : feature.impact === "negative"
                        ? "text-red-400"
                        : "text-blue-400"
                  }`}
                >
                  {feature.impact === "positive" ? "+" : feature.impact === "negative" ? "-" : ""}
                  {Math.abs(feature.importance).toFixed(2)}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getImpactColor(feature.impact)}`}
                  style={{ width: getImpactWidth(feature.importance) }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span>Positive</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
              <span>Neutral</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <span>Negative</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
