"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"

interface ScoreExplanationProps {
  explanation: string
}

export function ScoreExplanation({ explanation }: ScoreExplanationProps) {
  // Split the explanation into paragraphs for better readability
  const paragraphs = explanation.split("\n").filter((p) => p.trim().length > 0)

  return (
    <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span>AI Explanation</span>
          <MessageSquare className="w-5 h-5 text-blue-400" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-slate-300">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-sm">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center">
              <span className="text-xs font-bold text-white">X</span>
            </div>
            <span className="ml-2 text-xs text-slate-400">Powered by XAI</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
