'use client'

import { Info, Thermometer, Home, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SizingCardProps {
  sqft?: number
  tonnage?: number
  climate?: string
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

export function SizingCard({
  sqft,
  tonnage,
  climate = 'DFW',
  onSelect,
  completed = false,
  selectedValue,
  className,
}: SizingCardProps) {
  // Calculate sq ft per ton for explanation
  const sqftPerTon = sqft && tonnage ? Math.round(sqft / tonnage) : 745

  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
        className
      )}
    >
      {/* Main sizing display */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl',
            completed ? 'bg-primary/20' : 'bg-primary/10'
          )}
        >
          <Thermometer className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">
            {tonnage}-ton system
          </p>
          <p className="text-sm text-muted-foreground">
            Recommended for your home
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-xl bg-muted/50 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Why {tonnage} tons?</span>
          </p>
        </div>
        <div className="pl-6 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Home className="h-3.5 w-3.5" />
            <span>{sqft?.toLocaleString() || '—'} sq ft home</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>{climate} climate (~{sqftPerTon} sq ft per ton)</span>
          </div>
        </div>
        <p className="pl-6 text-xs text-muted-foreground/80">
          A properly sized system runs more efficiently and lasts longer.
        </p>
      </div>
    </div>
  )
}
