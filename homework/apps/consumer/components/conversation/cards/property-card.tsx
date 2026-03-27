'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddressMap } from '@/components/flow/address-map'
import { FunFactChip, YEAR_BUILT_FACTS, HVAC_FACTS } from '@/components/chat/fun-fact-chip'
import { getPropertyData } from '@/lib/property-data-server'
import { cn } from '@/lib/utils'
import type { PropertyRevealData } from '@/types/conversation'

// Loading steps with timing
const LOADING_STEPS = [
  { text: 'Found it', delay: 600, subtitle: null },
  { text: 'Pulling property details', delay: 1400, subtitle: null },
  { text: 'Tax records found', delay: 2400, subtitle: '(Our condolences.)' },
  { text: 'Checking contractor availability', delay: 3600, subtitle: null },
]

interface PropertyCardProps {
  data: PropertyRevealData
  onConfirm: () => void
  onNotMyHome: () => void
  onPropertyDataFetched?: (data: Partial<PropertyRevealData>) => void
  className?: string
}

type Phase = 'loading' | 'reveal' | 'confirm'

export function PropertyCard({
  data,
  onConfirm,
  onNotMyHome,
  onPropertyDataFetched,
  className,
}: PropertyCardProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [propertyData, setPropertyData] = useState<Partial<PropertyRevealData>>(data)
  const [showDetails, setShowDetails] = useState(false)
  const [showFunFact, setShowFunFact] = useState(false)
  const propertyFetched = useRef(false)

  // Fetch additional property data on mount
  useEffect(() => {
    if (propertyFetched.current || !data.address) return
    propertyFetched.current = true

    getPropertyData(data.address)
      .then((fetchedData) => {
        const merged = {
          ...data,
          sqft: fetchedData.sqft ?? data.sqft,
          yearBuilt: fetchedData.yearBuilt ?? data.yearBuilt,
          beds: fetchedData.beds ?? data.beds,
          baths: fetchedData.baths ?? data.baths,
          stories: fetchedData.stories ?? data.stories,
          lotSizeSqft: fetchedData.lotSizeSqft ?? data.lotSizeSqft,
        }
        setPropertyData(merged)
        onPropertyDataFetched?.(merged)
      })
      .catch(console.error)
  }, [data, onPropertyDataFetched])

  // Run loading step timers
  useEffect(() => {
    const timers = LOADING_STEPS.map((step, index) =>
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index])
      }, step.delay)
    )

    // Show property details
    const revealTimer = setTimeout(() => {
      setPhase('reveal')
      setShowDetails(true)
    }, 4000)

    // Show fun fact
    const funFactTimer = setTimeout(() => {
      setShowFunFact(true)
    }, 4600)

    // Show confirm buttons
    const confirmTimer = setTimeout(() => {
      setPhase('confirm')
    }, 5000)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(revealTimer)
      clearTimeout(funFactTimer)
      clearTimeout(confirmTimer)
    }
  }, [])

  // Generate fun fact based on property data
  const getFunFact = useCallback(() => {
    const year = propertyData.yearBuilt

    if (year && YEAR_BUILT_FACTS[year]) {
      return `Built in ${year}? ${YEAR_BUILT_FACTS[year]}`
    }

    if (year) {
      if (year >= 1980 && year < 1990) {
        return `Built in the 80s? Your home might have that classic popcorn ceiling charm.`
      }
      if (year < 1998) return `Your home is older than Google (founded 1998).`
      if (year < 2004) return `Your home is older than Facebook.`
    }

    const lotSqft = propertyData.lotSizeSqft
    if (lotSqft && lotSqft > 20000) {
      const acres = (lotSqft / 43560).toFixed(2)
      return `Your ${acres}-acre lot could fit a couple of tennis courts.`
    }

    return HVAC_FACTS[Math.floor(Math.random() * HVAC_FACTS.length)]
  }, [propertyData])

  const shortAddress = data.address.split(',')[0]
  const lotAcres = propertyData.lotSizeSqft
    ? (propertyData.lotSizeSqft / 43560).toFixed(2)
    : null

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
    >
      {/* Satellite Map */}
      {data.latitude && data.longitude && (
        <AddressMap
          latitude={data.latitude}
          longitude={data.longitude}
          address={data.address}
          className="h-52"
        />
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Address */}
        <p className="font-medium text-foreground">{shortAddress}</p>

        {/* Loading checklist */}
        <div className="space-y-2">
          {LOADING_STEPS.map((step, index) => {
            const isComplete = completedSteps.includes(index)
            const isActive = !isComplete && completedSteps.length === index

            return (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 text-sm transition-all duration-300',
                  isComplete && 'opacity-100',
                  !isComplete && !isActive && 'opacity-30',
                  isActive && 'opacity-60'
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

        {/* Property details grid - 6 cards */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {propertyData.yearBuilt && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{propertyData.yearBuilt}</p>
                <p className="text-xs text-muted-foreground">built</p>
              </div>
            )}
            {propertyData.stories && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{propertyData.stories}</p>
                <p className="text-xs text-muted-foreground">stories</p>
              </div>
            )}
            {propertyData.sqft && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {propertyData.sqft.toLocaleString()}
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
            {propertyData.beds && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{propertyData.beds}</p>
                <p className="text-xs text-muted-foreground">beds</p>
              </div>
            )}
            {propertyData.baths && (
              <div className="rounded-lg bg-muted p-2.5 text-center">
                <p className="text-lg font-semibold text-foreground">{propertyData.baths}</p>
                <p className="text-xs text-muted-foreground">baths</p>
              </div>
            )}
          </div>
        )}

        {/* Fun fact */}
        {showFunFact && <FunFactChip fact={getFunFact()} />}

        {/* Confirmation buttons */}
        {phase === 'confirm' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button onClick={onConfirm} className="w-full min-h-[44px]" size="lg">
              That's my home
            </Button>
            <button
              onClick={onNotMyHome}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors py-3 min-h-[44px] rounded-lg"
            >
              Not my home?
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
