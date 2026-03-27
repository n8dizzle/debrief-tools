"use client"

import { Home, Calendar, Layers, Square, Bed, TreeDeciduous } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickSummaryProps {
  propertyType?: string
  yearBuilt?: number
  beds?: number
  baths?: number
  sqft?: number
  stories?: number
  lotSizeSqft?: number
  visible?: boolean
}

export function QuickSummary({
  propertyType,
  yearBuilt,
  beds,
  baths,
  sqft,
  stories,
  lotSizeSqft,
  visible = true,
}: QuickSummaryProps) {
  // Convert lot size to acres (43,560 sqft = 1 acre)
  const acreage = lotSizeSqft ? (lotSizeSqft / 43560).toFixed(2) : null

  // Build beds/baths display
  const bedsDisplay = beds !== undefined ? beds.toString() : "—"
  const bathsDisplay = baths !== undefined ? baths.toString() : "—"

  return (
    <div
      className={cn(
        "grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Type */}
      <StatCard
        icon={Home}
        label="Type"
        value={propertyType?.replace("Single Family", "Single Fam") || "—"}
        visible={visible}
        delay={0}
      />

      {/* Year Built */}
      <StatCard
        icon={Calendar}
        label="Built"
        value={yearBuilt ? `${yearBuilt}` : "—"}
        visible={visible}
        delay={50}
      />

      {/* Stories */}
      <StatCard
        icon={Layers}
        label="Stories"
        value={stories?.toString() || "—"}
        visible={visible}
        delay={100}
      />

      {/* Square Feet */}
      <StatCard
        icon={Square}
        label="Sq Ft"
        value={sqft ? sqft.toLocaleString() : "—"}
        visible={visible}
        delay={150}
      />

      {/* Beds/Baths */}
      <StatCard
        icon={Bed}
        label="Beds / Baths"
        value={`${bedsDisplay} / ${bathsDisplay}`}
        visible={visible}
        delay={200}
      />

      {/* Acreage */}
      <StatCard
        icon={TreeDeciduous}
        label="Acreage"
        value={acreage ? `${acreage} ac` : "—"}
        visible={visible}
        delay={250}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  visible,
  delay = 0,
}: {
  icon: React.ElementType
  label: string
  value: string
  visible: boolean
  delay?: number
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-2 md:p-3 flex flex-col items-center justify-between h-20 md:h-24 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Icon at top */}
      <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />

      {/* Value centered */}
      <p className="text-sm md:text-base font-semibold text-foreground leading-tight text-center">{value}</p>

      {/* Label at bottom */}
      <p className="text-[10px] md:text-xs text-muted-foreground text-center">{label}</p>
    </div>
  )
}
