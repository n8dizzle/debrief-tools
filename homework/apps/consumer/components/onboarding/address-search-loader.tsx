"use client"

import { useEffect, useState } from "react"
import { Check, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Step = {
  id: string
  label: string
  subtitle?: string
  subtitleDelay?: number // ms after completion to show subtitle
}

const STEPS: Step[] = [
  { id: "found", label: "Found it" },
  { id: "property", label: "Pulling property details" },
  { id: "tax", label: "Tax records found", subtitle: "Our condolences", subtitleDelay: 200 },
  { id: "satellite", label: "Getting the satellite view" },
  { id: "homefit", label: "Building your HomeFit profile" },
]

const TIMING = {
  step1: 500,      // Found it - immediate
  step2: 800,      // Pulling property details
  step3: 900,      // Tax records
  step4: 1000,     // Satellite view
  step5: 1200,     // HomeFit profile - slightly longer for anticipation
  pauseAfter: 600, // Pause before transition
}

type StepStatus = "pending" | "active" | "complete"

type AddressSearchLoaderProps = {
  address: string
  onComplete: () => void
  className?: string
}

export function AddressSearchLoader({
  address,
  onComplete,
  className,
}: AddressSearchLoaderProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [showSubtitle, setShowSubtitle] = useState<string | null>(null)

  useEffect(() => {
    const timings = [
      TIMING.step1,
      TIMING.step2,
      TIMING.step3,
      TIMING.step4,
      TIMING.step5,
    ]

    let totalDelay = 0
    const timeouts: NodeJS.Timeout[] = []

    // Schedule each step completion
    timings.forEach((timing, index) => {
      totalDelay += timing
      const timeout = setTimeout(() => {
        setCurrentStep(index + 1)

        // Handle subtitle reveal for tax step
        const step = STEPS[index]
        if (step.subtitle && step.subtitleDelay) {
          setTimeout(() => {
            setShowSubtitle(step.id)
          }, step.subtitleDelay)
        }
      }, totalDelay)
      timeouts.push(timeout)
    })

    // Trigger completion callback after all steps + pause
    const completeTimeout = setTimeout(() => {
      onComplete()
    }, totalDelay + TIMING.pauseAfter)
    timeouts.push(completeTimeout)

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [onComplete])

  const getStepStatus = (index: number): StepStatus => {
    if (index < currentStep) return "complete"
    if (index === currentStep) return "active"
    return "pending"
  }

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-secondary px-4",
        className
      )}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo mark with pulse */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-primary animate-pulse"
                fill="currentColor"
              >
                {/* Simplified house-in-circle mark */}
                <path d="M12 2L4 7v10a2 2 0 002 2h12a2 2 0 002-2V7l-8-5zm0 2.5L18 8v9H6V8l6-3.5z" />
                <path d="M10 14h4v5h-4z" />
              </svg>
            </div>
            {/* Subtle ring pulse */}
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-2xl font-semibold text-foreground">
          Finding your home
        </h1>

        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, index) => {
            const status = getStepStatus(index)
            return (
              <div key={step.id} className="flex items-start gap-3">
                {/* Status indicator */}
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {status === "complete" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary animate-in zoom-in-50 duration-200">
                      <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                    </div>
                  )}
                  {status === "active" && (
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  )}
                  {status === "pending" && (
                    <Circle className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                  )}
                </div>

                {/* Label and subtitle */}
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-sm transition-colors duration-200",
                      status === "complete" && "text-foreground",
                      status === "active" && "text-muted-foreground",
                      status === "pending" && "text-muted-foreground/50"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.subtitle && showSubtitle === step.id && (
                    <span className="text-xs italic text-muted-foreground/70 animate-in fade-in slide-in-from-left-2 duration-300">
                      {step.subtitle}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Address footer */}
        <div className="pt-4 text-center">
          <p className="text-sm text-muted-foreground/70">{address}</p>
        </div>
      </div>
    </div>
  )
}
