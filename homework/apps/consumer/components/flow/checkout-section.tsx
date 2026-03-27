"use client"

import { useEffect, useState } from "react"
import { Calendar, Loader2, MapPin, Phone, Shield, User, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore, useTotals } from "@/lib/flow-state"
import { createOrder } from "@/lib/orders/create-order"
import { cn } from "@/lib/utils"

function formatDisplayDate(dateStr: string, time: string): string {
  const date = new Date(dateStr + "T12:00:00")
  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
  return `${formatted} at ${time}`
}

interface CheckoutSectionProps {
  onContinue?: () => void
  className?: string
}

export function CheckoutSection({ onContinue, className }: CheckoutSectionProps) {
  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const selectedAddons = useFlowStore((s) => s.selectedAddons)
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const scheduledDate = useFlowStore((s) => s.scheduledDate)
  const scheduledTime = useFlowStore((s) => s.scheduledTime)
  const customerName = useFlowStore((s) => s.customerName)
  const customerPhone = useFlowStore((s) => s.customerPhone)
  const calculateTotals = useFlowStore((s) => s.calculateTotals)
  const setOrderId = useFlowStore((s) => s.setOrderId)
  const totals = useTotals()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate totals on mount
  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  if (!homeData || !selectedTier || !selectedPro || !scheduledDate || !scheduledTime) {
    return null
  }

  const recurringAddons = selectedAddons.filter((a) => a.recurring)
  const oneTimeAddons = selectedAddons.filter((a) => !a.recurring)

  const handlePlaceOrder = async () => {
    try {
      setSubmitting(true)
      setError(null)

      const result = await createOrder({
        homeData,
        selectedTier,
        selectedPro,
        selectedAddons,
        discoveryData,
        scheduledDate,
        scheduledTime,
        customerName,
        customerPhone,
        totals,
      })

      setOrderId(result.orderId)
      onContinue?.()
    } catch (err) {
      console.error('[Checkout] Order creation failed:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          Review your order
        </h2>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border max-w-xl mx-auto">
        {/* Address */}
        <div className="p-4 flex items-start gap-3">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{homeData.formattedAddress}</p>
        </div>

        {/* System */}
        <div className="p-4 flex items-start gap-3">
          <Wrench className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {selectedTier.brand} {selectedTier.productLine} {selectedTier.seer} SEER
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedTier.stages === "variable" ? "Variable-speed" : selectedTier.stages === "two" ? "Two-stage" : "Single-stage"}
            </p>
          </div>
        </div>

        {/* Pro */}
        <div className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{selectedPro.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedPro.rating > 0 ? `★ ${selectedPro.rating} · ` : ''}Licensed & Insured
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="p-4 flex items-start gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            {formatDisplayDate(scheduledDate, scheduledTime)}
          </p>
        </div>

        {/* Contact info */}
        {customerName && customerPhone && (
          <div className="p-4 flex items-start gap-3">
            <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{customerName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {customerPhone}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Price breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-xl mx-auto">
        <div className="flex justify-between text-sm">
          <span className="text-foreground">Base installation</span>
          <span className="font-medium">${selectedPro.price.toLocaleString()}</span>
        </div>

        {oneTimeAddons.map((addon) => (
          <div key={addon.id} className="flex justify-between text-sm">
            <span className="text-foreground">{addon.name}</span>
            <span className="font-medium">${addon.price.toLocaleString()}</span>
          </div>
        ))}

        {totals.rushFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-foreground">Rush fee</span>
            <span className="font-medium">${totals.rushFee.toLocaleString()}</span>
          </div>
        )}

        <div className="border-t border-border pt-3 flex justify-between">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-bold text-lg">${totals.total.toLocaleString()}</span>
        </div>

        {recurringAddons.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            + ${totals.recurringAddons.toLocaleString()}/yr maintenance
          </p>
        )}
      </div>

      {/* Payment details */}
      <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2 max-w-xl mx-auto">
        <div className="flex justify-between text-sm">
          <span className="text-foreground">Deposit due today (10%)</span>
          <span className="font-semibold text-foreground">
            ${totals.deposit.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Balance due at install</span>
          <span className="text-muted-foreground">
            ${totals.balance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-xl mx-auto rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Payment section */}
      <div className="max-w-xl mx-auto space-y-4">
        {/* Payment card placeholder */}
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Stripe payment form will appear here
          </p>
          <p className="text-xs text-muted-foreground">
            10% deposit charged now, balance due at installation
          </p>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Placing order...
            </>
          ) : (
            `Pay $${totals.deposit.toLocaleString()} deposit`
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" />
          Secured by Stripe · Cancel free up to 48 hours before
        </p>
      </div>
    </div>
  )
}
