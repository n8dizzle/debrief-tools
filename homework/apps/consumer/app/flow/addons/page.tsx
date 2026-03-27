"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { Addon } from "@/types/flow"

// Hardcoded add-on options for demo
const ADDON_OPTIONS: Addon[] = [
  {
    id: "smart-thermostat",
    name: "Smart Thermostat",
    description: "Ecobee Premium with WiFi control, room sensors, and Alexa/Google compatibility",
    shortDescription: "WiFi control, room sensors",
    price: 449,
    category: "thermostat",
  },
  {
    id: "maintenance-plan",
    name: "Maintenance Plan",
    description: "2 tune-ups per year, priority scheduling, 15% off repairs",
    shortDescription: "2 tune-ups/year, priority service",
    price: 199,
    recurring: true,
    recurringInterval: "yearly",
    category: "maintenance",
  },
  {
    id: "iaq-package",
    name: "Air Quality Package",
    description: "UV light + media filter to kill mold/bacteria and improve filtration",
    shortDescription: "UV light + better filtration",
    price: 850,
    category: "iaq",
    recommended: true, // Will show as recommended if user has allergies
  },
  {
    id: "extended-warranty",
    name: "Extended Labor Warranty",
    description: "Extend your labor warranty from 10 years to 15 years",
    shortDescription: "10 years → 15 years",
    price: 599,
    category: "warranty",
  },
]

export default function AddonsPage() {
  const router = useRouter()

  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const selectedAddons = useFlowStore((s) => s.selectedAddons)
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const toggleAddon = useFlowStore((s) => s.toggleAddon)
  const calculateTotals = useFlowStore((s) => s.calculateTotals)

  // Redirect if missing data
  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    } else if (!selectedTier) {
      router.replace("/flow/pricing")
    } else if (!selectedPro) {
      router.replace("/flow/pros")
    }
  }, [homeData, selectedTier, selectedPro, router])

  // Calculate totals on mount
  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  const handleToggleAddon = (addon: Addon) => {
    toggleAddon(addon)
  }

  const handleContinue = () => {
    router.push("/flow/schedule")
  }

  if (!homeData || !selectedTier || !selectedPro) {
    return null
  }

  const hasAllergies = discoveryData.comfort.allergies === true

  // Calculate live total
  const basePrice = selectedPro.price
  const addonsTotal = selectedAddons
    .filter((a) => !a.recurring)
    .reduce((sum, a) => sum + a.price, 0)
  const recurringTotal = selectedAddons
    .filter((a) => a.recurring)
    .reduce((sum, a) => sum + a.price, 0)
  const total = basePrice + addonsTotal

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Customize your installation
        </h1>
        <p className="text-muted-foreground">
          {selectedPro.name} · {selectedTier.brand} {selectedTier.productLine}
        </p>
        <p className="text-sm text-muted-foreground">
          Base price: ${basePrice.toLocaleString()}
        </p>
      </div>

      {/* Section title */}
      <h2 className="font-medium text-foreground">Popular upgrades</h2>

      {/* Add-on cards */}
      <div className="space-y-3">
        {ADDON_OPTIONS.map((addon) => {
          const isSelected = selectedAddons.some((a) => a.id === addon.id)
          const isRecommended = addon.recommended && hasAllergies && addon.category === "iaq"

          return (
            <button
              key={addon.id}
              onClick={() => handleToggleAddon(addon)}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground"
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">
                        {addon.name}
                        {isRecommended && (
                          <span className="ml-2 text-xs font-medium text-primary">
                            Recommended
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {addon.shortDescription || addon.description}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground whitespace-nowrap">
                      +${addon.price.toLocaleString()}
                      {addon.recurring && (
                        <span className="text-muted-foreground">
                          /{addon.recurringInterval === "yearly" ? "yr" : "mo"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Total */}
      <div className="rounded-xl border border-border bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Your total</span>
          <span className="text-xl font-bold text-foreground">
            ${total.toLocaleString()}
          </span>
        </div>
        {recurringTotal > 0 && (
          <p className="text-sm text-muted-foreground text-right mt-1">
            + ${recurringTotal.toLocaleString()}/year maintenance
          </p>
        )}
      </div>

      {/* Continue button */}
      <Button onClick={handleContinue} className="w-full" size="lg">
        Continue to scheduling
      </Button>
    </div>
  )
}
