'use client'

import { useState } from 'react'
import { Check, Star, Zap, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PricingOption } from '@/lib/flows'

interface PricingOptionsCardProps {
  options?: PricingOption[]
  tonnage?: number
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Mock data for development
const MOCK_OPTIONS: PricingOption[] = [
  {
    id: 'good',
    tier: 'good',
    brand: 'Carrier',
    productLine: 'Comfort Series',
    seer: 14,
    stages: 1,
    price: 8500,
    monthlyPayment: 142,
    features: ['10-year parts warranty', 'Single-stage cooling', 'Reliable performance'],
  },
  {
    id: 'better',
    tier: 'better',
    brand: 'Carrier',
    productLine: 'Performance Series',
    seer: 17,
    stages: 2,
    price: 11200,
    monthlyPayment: 187,
    features: ['10-year parts warranty', 'Two-stage cooling', 'Quieter operation', 'Better humidity control'],
  },
  {
    id: 'best',
    tier: 'best',
    brand: 'Carrier',
    productLine: 'Infinity Series',
    seer: 21,
    stages: 5,
    price: 15800,
    monthlyPayment: 263,
    features: ['Lifetime compressor warranty', 'Variable-speed', 'Whisper quiet', 'Precise temperature control', 'Lowest energy bills'],
  },
]

export function PricingOptionsCard({
  options = MOCK_OPTIONS,
  tonnage,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: PricingOptionsCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof selectedValue === 'object' && selectedValue !== null
      ? (selectedValue as any).id
      : null
  )

  const handleSelect = (option: PricingOption) => {
    setSelectedId(option.id)
    onSelect?.(option, `${option.brand} ${option.productLine}`)
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'good': return null
      case 'better': return Star
      case 'best': return Zap
      default: return null
    }
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'good': return 'GOOD'
      case 'better': return 'BETTER'
      case 'best': return 'BEST'
      default: return tier.toUpperCase()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {options.map((option) => {
        const isSelected = selectedId === option.id
        const TierIcon = getTierIcon(option.tier)

        return (
          <button
            key={option.id}
            onClick={() => !completed && handleSelect(option)}
            disabled={completed}
            className={cn(
              'w-full text-left rounded-2xl border p-4',
              'transition-all duration-200',
              'animate-in fade-in slide-in-from-bottom-2',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50',
              completed && !isSelected && 'opacity-50',
              completed && 'cursor-default'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'text-xs font-bold tracking-wide',
                      option.tier === 'best' ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {getTierLabel(option.tier)}
                  </span>
                  {TierIcon && <TierIcon className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="font-semibold text-foreground">
                  {option.brand} {option.productLine}
                </p>
                <p className="text-sm text-muted-foreground">
                  {option.seer} SEER · {option.stages === 1 ? 'Single' : option.stages === 2 ? 'Two' : 'Variable'}-stage
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">
                  ${option.price.toLocaleString()}
                </p>
                {option.monthlyPayment && (
                  <p className="text-xs text-muted-foreground">
                    or ${option.monthlyPayment}/mo
                  </p>
                )}
              </div>
            </div>

            {/* Features - show on hover/selected */}
            {(isSelected || option.tier === 'best') && (
              <div className="pt-3 border-t border-border/50">
                <div className="flex flex-wrap gap-2">
                  {option.features.slice(0, 4).map((feature, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <Check className="h-3 w-3 text-primary" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Selection indicator */}
            {isSelected && (
              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-primary/20">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Selected</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
