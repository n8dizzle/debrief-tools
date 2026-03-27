"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { ProOption } from "@/types/flow"

// Hardcoded pro options for demo
const PRO_OPTIONS: ProOption[] = [
  {
    id: "christmas-air",
    name: "Christmas Air & Plumbing",
    rating: 4.9,
    reviewCount: 847,
    established: 2019,
    installCount: 2400,
    price: 11247,
    laborWarrantyYears: 10,
    includedExtras: ["Free smart thermostat", "Same-day service"],
    nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    badges: ["Licensed & insured", "Background checked", "Next-day available"],
  },
  {
    id: "comfort-experts",
    name: "Comfort Experts",
    rating: 4.8,
    reviewCount: 412,
    established: 2015,
    installCount: 1800,
    price: 10890,
    laborWarrantyYears: 5,
    includedExtras: [],
    nextAvailable: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // In 3 days
    badges: ["Licensed & insured", "Background checked"],
  },
]

function formatDate(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow"
  }

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

export default function ProsPage() {
  const router = useRouter()

  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const setSelectedPro = useFlowStore((s) => s.setSelectedPro)

  // Redirect if missing data
  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    } else if (!selectedTier) {
      router.replace("/flow/pricing")
    }
  }, [homeData, selectedTier, router])

  const handleSelectPro = (pro: ProOption) => {
    setSelectedPro(pro)
    router.push("/flow/addons")
  }

  if (!homeData || !selectedTier) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {selectedTier.brand} {selectedTier.productLine} · {selectedTier.seer} SEER
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          Available pros
        </h1>
      </div>

      {/* Pro cards */}
      <div className="space-y-4">
        {PRO_OPTIONS.map((pro, index) => {
          const isBestValue = index === 0

          return (
            <div
              key={pro.id}
              className={cn(
                "relative rounded-2xl border bg-card p-5 transition-all",
                isBestValue
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Best value badge */}
              {isBestValue && (
                <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Soonest available
                </div>
              )}

              {/* Pro header */}
              <div className="flex items-start gap-4 mb-4">
                {/* Logo placeholder */}
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-muted-foreground">
                    {pro.name.charAt(0)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{pro.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{pro.rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({pro.reviewCount.toLocaleString()} reviews)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Est. {pro.established} · {pro.installCount.toLocaleString()}+ installs
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {pro.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    <Check className="h-3 w-3 text-primary" />
                    {badge}
                  </span>
                ))}
              </div>

              {/* Price and details */}
              <div className="space-y-2 mb-4">
                <p className="text-xl font-bold text-foreground">
                  ${pro.price.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Includes: {pro.laborWarrantyYears}-yr labor warranty
                  {pro.includedExtras.length > 0 && `, ${pro.includedExtras.join(", ")}`}
                </p>
              </div>

              {/* Availability */}
              <p className="text-sm text-foreground mb-4">
                <span className="font-medium">Next available:</span>{" "}
                {formatDate(pro.nextAvailable)}
              </p>

              {/* Select button */}
              <Button
                onClick={() => handleSelectPro(pro)}
                variant={isBestValue ? "default" : "outline"}
                className="w-full"
              >
                Select this pro
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
