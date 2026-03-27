"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Check, Loader2, Users, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddressMap } from "@/components/flow/address-map"
import { getPropertyData } from "@/lib/property-data-server"
import { cn } from "@/lib/utils"
import { FunFactChip, YEAR_BUILT_FACTS, HVAC_FACTS } from "@/components/chat/fun-fact-chip"
import type { HomeData } from "@/types/flow"

// Loading messages with timing (removed "Building your HomeFit profile")
const LOADING_STEPS = [
  { text: "Found it", delay: 600, subtitle: null },
  { text: "Pulling property details", delay: 1400, subtitle: null },
  { text: "Tax records found", delay: 2400, subtitle: "(Our condolences.)" },
  { text: "Checking contractor availability", delay: 3600, subtitle: null },
]

// Year facts for property-specific fun facts (extended version)
const YEAR_FACTS: Record<number, string> = {
  ...YEAR_BUILT_FACTS,
  // Additional decade-based facts are handled in getFunFact
}

interface PropertyData {
  sqft: number | null
  yearBuilt: number | null
  beds: number | null
  baths: number | null
  stories: number | null
  lotSizeSqft: number | null
}

interface InlineLoadingMessageProps {
  homeData: HomeData
  onConfirm: () => void
  onNotMyHome: () => void
  onPropertyDataFetched: (data: PropertyData) => void
  onSignIn: () => void
}

type Phase = "loading" | "reveal" | "confirm" | "availability"

export function InlineLoadingMessage({
  homeData,
  onConfirm,
  onNotMyHome,
  onPropertyDataFetched,
  onSignIn,
}: InlineLoadingMessageProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFunFact, setShowFunFact] = useState(false)
  const propertyFetched = useRef(false)

  // Fetch property data on mount
  useEffect(() => {
    if (propertyFetched.current) return
    propertyFetched.current = true

    getPropertyData(homeData.formattedAddress)
      .then((data) => {
        // Convert undefined to null for consistency
        const normalizedData: PropertyData = {
          sqft: data.sqft ?? null,
          yearBuilt: data.yearBuilt ?? null,
          beds: data.beds ?? null,
          baths: data.baths ?? null,
          stories: data.stories ?? null,
          lotSizeSqft: data.lotSizeSqft ?? null,
        }
        setPropertyData(normalizedData)
        onPropertyDataFetched(normalizedData)
      })
      .catch((error) => {
        console.error("Failed to fetch property data:", error)
        // Use fallback data from homeData if available
        setPropertyData({
          sqft: homeData.sqft,
          yearBuilt: homeData.yearBuilt,
          beds: homeData.beds,
          baths: homeData.baths,
          stories: homeData.stories,
          lotSizeSqft: homeData.lotSizeSqft,
        })
      })
  }, [homeData, onPropertyDataFetched])

  // Run loading step timers
  useEffect(() => {
    const timers = LOADING_STEPS.map((step, index) =>
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index])
      }, step.delay)
    )

    // After all steps complete, show property details
    const revealTimer = setTimeout(() => {
      setPhase("reveal")
      setShowDetails(true)
    }, 4000)

    // Show fun fact after property details
    const funFactTimer = setTimeout(() => {
      setShowFunFact(true)
    }, 4600)

    // Show confirm buttons
    const confirmTimer = setTimeout(() => {
      setPhase("confirm")
    }, 5000)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(revealTimer)
      clearTimeout(funFactTimer)
      clearTimeout(confirmTimer)
    }
  }, [])

  // Generate fun fact based on property data (NOT sizing-based)
  const getFunFact = useCallback(() => {
    const year = propertyData?.yearBuilt || homeData.yearBuilt

    // Try year-based fact first
    if (year && YEAR_FACTS[year]) {
      return `Built in ${year}? ${YEAR_FACTS[year]}`
    }

    // Check for decade-based facts
    if (year) {
      if (year >= 1980 && year < 1990) {
        return `Built in the 80s? Your home might have that classic popcorn ceiling charm.`
      }
      if (year < 1998) {
        return `Your home is older than Google (founded 1998).`
      }
      if (year < 2004) {
        return `Your home is older than Facebook.`
      }
    }

    // Lot size fact
    const lotSqft = propertyData?.lotSizeSqft || homeData.lotSizeSqft
    if (lotSqft && lotSqft > 20000) {
      const acres = (lotSqft / 43560).toFixed(2)
      return `Your ${acres}-acre lot could fit a couple of tennis courts.`
    }

    // Fall back to random HVAC fact
    return HVAC_FACTS[Math.floor(Math.random() * HVAC_FACTS.length)]
  }, [propertyData, homeData])

  // Handle "That's my home" click - show availability and fun fact
  const handleConfirm = () => {
    setPhase("availability")
    onConfirm()

    // Show fun fact chip inline after a short delay
    setTimeout(() => {
      setShowFunFact(true)
    }, 400)
  }

  const shortAddress = homeData.street
    ? `${homeData.street}, ${homeData.city || ""}`
    : homeData.formattedAddress.split(",")[0]

  // Merge property data with homeData for display (6 fields now)
  const displayData = {
    sqft: propertyData?.sqft ?? homeData.sqft,
    yearBuilt: propertyData?.yearBuilt ?? homeData.yearBuilt,
    beds: propertyData?.beds ?? homeData.beds,
    baths: propertyData?.baths ?? homeData.baths,
    stories: propertyData?.stories ?? homeData.stories,
    lotSizeSqft: propertyData?.lotSizeSqft ?? homeData.lotSizeSqft,
  }

  // Convert lot size to acres for display
  const lotAcres = displayData.lotSizeSqft
    ? (displayData.lotSizeSqft / 43560).toFixed(2)
    : null

  // Calculate next available install date (1-2 business days)
  const getNextInstallDate = () => {
    const today = new Date()
    let daysToAdd = 1

    // If today is Friday, Saturday, or Sunday, adjust
    const dayOfWeek = today.getDay()
    if (dayOfWeek === 5) daysToAdd = 1 // Friday -> Saturday
    else if (dayOfWeek === 6) daysToAdd = 2 // Saturday -> Monday
    else if (dayOfWeek === 0) daysToAdd = 1 // Sunday -> Monday

    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysToAdd)

    return nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Satellite Map */}
      {homeData.latitude && homeData.longitude && (
        <AddressMap
          latitude={homeData.latitude}
          longitude={homeData.longitude}
          address={homeData.formattedAddress}
          className="h-40"
        />
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Address */}
        <p className="font-medium text-foreground">{shortAddress}</p>

        {/* Loading checklist */}
        {phase !== "availability" && (
          <div className="space-y-2">
            {LOADING_STEPS.map((step, index) => {
              const isComplete = completedSteps.includes(index)
              const isActive = !isComplete && completedSteps.length === index

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-2 text-sm transition-all duration-300",
                    isComplete && "opacity-100",
                    !isComplete && !isActive && "opacity-30",
                    isActive && "opacity-60"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                  <span className="text-foreground">{step.text}</span>
                  {step.subtitle && isComplete && (
                    <span className="text-muted-foreground text-xs">{step.subtitle}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Property details grid - 6 cards, cascades in */}
        {/* Order: built, stories, sqft, acres, beds, baths */}
        {showDetails && phase !== "availability" && (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {displayData.yearBuilt && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{displayData.yearBuilt}</p>
                <p className="text-xs text-muted-foreground">built</p>
              </div>
            )}
            {displayData.stories && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{displayData.stories}</p>
                <p className="text-xs text-muted-foreground">stories</p>
              </div>
            )}
            {displayData.sqft && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {displayData.sqft.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">sq ft</p>
              </div>
            )}
            {lotAcres && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{lotAcres}</p>
                <p className="text-xs text-muted-foreground">acres</p>
              </div>
            )}
            {displayData.beds && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{displayData.beds}</p>
                <p className="text-xs text-muted-foreground">beds</p>
              </div>
            )}
            {displayData.baths && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{displayData.baths}</p>
                <p className="text-xs text-muted-foreground">baths</p>
              </div>
            )}
          </div>
        )}

        {/* Fun fact - appears after property details, before confirm */}
        {showFunFact && phase !== "availability" && (
          <FunFactChip fact={getFunFact()} />
        )}

        {/* Confirmation buttons */}
        {phase === "confirm" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button onClick={handleConfirm} className="w-full min-h-[44px]" size="lg">
              That's my home
            </Button>
            <button
              onClick={onNotMyHome}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors py-3 min-h-[44px] rounded-lg"
              aria-label="This is not my home, enter a different address"
            >
              Not my home?
            </button>
          </div>
        )}

        {/* Contractor Availability Section */}
        {phase === "availability" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground mb-1">Great news!</p>
            </div>

            {/* Availability info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">12 vetted pros serve your area</p>
                  <p className="text-sm text-muted-foreground">Licensed, insured, and background-checked</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Installs available as early as {getNextInstallDate()}</p>
                  <p className="text-sm text-muted-foreground">Most installs take less than a day</p>
                </div>
              </div>
            </div>

            {/* Auth CTA */}
            <div className="space-y-3 pt-2">
              <p className="text-center text-sm text-muted-foreground">
                Ready to see custom pricing for <span className="font-medium text-foreground">your</span> home?
              </p>
              <Button onClick={onSignIn} className="w-full" size="lg">
                Continue with Google
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                We'll save your home profile so you never have to enter this again
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
