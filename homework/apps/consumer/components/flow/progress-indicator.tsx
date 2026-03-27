"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FlowPhase } from "@/types/flow"

// Steps to show in progress indicator (user-facing steps only)
const PROGRESS_STEPS: { phase: FlowPhase; label: string }[] = [
  { phase: "pricing", label: "System" },
  { phase: "pros", label: "Pro" },
  { phase: "addons", label: "Add-ons" },
  { phase: "schedule", label: "Schedule" },
  { phase: "contact", label: "Contact" },
  { phase: "checkout", label: "Review" },
]

interface ProgressIndicatorProps {
  currentPhase: FlowPhase
  className?: string
}

export function ProgressIndicator({ currentPhase, className }: ProgressIndicatorProps) {
  // Find current step index
  const currentIndex = PROGRESS_STEPS.findIndex((s) => s.phase === currentPhase)

  // Don't show progress for phases not in the list (intro, loading, auth, etc.)
  if (currentIndex === -1) {
    return null
  }

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      {/* Step labels with dots */}
      <div className="flex items-center justify-between">
        {PROGRESS_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <div key={step.phase} className="flex flex-col items-center flex-1">
              {/* Dot/check */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isFuture && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs mt-1.5 font-medium",
                  isCurrent && "text-primary",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Connecting lines */}
      <div className="relative -mt-[42px] mx-4 flex">
        {PROGRESS_STEPS.slice(0, -1).map((step, index) => {
          const isCompleted = index < currentIndex

          return (
            <div
              key={`line-${step.phase}`}
              className={cn(
                "flex-1 h-0.5 transition-colors",
                isCompleted ? "bg-primary" : "bg-muted"
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
