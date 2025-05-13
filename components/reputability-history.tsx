"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface HistoryItem {
  date: string
  score: number
}

interface ReputabilityHistoryProps {
  history: HistoryItem[]
}

export function ReputabilityHistory({ history }: ReputabilityHistoryProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981" // green
    if (score >= 60) return "#3b82f6" // blue
    if (score >= 40) return "#f59e0b" // yellow
    if (score >= 20) return "#f97316" // orange
    return "#ef4444" // red
  }

  const currentScore = history[history.length - 1]?.score || 0
  const previousScore = history[history.length - 2]?.score || 0
  const scoreChange = currentScore - previousScore

  return (
    <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span>Score History</span>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            {scoreChange !== 0 && (
              <span className={`text-sm font-medium ${scoreChange > 0 ? "text-green-400" : "text-red-400"}`}>
                {scoreChange > 0 ? "+" : ""}
                {scoreChange}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value: number) => [value, "Score"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke={getScoreColor(currentScore)}
                strokeWidth={2}
                dot={{ fill: getScoreColor(currentScore), strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: getScoreColor(currentScore), strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-slate-400 text-xs">Current</p>
              <p className="text-white font-semibold">{currentScore}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Previous</p>
              <p className="text-white font-semibold">{previousScore}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Change</p>
              <p className={`font-semibold ${scoreChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                {scoreChange > 0 ? "+" : ""}
                {scoreChange}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
