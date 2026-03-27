"use client"

import { useEffect, useState } from "react"
import { Check, Info, Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { PricingOption } from "@/types/flow"

// Tier descriptions for upgrade explanations
const TIER_DESCRIPTIONS: Record<string, string> = {
  good: "A solid, dependable choice that gets the job done. Great for budget-conscious homeowners.",
  better: "The sweet spot - runs quieter, lasts longer, and pays back through lower energy bills.",
  best: "Premium comfort and efficiency. Pays for itself in 5-7 years through energy savings.",
}

const TIER_LABELS = {
  good: "Good",
  better: "Better",
  best: "Best",
}

const STAGES_LABELS = {
  single: "Single-stage",
  two: "Two-stage",
  variable: "Variable-speed",
}

interface PricingSectionProps {
  onSelect?: (option: PricingOption) => void
  className?: string
}

export function PricingSection({ onSelect, className }: PricingSectionProps) {
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const homeData = useFlowStore((s) => s.homeData)
  const setSelectedTier = useFlowStore((s) => s.setSelectedTier)

  const [options, setOptions] = useState<PricingOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tonnage = discoveryData.sizing.tonnage || 3
  const hasAllergies = discoveryData.comfort.allergies === true
  const sqft = homeData?.sqft
  const zip = homeData?.postalCode || '75201'

  useEffect(() => {
    async function fetchPricing() {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({
          zip,
          tonnage: String(tonnage),
        })
        const res = await fetch(`/api/catalog/services/ac-system-replacement/pricing?${params}`)
        if (!res.ok) throw new Error('Failed to load pricing')
        const data = await res.json()
        setOptions(data.options)
      } catch (err) {
        console.error('[PricingSection] Fetch error:', err)
        setError('Unable to load pricing. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchPricing()
  }, [zip, tonnage])

  const handleSelectTier = (option: PricingOption) => {
    setSelectedTier(option)
    onSelect?.(option)
  }

  // Generate sizing explanation based on data source
  const getSizingExplanation = () => {
    if (discoveryData.sizing.source === "photo") {
      return "Based on your equipment's data plate"
    }
    if (sqft) {
      return `Based on your ${sqft.toLocaleString()} sq ft home (${Math.round(sqft / tonnage).toLocaleString()} sq ft per ton for DFW climate)`
    }
    return `Estimated for your home`
  }

  if (loading) {
    return (
      <div className={cn("space-y-6 animate-in fade-in duration-300", className)}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Your options</h2>
          <p className="text-muted-foreground">Loading pricing for your {tonnage}-ton system...</p>
        </div>
        <div className="space-y-4 max-w-xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-16 mb-2" />
              <div className="h-5 bg-muted rounded w-48 mb-1" />
              <div className="h-4 bg-muted rounded w-32 mb-4" />
              <div className="h-8 bg-muted rounded w-40 mb-4" />
              <div className="space-y-2 mb-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 bg-muted rounded w-56" />
                ))}
              </div>
              <div className="h-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Your options</h2>
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">
          Your options
        </h2>
        <p className="text-muted-foreground">
          Based on your {tonnage}-ton system{hasAllergies ? " and allergy needs" : ""}
        </p>
      </div>

      {/* Sizing explanation card */}
      <div className="max-w-xl mx-auto">
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">
              Why {tonnage} tons?
            </p>
            <p className="text-sm text-muted-foreground">
              {getSizingExplanation()}. A properly sized system runs more efficiently and lasts longer.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="space-y-4 max-w-xl mx-auto">
        {options.map((option) => {
          const isRecommended = option.recommended || (hasAllergies && option.bestFor?.includes("allergies"))

          return (
            <div
              key={option.id}
              className={cn(
                "relative rounded-2xl border bg-card p-5 transition-all",
                isRecommended
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Badge */}
              {isRecommended && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {hasAllergies && option.bestFor?.includes("allergies")
                    ? "Best for allergies"
                    : "Most popular"}
                </div>
              )}

              {/* Tier label */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {TIER_LABELS[option.tier]}
                  </span>
                  <h3 className="font-semibold text-foreground">
                    {option.brand} {option.productLine}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {option.seer} SEER · {STAGES_LABELS[option.stages]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 italic">
                    {TIER_DESCRIPTIONS[option.tier]}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <p className="text-2xl font-bold text-foreground">
                  ${option.priceRange.min.toLocaleString()} - ${option.priceRange.max.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">installed</p>
              </div>

              {/* Features */}
              <ul className="mb-5 space-y-2">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select button */}
              <Button
                onClick={() => handleSelectTier(option)}
                variant={isRecommended ? "default" : "outline"}
                className="w-full"
              >
                Select
              </Button>
            </div>
          )
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground">
        Final price confirmed after pro assesses your installation
      </p>
    </div>
  )
}
