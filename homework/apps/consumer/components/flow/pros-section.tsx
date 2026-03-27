"use client"

import { useEffect, useState } from "react"
import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import type { ProOption } from "@/types/flow"

function formatDate(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow"
  }

  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

interface ProsSectionProps {
  onSelect?: (pro: ProOption) => void
  className?: string
}

export function ProsSection({ onSelect, className }: ProsSectionProps) {
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const homeData = useFlowStore((s) => s.homeData)
  const setSelectedPro = useFlowStore((s) => s.setSelectedPro)

  const [pros, setPros] = useState<ProOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const zip = homeData?.postalCode || '75201'
  const tier = selectedTier?.tier || 'better'

  useEffect(() => {
    async function fetchPros() {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ zip, tier })
        const res = await fetch(`/api/catalog/services/ac-system-replacement/contractors?${params}`)
        if (!res.ok) throw new Error('Failed to load pros')
        const data = await res.json()
        // Convert nextAvailable string back to Date for display
        const mapped = data.pros.map((p: ProOption & { nextAvailable: string | Date }) => ({
          ...p,
          nextAvailable: new Date(p.nextAvailable),
        }))
        setPros(mapped)
      } catch (err) {
        console.error('[ProsSection] Fetch error:', err)
        setError('Unable to load available pros. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchPros()
  }, [zip, tier])

  const handleSelectPro = (pro: ProOption) => {
    setSelectedPro(pro)
    onSelect?.(pro)
  }

  if (loading) {
    return (
      <div className={cn("space-y-6 animate-in fade-in duration-300", className)}>
        <div className="text-center space-y-2">
          {selectedTier && (
            <p className="text-sm text-muted-foreground">
              {selectedTier.brand} {selectedTier.productLine} · {selectedTier.seer} SEER
            </p>
          )}
          <h2 className="text-2xl font-semibold text-foreground">Finding available pros...</h2>
        </div>
        <div className="space-y-4 max-w-xl mx-auto">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-5 bg-muted rounded w-48 mb-2" />
                  <div className="h-4 bg-muted rounded w-32" />
                </div>
              </div>
              <div className="h-6 bg-muted rounded w-28 mb-3" />
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
          <h2 className="text-2xl font-semibold text-foreground">Available pros</h2>
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
        {selectedTier && (
          <p className="text-sm text-muted-foreground">
            {selectedTier.brand} {selectedTier.productLine} · {selectedTier.seer} SEER
          </p>
        )}
        <h2 className="text-2xl font-semibold text-foreground">
          Available pros
        </h2>
      </div>

      {/* Pro cards */}
      <div className="space-y-4 max-w-xl mx-auto">
        {pros.map((pro, index) => {
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
                    {pro.reviewCount > 0 && (
                      <span className="text-sm text-muted-foreground">
                        ({pro.reviewCount.toLocaleString()} reviews)
                      </span>
                    )}
                  </div>
                  {pro.established && pro.installCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Est. {pro.established} · {pro.installCount.toLocaleString()}+ installs
                    </p>
                  )}
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
