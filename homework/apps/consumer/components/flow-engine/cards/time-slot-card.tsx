'use client'

import { useState } from 'react'
import { Check, Clock, Sun, Sunset } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeSlot {
  id: string
  label: string
  time: string
  period: 'morning' | 'afternoon'
  available: boolean
}

interface TimeSlotCardProps {
  slots?: TimeSlot[]
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Default slots
const DEFAULT_SLOTS: TimeSlot[] = [
  { id: 'morning-early', label: 'Early Morning', time: '7:00 AM - 9:00 AM', period: 'morning', available: true },
  { id: 'morning-late', label: 'Late Morning', time: '9:00 AM - 11:00 AM', period: 'morning', available: true },
  { id: 'afternoon-early', label: 'Early Afternoon', time: '12:00 PM - 2:00 PM', period: 'afternoon', available: true },
  { id: 'afternoon-late', label: 'Late Afternoon', time: '2:00 PM - 4:00 PM', period: 'afternoon', available: false },
]

export function TimeSlotCard({
  slots = DEFAULT_SLOTS,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: TimeSlotCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof selectedValue === 'string' ? selectedValue : null
  )

  const handleSelect = (slot: TimeSlot) => {
    if (completed || !slot.available) return

    setSelectedId(slot.id)
    onSelect?.(slot.time, slot.time)
  }

  const morningSlots = slots.filter((s) => s.period === 'morning')
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon')

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-4 space-y-4',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30 bg-primary/5' : 'border-border',
        className
      )}
    >
      {/* Morning slots */}
      {morningSlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sun className="h-4 w-4" />
            <span>Morning</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {morningSlots.map((slot) => {
              const isSelected = selectedId === slot.id

              return (
                <button
                  key={slot.id}
                  onClick={() => handleSelect(slot)}
                  disabled={completed || !slot.available}
                  className={cn(
                    'flex flex-col items-center py-3 px-2 rounded-xl',
                    'transition-all duration-150',
                    'min-h-[44px]',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : slot.available
                        ? 'bg-muted/50 hover:bg-muted text-foreground'
                        : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed',
                    completed && 'cursor-default'
                  )}
                >
                  <span className="text-sm font-medium">{slot.time}</span>
                  {!slot.available && (
                    <span className="text-[10px] mt-0.5">Unavailable</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Afternoon slots */}
      {afternoonSlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sunset className="h-4 w-4" />
            <span>Afternoon</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {afternoonSlots.map((slot) => {
              const isSelected = selectedId === slot.id

              return (
                <button
                  key={slot.id}
                  onClick={() => handleSelect(slot)}
                  disabled={completed || !slot.available}
                  className={cn(
                    'flex flex-col items-center py-3 px-2 rounded-xl',
                    'transition-all duration-150',
                    'min-h-[44px]',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : slot.available
                        ? 'bg-muted/50 hover:bg-muted text-foreground'
                        : 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed',
                    completed && 'cursor-default'
                  )}
                >
                  <span className="text-sm font-medium">{slot.time}</span>
                  {!slot.available && (
                    <span className="text-[10px] mt-0.5">Unavailable</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selection indicator */}
      {selectedId && !completed && (
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-border/50 text-sm text-primary">
          <Clock className="h-4 w-4" />
          <span>{slots.find((s) => s.id === selectedId)?.time}</span>
        </div>
      )}
    </div>
  )
}
