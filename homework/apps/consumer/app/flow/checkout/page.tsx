"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Check, MapPin, Shield, User, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore, useTotals } from "@/lib/flow-state"
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

export default function CheckoutPage() {
  const router = useRouter()

  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const selectedAddons = useFlowStore((s) => s.selectedAddons)
  const scheduledDate = useFlowStore((s) => s.scheduledDate)
  const scheduledTime = useFlowStore((s) => s.scheduledTime)
  const calculateTotals = useFlowStore((s) => s.calculateTotals)
  const totals = useTotals()

  const [showAuthPrompt, setShowAuthPrompt] = useState(false)

  // Redirect if missing data
  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    } else if (!selectedTier) {
      router.replace("/flow/pricing")
    } else if (!selectedPro) {
      router.replace("/flow/pros")
    } else if (!scheduledDate || !scheduledTime) {
      router.replace("/flow/schedule")
    }
  }, [homeData, selectedTier, selectedPro, scheduledDate, scheduledTime, router])

  // Calculate totals on mount
  useEffect(() => {
    calculateTotals()
  }, [calculateTotals])

  const handleProceedToPayment = () => {
    // For now, show auth prompt (Stripe integration is lower priority)
    setShowAuthPrompt(true)
  }

  if (!homeData || !selectedTier || !selectedPro || !scheduledDate || !scheduledTime) {
    return null
  }

  const recurringAddons = selectedAddons.filter((a) => a.recurring)
  const oneTimeAddons = selectedAddons.filter((a) => !a.recurring)

  if (showAuthPrompt) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Create your account to complete your order
          </h1>
          <p className="text-muted-foreground">
            Your quote and home profile will be saved automatically.
          </p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" size="lg">
            Continue with Google
          </Button>
          <Button variant="outline" className="w-full" size="lg">
            Continue with email
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Review your order
        </h1>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
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
              ★ {selectedPro.rating} · Licensed & Insured
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
      </div>

      {/* Price breakdown */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
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
      <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
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

      {/* Payment button */}
      <Button onClick={handleProceedToPayment} className="w-full" size="lg">
        Continue to payment
      </Button>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="h-3 w-3" />
        Secured by Stripe
      </p>
    </div>
  )
}
