"use client"

import { cn } from "@/lib/utils"

// Pre-auth chat flow steps
const CHAT_STEPS = [
  { key: "intent", label: "What you need" },
  { key: "scope", label: "System type" },
  { key: "address", label: "Your home" },
]

type ChatStep = "start" | "intent" | "scope" | "education" | "address" | "complete"

interface ChatProgressIndicatorProps {
  currentStep: ChatStep
  className?: string
}

export function ChatProgressIndicator({ currentStep, className }: ChatProgressIndicatorProps) {
  // Map current step to progress index
  const getStepIndex = (step: ChatStep): number => {
    switch (step) {
      case "start":
        return -1 // Not started
      case "intent":
        return 0
      case "scope":
        return 1
      case "education":
        return 1 // Same as scope (education is part of scope phase)
      case "address":
      case "complete":
        return 2
      default:
        return -1
    }
  }

  const currentIndex = getStepIndex(currentStep)

  // Don't show progress if not started
  if (currentIndex === -1) {
    return null
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {CHAT_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isFuture = index > currentIndex

        return (
          <div key={step.key} className="flex items-center gap-2">
            {/* Dot */}
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                isCompleted && "bg-primary",
                isCurrent && "bg-primary ring-2 ring-primary/30",
                isFuture && "bg-muted-foreground/30"
              )}
              title={step.label}
            />
            {/* Connecting line (except for last) */}
            {index < CHAT_STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 transition-colors duration-300",
                  index < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
