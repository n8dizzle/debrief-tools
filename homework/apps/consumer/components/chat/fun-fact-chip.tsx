"use client"

import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

interface FunFactChipProps {
  fact: string
  className?: string
}

/**
 * A delightful inline chip for displaying fun facts.
 * Uses the Warm Coral accent color to create a "moment of delight"
 * that stands out from regular chat content without interrupting flow.
 */
export function FunFactChip({ fact, className }: FunFactChipProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/50 p-4",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        className
      )}
    >
      {/* Subtle decorative accent */}
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-orange-100/50 blur-xl" />
      
      <div className="relative flex items-start gap-3">
        {/* Icon with coral accent */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
          <Lightbulb className="h-4 w-4 text-orange-500" />
        </div>
        
        {/* Content */}
        <div className="flex-1 pt-0.5">
          <p className="text-xs font-medium uppercase tracking-wider text-orange-600/80 mb-1">
            Did you know?
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {fact}
          </p>
        </div>
      </div>
    </div>
  )
}

// Fun facts organized by category
export const YEAR_BUILT_FACTS: Record<number, string> = {
  1994: "Your home was built the same year Forrest Gump won Best Picture.",
  1995: "Your home is the same age as Toy Story.",
  1996: "Your home debuted the same year as the Spice Girls.",
  1997: "Your home was built when Titanic hit theaters.",
  1998: "Your home is as old as Google.",
  1999: "Your home was built during the Y2K panic.",
  2000: "Built at the turn of the millennium.",
  2001: "Your home arrived the same year as the first iPod.",
  2002: "Your home swung in the same year as Spider-Man.",
  2003: "Your home was built the year Finding Nemo made us all cry.",
  2004: "Your home is the same age as Facebook.",
  2005: "Your home was born the same year as YouTube.",
}

export const HVAC_FACTS = [
  "Your AC doesn't create cold air — it removes heat from inside and dumps it outside.",
  "The average AC in Texas runs 2,000+ hours per year. That's quite a workout.",
  "Changing the thermostat temp doesn't change the air temp from the vent — it just changes how long the system runs.",
  "A typical HVAC install takes less than 8 hours. Some crews do two in a day.",
  "SEER ratings have doubled since the 90s — today's systems are way more efficient.",
  "Attics in Texas can hit 140°F in summer. Our pros are tough.",
]

/**
 * Get a fun fact based on property data, or a random HVAC fact
 */
export function getPropertyFunFact(yearBuilt?: number | null): string {
  if (yearBuilt && YEAR_BUILT_FACTS[yearBuilt]) {
    return YEAR_BUILT_FACTS[yearBuilt]
  }
  // Return a random HVAC fact
  return HVAC_FACTS[Math.floor(Math.random() * HVAC_FACTS.length)]
}

