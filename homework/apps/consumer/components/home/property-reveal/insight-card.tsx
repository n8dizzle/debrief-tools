"use client"

import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Insight } from "@/lib/home/insights/insight-generator"

type InsightCardProps = {
  insight: Insight | null
  isRevealed: boolean
  className?: string
}

export function InsightCard({ insight, isRevealed, className }: InsightCardProps) {
  if (!insight) return null

  const toneStyles = {
    informative: "border-blue-200 bg-blue-50/50",
    noteworthy: "border-amber-200 bg-amber-50/50",
    positive: "border-emerald-200 bg-emerald-50/50",
  }

  const iconStyles = {
    informative: "text-blue-500",
    noteworthy: "text-amber-500",
    positive: "text-emerald-500",
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4",
        toneStyles[insight.tone],
        isRevealed
          ? "animate-in fade-in slide-in-from-bottom-6 duration-500"
          : "opacity-0 translate-y-6",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm",
            iconStyles[insight.tone]
          )}
        >
          <Lightbulb className="h-4 w-4" aria-hidden />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{insight.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  )
}
