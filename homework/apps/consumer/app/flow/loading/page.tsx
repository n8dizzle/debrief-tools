"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Check, Circle, Loader2, MapPin, MessageCircle } from "lucide-react"
import { useFlowStore } from "@/lib/flow-state"
import { getPropertyData } from "@/lib/property-data-server"
import { cn } from "@/lib/utils"

type Step = {
  id: string
  label: string
  subtitle?: string
  subtitleDelay?: number
}

const STEPS: Step[] = [
  { id: "found", label: "Found it" },
  { id: "property", label: "Pulling property details" },
  { id: "tax", label: "Tax records found", subtitle: "Our condolences.", subtitleDelay: 200 },
  { id: "satellite", label: "Getting the satellite view" },
  { id: "homefit", label: "Building your HomeFit profile" },
]

const STEP_DELAYS = [300, 600, 700, 800, 1000]
const POST_COMPLETE_DELAY = 500

export default function LoadingPage() {
  const router = useRouter()
  const homeData = useFlowStore((s) => s.homeData)
  const userIntent = useFlowStore((s) => s.userIntent)
  const setHomeData = useFlowStore((s) => s.setHomeData)
  const setCachedPropertyData = useFlowStore((s) => s.setCachedPropertyData)

  const [currentStep, setCurrentStep] = useState(-1)
  const [showSubtitle, setShowSubtitle] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [propertyDataFetched, setPropertyDataFetched] = useState(false)

  const fetchData = useCallback(async () => {
    if (!homeData || propertyDataFetched) return

    try {
      const data = await getPropertyData(homeData.formattedAddress)

      // Cache the full property data to prevent duplicate API calls
      setCachedPropertyData(data)

      setHomeData({
        ...homeData,
        sqft: data.sqft ?? null,
        yearBuilt: data.yearBuilt ?? null,
        beds: data.beds ?? null,
        baths: data.baths ?? null,
        lotSizeSqft: data.lotSizeSqft ?? null,
        stories: data.stories ?? null,
      })

      setPropertyDataFetched(true)
    } catch (error) {
      console.error("Failed to fetch property data:", error)
      setPropertyDataFetched(true)
    }
  }, [homeData, propertyDataFetched, setHomeData, setCachedPropertyData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    }
  }, [homeData, router])

  useEffect(() => {
    let totalDelay = 0
    const timeouts: NodeJS.Timeout[] = []

    STEPS.forEach((step, index) => {
      totalDelay += STEP_DELAYS[index]

      timeouts.push(
        setTimeout(() => {
          setCurrentStep(index)

          if (step.subtitle && step.subtitleDelay) {
            setTimeout(() => {
              setShowSubtitle(step.id)
            }, step.subtitleDelay)
          }
        }, totalDelay)
      )
    })

    totalDelay += POST_COMPLETE_DELAY
    timeouts.push(
      setTimeout(() => {
        setIsComplete(true)
        setTimeout(() => {
          router.push("/flow/preview")
        }, 300)
      }, totalDelay)
    )

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [router])

  if (!homeData) {
    return null
  }

  const shortAddress = homeData.street
    ? `${homeData.street}, ${homeData.city || ""}`
    : homeData.formattedAddress.split(",").slice(0, 2).join(",")

  return (
    <div className="flex flex-col items-center">
      {/* Context cards */}
      <div className="w-full max-w-md space-y-3 mb-10">
        {/* User intent card */}
        {userIntent && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">You mentioned</p>
                <p className="text-sm text-foreground">{userIntent}</p>
              </div>
            </div>
          </div>
        )}

        {/* Address card */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 shrink-0">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary mb-0.5">Address confirmed</p>
              <p className="text-sm font-medium text-foreground truncate">{shortAddress}</p>
            </div>
            <Check className="h-5 w-5 text-primary shrink-0" />
          </div>
        </div>
      </div>

      {/* Loading content */}
      <div className="flex flex-col items-center">
        {/* Logo with pulse */}
        <div className="mb-6">
          <div className={cn(
            "transition-all duration-700",
            isComplete ? "scale-110" : "animate-pulse"
          )}>
            <Image
              src="/logo.svg"
              alt="homework"
              width={60}
              height={60}
              className="h-12 w-auto opacity-80"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-8 text-xl font-semibold text-foreground">
          Finding your home
        </h1>

        {/* Steps */}
        <div className="space-y-4 w-full max-w-xs">
          {STEPS.map((step, index) => {
            const isActive = currentStep === index
            const isCompleted = currentStep > index
            const isPending = currentStep < index

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 transition-all duration-300",
                  isPending && "opacity-40"
                )}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1">
                  <p className={cn(
                    "text-sm transition-colors duration-300",
                    (isActive || isCompleted) ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  {step.subtitle && showSubtitle === step.id && (
                    <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in duration-300">
                      {step.subtitle}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
