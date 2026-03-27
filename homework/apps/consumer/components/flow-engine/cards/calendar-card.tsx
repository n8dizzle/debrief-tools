'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarCardProps {
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  minDate?: Date
  maxDays?: number
  className?: string
}

export function CalendarCard({
  onSelect,
  completed = false,
  selectedValue,
  minDate = new Date(),
  maxDays = 14,
  className,
}: CalendarCardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(
    typeof selectedValue === 'string' ? selectedValue : null
  )

  // Generate available dates (next N days, excluding Sundays)
  const availableDates = useMemo(() => {
    const dates: Date[] = []
    const start = new Date(minDate)
    start.setHours(0, 0, 0, 0)

    // Start from tomorrow
    start.setDate(start.getDate() + 1)

    while (dates.length < maxDays) {
      // Skip Sundays
      if (start.getDay() !== 0) {
        dates.push(new Date(start))
      }
      start.setDate(start.getDate() + 1)
    }

    return dates
  }, [minDate, maxDays])

  const handleSelect = (date: Date) => {
    if (completed) return

    const dateStr = date.toISOString().split('T')[0]
    setSelectedDate(dateStr)

    const displayText = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })

    onSelect?.(dateStr, displayText)
  }

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const formatDayNumber = (date: Date) => {
    return date.getDate()
  }

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  // Group dates by week for display
  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < availableDates.length; i += 7) {
      result.push(availableDates.slice(i, i + 7))
    }
    return result
  }, [availableDates])

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-4',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30 bg-primary/5' : 'border-border',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          Select installation date
        </p>
        {selectedDate && (
          <span className="text-xs text-primary font-medium">
            {new Date(selectedDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Date grid */}
      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-2">
            {week.map((date) => {
              const dateStr = date.toISOString().split('T')[0]
              const isSelected = selectedDate === dateStr
              const isThisWeek = weekIndex === 0

              return (
                <button
                  key={dateStr}
                  onClick={() => handleSelect(date)}
                  disabled={completed}
                  className={cn(
                    'flex-1 flex flex-col items-center py-2 px-1 rounded-xl',
                    'transition-all duration-150',
                    'min-h-[60px]',
                    isSelected
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/20'
                      : 'bg-muted/50 hover:bg-muted text-foreground',
                    isThisWeek && !isSelected && 'border border-primary/20',
                    completed && 'cursor-default'
                  )}
                >
                  <span className={cn(
                    'text-[10px] uppercase tracking-wide',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {formatDayName(date)}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatDayNumber(date)}
                  </span>
                  <span className={cn(
                    'text-[10px]',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {formatMonth(date)}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selection confirmation */}
      {selectedDate && !completed && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4" />
          <span>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      )}
    </div>
  )
}
