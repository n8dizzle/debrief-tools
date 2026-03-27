"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"

// Generate available time slots
const TIME_SLOTS = ["8:00 AM", "10:00 AM", "1:00 PM", "3:00 PM"]

// Days of the week
const DAYS = ["S", "M", "T", "W", "T", "F", "S"]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDateString(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00")
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

export default function SchedulePage() {
  const router = useRouter()

  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const setSchedule = useFlowStore((s) => s.setSchedule)
  const scheduledDate = useFlowStore((s) => s.scheduledDate)
  const scheduledTime = useFlowStore((s) => s.scheduledTime)

  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(scheduledDate)
  const [selectedTime, setSelectedTime] = useState<string | null>(scheduledTime)

  // Redirect if missing data
  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    } else if (!selectedTier) {
      router.replace("/flow/pricing")
    } else if (!selectedPro) {
      router.replace("/flow/pros")
    }
  }, [homeData, selectedTier, selectedPro, router])

  // Generate calendar data
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days: Array<{
      date: Date
      dateStr: string
      day: number
      available: boolean
      isToday: boolean
      isPast: boolean
      isRush: boolean
    }> = []

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i)
      const dateStr = formatDateString(date)
      const isPast = date < today
      const isToday = date.getTime() === today.getTime()

      // Make most future dates available (simplified demo logic)
      const dayOfWeek = date.getDay()
      const available = !isPast && !isToday && dayOfWeek !== 0 // Not past, not today, not Sunday

      // Rush fee for next-day
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isRush = date.getTime() === tomorrow.getTime()

      days.push({
        date,
        dateStr,
        day: i,
        available,
        isToday,
        isPast,
        isRush,
      })
    }

    return { days, firstDay, year, month }
  }, [currentMonth])

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedTime(null) // Reset time when date changes
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
  }

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      setSchedule(selectedDate, selectedTime)
      router.push("/flow/checkout")
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  if (!homeData || !selectedTier || !selectedPro) {
    return null
  }

  const monthYear = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  // Check if selected date is rush (tomorrow)
  const isRushDate = selectedDate && calendarData.days.find(d => d.dateStr === selectedDate)?.isRush

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          When should we install?
        </h1>
        <p className="text-muted-foreground">
          {selectedPro.name} · {selectedTier.brand} {selectedTier.productLine}
        </p>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-border bg-card p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-medium text-foreground">{monthYear}</span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((day, i) => (
            <div
              key={i}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for first week offset */}
          {Array.from({ length: calendarData.firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {calendarData.days.map(({ dateStr, day, available, isToday, isPast, isRush }) => (
            <button
              key={dateStr}
              onClick={() => available && handleDateSelect(dateStr)}
              disabled={!available}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-sm transition-colors relative",
                available && "hover:bg-primary/10",
                !available && "text-muted-foreground/40 cursor-not-allowed",
                isToday && "ring-1 ring-primary",
                selectedDate === dateStr && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {day}
              {isRush && available && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Rush (+$150)
          </span>
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="space-y-3">
          <p className="font-medium text-foreground">
            Selected: {formatDisplayDate(selectedDate)}
            {isRushDate && (
              <span className="ml-2 text-sm text-orange-500">+$150 rush fee</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">Available times:</p>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map((time) => (
              <button
                key={time}
                onClick={() => handleTimeSelect(time)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  selectedTime === time
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                )}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        className="w-full"
        size="lg"
        disabled={!selectedDate || !selectedTime}
      >
        Continue to checkout
      </Button>
    </div>
  )
}
