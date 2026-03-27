"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export type PropertyFact = {
  label: string
  value: string
  icon?: ReactNode
  category: "core" | "systems" | "amenities"
}

type AnimatedFactChipProps = {
  fact: PropertyFact
  isVisible: boolean
  delayClass?: string
  className?: string
}

export function AnimatedFactChip({
  fact,
  isVisible,
  delayClass = "",
  className,
}: AnimatedFactChipProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-3 py-4 text-center text-sm shadow-xs",
        // Animation classes
        isVisible
          ? "animate-in fade-in slide-in-from-bottom-4 duration-400 fill-mode-forwards"
          : "opacity-0",
        delayClass,
        className
      )}
    >
      {fact.icon && (
        <div className="flex h-5 w-5 items-center justify-center text-primary">
          {fact.icon}
        </div>
      )}
      {!fact.icon && <div className="h-5" />}
      <div className="text-lg font-semibold text-foreground">{fact.value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {fact.label}
      </div>
    </div>
  )
}

/**
 * Amenity badge variant for boolean features like Pool, Fireplace
 */
type AmenityBadgeProps = {
  label: string
  icon: ReactNode
  isVisible: boolean
  delayClass?: string
}

export function AmenityBadge({ label, icon, isVisible, delayClass = "" }: AmenityBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm shadow-xs",
        isVisible
          ? "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-forwards"
          : "opacity-0",
        delayClass
      )}
    >
      <span className="text-primary">{icon}</span>
      <span className="font-medium text-foreground">{label}</span>
    </div>
  )
}
