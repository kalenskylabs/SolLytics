"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

interface ReputabilityScoreProps {
  score: number
}

export function ReputabilityScore({ score }: ReputabilityScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const duration = 1500
    const interval = 20
    const steps = duration / interval
    const increment = score / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        current = score
        clearInterval(timer)
      }
      setAnimatedScore(Math.round(current))
    }, interval)

    return () => clearInterval(timer)
  }, [score])

  const getScoreColor = () => {
    if (score >= 80) return "text-green-400"
    if (score >= 60) return "text-blue-400"
    if (score >= 40) return "text-yellow-400"
    if (score >= 20) return "text-orange-400"
    return "text-red-400"
  }

  const getScoreLabel = () => {
    if (score >= 80) return "Excellent"
    if (score >= 60) return "Good"
    if (score >= 40) return "Moderate"
    if (score >= 20) return "Questionable"
    return "Poor"
  }

  const getScoreIcon = () => {
    if (score >= 60) return <ShieldCheck className="w-8 h-8 text-green-400" />
    if (score >= 30) return <Shield className="w-8 h-8 text-yellow-400" />
    return <ShieldAlert className="w-8 h-8 text-red-400" />
  }

  const getGradient = () => {
    if (score >= 80) return "from-green-500 to-green-700"
    if (score >= 60) return "from-blue-500 to-blue-700"
    if (score >= 40) return "from-yellow-500 to-yellow-700"
    if (score >= 20) return "from-orange-500 to-orange-700"
    return "from-red-500 to-red-700"
  }

  return (
    <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span>Reputability Score</span>
          {getScoreIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative w-48 h-48">
            {/* Background circle */}
            <div className="absolute inset-0 rounded-full border-8 border-slate-700/50"></div>

            {/* Progress circle */}
            <svg className="absolute inset-0 w-full h-full rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-slate-700/30"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="46"
                cx="50"
                cy="50"
              />
              <circle
                className={`text-${getScoreColor().replace("text-", "")}`}
                strokeWidth="8"
                strokeDasharray={`${animatedScore * 2.89}, 289`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="46"
                cx="50"
                cy="50"
              />
            </svg>

            {/* Score text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-bold ${getScoreColor()}`}>{animatedScore}</span>
              <span className="text-slate-400 text-sm">out of 100</span>
            </div>
          </div>

          <div className={`mt-6 px-4 py-2 rounded-full bg-gradient-to-r ${getGradient()} text-white font-medium`}>
            {getScoreLabel()} Reputation
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
