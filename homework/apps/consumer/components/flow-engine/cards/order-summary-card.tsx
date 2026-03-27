'use client'

import { Check, Home, Thermometer, User, Calendar, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertyData, PricingOption, ProData } from '@/lib/flows'

interface OrderSummaryCardProps {
  property?: PropertyData
  selectedTier?: PricingOption
  selectedPro?: ProData
  selectedAddons?: Array<{ id: string; name: string; price: number }>
  scheduledDate?: string
  scheduledTime?: string
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

export function OrderSummaryCard({
  property,
  selectedTier,
  selectedPro,
  selectedAddons = [],
  scheduledDate,
  scheduledTime,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: OrderSummaryCardProps) {
  // Calculate totals
  const systemPrice = selectedTier?.price || 0
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0)
  const totalPrice = systemPrice + addonsTotal
  const depositAmount = 500

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30' : 'border-border',
        className
      )}
    >
      {/* Header */}
      <div className="bg-primary/5 border-b border-border/50 px-4 py-3">
        <h3 className="font-semibold text-foreground">Order Summary</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Property */}
        {property && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
              <Home className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Installation address</p>
              <p className="text-sm font-medium text-foreground truncate">
                {property.street || property.formattedAddress?.split(',')[0]}
              </p>
            </div>
            <Check className="h-4 w-4 text-primary shrink-0" />
          </div>
        )}

        {/* System */}
        {selectedTier && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">System</p>
              <p className="text-sm font-medium text-foreground">
                {selectedTier.brand} {selectedTier.productLine}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedTier.seer} SEER · {selectedTier.stages}-stage
              </p>
            </div>
            <p className="text-sm font-medium text-foreground shrink-0">
              ${systemPrice.toLocaleString()}
            </p>
          </div>
        )}

        {/* Pro */}
        {selectedPro && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Installer</p>
              <p className="text-sm font-medium text-foreground">{selectedPro.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedPro.laborWarrantyYears}-year labor warranty
              </p>
            </div>
            <Check className="h-4 w-4 text-primary shrink-0" />
          </div>
        )}

        {/* Schedule */}
        {scheduledDate && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Installation</p>
              <p className="text-sm font-medium text-foreground">{formatDate(scheduledDate)}</p>
              {scheduledTime && (
                <p className="text-xs text-muted-foreground">{scheduledTime}</p>
              )}
            </div>
            <Check className="h-4 w-4 text-primary shrink-0" />
          </div>
        )}

        {/* Add-ons */}
        {selectedAddons.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Add-ons</p>
              {selectedAddons.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{addon.name}</p>
                  <p className="text-xs text-muted-foreground">+${addon.price}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border pt-4 space-y-2">
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">
              ${totalPrice.toLocaleString()}
            </span>
          </div>

          {/* Deposit */}
          <div className="flex items-center justify-between text-primary">
            <span className="text-sm font-medium">Due today (deposit)</span>
            <span className="text-sm font-bold">${depositAmount}</span>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">Balance due after installation</span>
            <span className="text-xs">${(totalPrice - depositAmount).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
