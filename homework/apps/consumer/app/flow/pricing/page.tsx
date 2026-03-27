"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { PricingOption } from "@/types/flow"

// Hardcoded pricing options for demo
const PRICING_OPTIONS: PricingOption[] = [
  {
    id: "good-3ton",
    tier: "good",
    productLine: "Comfort Series",
    brand: "Carrier",
    seer: 14,
    stages: "single",
    priceRange: { min: 8200, max: 9400 },
    features: [
      "Reliable, proven system",
      "10-year parts warranty",
      "Standard efficiency",
    ],
  },
  {
    id: "better-3ton",
    tier: "better",
    productLine: "Performance Series",
    brand: "Carrier",
    seer: 17,
    stages: "two",
    priceRange: { min: 10800, max: 12200 },
    features: [
      "Quieter operation",
      "Better humidity control",
      "~15% energy savings",
      "Two-stage comfort",
    ],
    recommended: true,
  },
  {
    id: "best-3ton",
    tier: "best",
    productLine: "Infinity Series",
    brand: "Carrier",
    seer: 21,
    stages: "variable",
    priceRange: { min: 14200, max: 16100 },
    features: [
      "Whisper quiet",
      "Precise temp control",
      "~40% energy savings",
      "Best for allergies",
      "Variable-speed technology",
    ],
    bestFor: ["allergies", "efficiency"],
  },
]

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

export default function PricingPage() {
  const router = useRouter()

  const homeData = useFlowStore((s) => s.homeData)
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const setSelectedTier = useFlowStore((s) => s.setSelectedTier)

  // Redirect if no home data
  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    }
  }, [homeData, router])

  const handleSelectTier = (option: PricingOption) => {
    setSelectedTier(option)
    router.push("/flow/pros")
  }

  if (!homeData) {
    return null
  }

  const tonnage = discoveryData.sizing.tonnage || 3
  const hasAllergies = discoveryData.comfort.allergies === true

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Your options
        </h1>
        <p className="text-muted-foreground">
          Based on your {tonnage}-ton system{hasAllergies ? " and allergy needs" : ""}
        </p>
      </div>

      {/* Pricing cards */}
      <div className="space-y-4">
        {PRICING_OPTIONS.map((option) => {
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
