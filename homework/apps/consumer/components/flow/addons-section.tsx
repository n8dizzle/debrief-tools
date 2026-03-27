"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { Addon } from "@/types/flow"

interface AddonsSectionProps {
  onContinue?: () => void
  className?: string
}

export function AddonsSection({ onContinue, className }: AddonsSectionProps) {
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const selectedAddons = useFlowStore((s) => s.selectedAddons)
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const toggleAddon = useFlowStore((s) => s.toggleAddon)
  const calculateTotals = useFlowStore((s) => s.calculateTotals)

  const [addonOptions, setAddonOptions] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch addons from the catalog API
  useEffect(() => {
    async function fetchAddons() {
      try {
        setLoading(true)
        const res = await fetch('/api/catalog/services/ac-system-replacement')
        if (!res.ok) throw new Error('Failed to load addons')
        const data = await res.json()
        // Map catalog addons to the Addon type (prices already in dollars from API)
        const mapped: Addon[] = (data.addons || []).map((a: { id: string; name: string; description: string; price: number; display_order: number }) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          shortDescription: a.description,
          price: a.price,
          category: 'other' as const,
        }))
        setAddonOptions(mapped)
      } catch (err) {
        console.error('[AddonsSection] Fetch error:', err)
        // Non-fatal — show empty addons list
      } finally {
        setLoading(false)
      }
    }
    fetchAddons()
  }, [])

  // Calculate totals on mount
  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  const handleToggleAddon = (addon: Addon) => {
    toggleAddon(addon)
  }

  const hasAllergies = discoveryData.comfort.allergies === true

  // Calculate live total
  const basePrice = selectedPro?.price ?? 0
  const addonsTotal = selectedAddons
    .filter((a) => !a.recurring)
    .reduce((sum, a) => sum + a.price, 0)
  const recurringTotal = selectedAddons
    .filter((a) => a.recurring)
    .reduce((sum, a) => sum + a.price, 0)
  const total = basePrice + addonsTotal

  if (loading) {
    return (
      <div className={cn("space-y-6 animate-in fade-in duration-300", className)}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Customize your installation</h2>
          <p className="text-muted-foreground">Loading available upgrades...</p>
        </div>
        <div className="space-y-3 max-w-xl mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded border bg-muted mt-0.5" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-2" />
                  <div className="h-3 bg-muted rounded w-56" />
                </div>
                <div className="h-4 bg-muted rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">
          Customize your installation
        </h2>
        {selectedPro && selectedTier && (
          <p className="text-muted-foreground">
            {selectedPro.name} · {selectedTier.brand} {selectedTier.productLine}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Base price: ${basePrice.toLocaleString()}
        </p>
      </div>

      {/* Section title */}
      {addonOptions.length > 0 && (
        <h3 className="font-medium text-foreground max-w-xl mx-auto">Popular upgrades</h3>
      )}

      {/* Add-on cards */}
      <div className="space-y-3 max-w-xl mx-auto">
        {addonOptions.map((addon) => {
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
      <div className="rounded-xl border border-border bg-muted/50 p-4 max-w-xl mx-auto">
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
      <div className="max-w-xl mx-auto">
        <Button onClick={onContinue} className="w-full" size="lg">
          Continue to scheduling
        </Button>
      </div>
    </div>
  )
}
