'use client'

import { useState } from 'react'
import { Check, Star, Shield, Clock, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProData } from '@/lib/flows'

interface ProSelectionCardProps {
  pros?: ProData[]
  selectedTier?: unknown
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Mock data for development
const MOCK_PROS: ProData[] = [
  {
    id: 'pro-1',
    name: 'Comfort Experts',
    rating: 4.9,
    reviewCount: 847,
    laborWarrantyYears: 5,
    yearsInBusiness: 18,
    logoUrl: undefined,
    price: 8500,
  },
  {
    id: 'pro-2',
    name: 'DFW Climate Control',
    rating: 4.8,
    reviewCount: 623,
    laborWarrantyYears: 3,
    yearsInBusiness: 12,
    logoUrl: undefined,
    price: 8200,
  },
  {
    id: 'pro-3',
    name: 'Premier HVAC Solutions',
    rating: 4.7,
    reviewCount: 412,
    laborWarrantyYears: 2,
    yearsInBusiness: 8,
    logoUrl: undefined,
    price: 7900,
  },
]

export function ProSelectionCard({
  pros = MOCK_PROS,
  selectedTier,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: ProSelectionCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof selectedValue === 'object' && selectedValue !== null
      ? (selectedValue as any).id
      : null
  )

  const handleSelect = (pro: ProData) => {
    setSelectedId(pro.id)
    onSelect?.(pro, pro.name)
  }

  // Sort by rating
  const sortedPros = [...pros].sort((a, b) => b.rating - a.rating)

  return (
    <div className={cn('space-y-3', className)}>
      {sortedPros.map((pro, index) => {
        const isSelected = selectedId === pro.id
        const isTopRated = index === 0

        return (
          <button
            key={pro.id}
            onClick={() => !completed && handleSelect(pro)}
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
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start gap-3">
              {/* Logo/Avatar */}
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl shrink-0',
                  'bg-gradient-to-br from-primary/20 to-primary/5',
                  'text-primary font-bold text-lg'
                )}
              >
                {pro.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground truncate">{pro.name}</p>
                  {isTopRated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                      <Award className="h-3 w-3" />
                      Top Rated
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-foreground">{pro.rating}</span>
                    <span className="text-muted-foreground">
                      ({pro.reviewCount.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    <span>{pro.laborWarrantyYears}-year labor warranty</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{pro.yearsInBusiness} years</span>
                  </div>
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary shrink-0">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
