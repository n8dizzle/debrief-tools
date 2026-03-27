"use client"

import {
  Bath,
  BedDouble,
  Calendar,
  Car,
  Droplets,
  Flame,
  Home,
  Layers,
  Ruler,
  Snowflake,
  Thermometer,
  Trees,
} from "lucide-react"
import { useMemo } from "react"

import { AnimatedFactChip, AmenityBadge, type PropertyFact } from "./animated-fact-chip"
import type { PropertyData } from "@/lib/property-data-client"

type FactCascadeProps = {
  propertyData: PropertyData | null
  isFactVisible: (index: number) => boolean
  getFactDelayClass: (index: number) => string
}

/**
 * Builds an enhanced list of property facts from PropertyData
 * Includes core facts, systems, and amenities
 */
function buildEnhancedFacts(data: PropertyData | null): {
  facts: PropertyFact[]
  amenities: { label: string; icon: React.ReactNode }[]
} {
  if (!data) return { facts: [], amenities: [] }

  const facts: PropertyFact[] = []
  const amenities: { label: string; icon: React.ReactNode }[] = []

  // Core facts (priority order matches design: Built, Sq Ft, Stories, Acres, Beds, Baths)
  if (data.yearBuilt !== undefined && data.yearBuilt !== null) {
    facts.push({
      label: "Built",
      value: data.yearBuilt.toString(),
      icon: <Calendar className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  if (data.sqft !== undefined && data.sqft !== null) {
    facts.push({
      label: "Sq Ft",
      value: data.sqft.toLocaleString(),
      icon: <Ruler className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  if (data.stories !== undefined && data.stories !== null) {
    facts.push({
      label: "Stories",
      value: data.stories.toString(),
      icon: <Layers className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  if (data.lotSizeSqft !== undefined && data.lotSizeSqft !== null) {
    const acres = (data.lotSizeSqft / 43560).toFixed(2)
    facts.push({
      label: "Acres",
      value: acres,
      icon: <Trees className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  if (data.beds !== undefined && data.beds !== null) {
    facts.push({
      label: "Beds",
      value: data.beds.toString(),
      icon: <BedDouble className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  if (data.baths !== undefined && data.baths !== null) {
    facts.push({
      label: "Baths",
      value: data.baths.toString(),
      icon: <Bath className="h-4 w-4" aria-hidden />,
      category: "core",
    })
  }

  // Amenities (show as badges below the main grid)
  if (data.pool) {
    amenities.push({
      label: "Pool",
      icon: <Droplets className="h-4 w-4" aria-hidden />,
    })
  }

  if (data.fireplace) {
    amenities.push({
      label: "Fireplace",
      icon: <Flame className="h-4 w-4" aria-hidden />,
    })
  }

  if (data.basement) {
    amenities.push({
      label: "Basement",
      icon: <Home className="h-4 w-4" aria-hidden />,
    })
  }

  return { facts, amenities }
}

function formatHeatingType(type: string): string {
  const typeMap: Record<string, string> = {
    forced_air: "Forced Air",
    "forced air": "Forced Air",
    central: "Central",
    radiant: "Radiant",
    baseboard: "Baseboard",
    heat_pump: "Heat Pump",
    "heat pump": "Heat Pump",
    boiler: "Boiler",
    furnace: "Furnace",
    gas: "Gas",
    electric: "Electric",
  }
  return typeMap[type.toLowerCase()] || type
}

function formatCoolingType(type: string): string {
  const typeMap: Record<string, string> = {
    central: "Central AC",
    "central air": "Central AC",
    central_air: "Central AC",
    window: "Window",
    heat_pump: "Heat Pump",
    "heat pump": "Heat Pump",
    evaporative: "Evap",
    mini_split: "Mini Split",
    "mini split": "Mini Split",
  }
  return typeMap[type.toLowerCase()] || type
}

export function FactCascade({
  propertyData,
  isFactVisible,
  getFactDelayClass,
}: FactCascadeProps) {
  const { facts, amenities } = useMemo(
    () => buildEnhancedFacts(propertyData),
    [propertyData]
  )

  if (facts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Property data loading...
      </div>
    )
  }

  const totalFactsAndAmenities = facts.length + amenities.length

  return (
    <div className="space-y-4">
      {/* Main facts grid */}
      <div className="grid grid-cols-3 gap-3">
        {facts.map((fact, index) => (
          <AnimatedFactChip
            key={fact.label}
            fact={fact}
            isVisible={isFactVisible(index)}
            delayClass={getFactDelayClass(index)}
          />
        ))}
      </div>

      {/* Amenities row */}
      {amenities.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {amenities.map((amenity, index) => {
            const globalIndex = facts.length + index
            return (
              <AmenityBadge
                key={amenity.label}
                label={amenity.label}
                icon={amenity.icon}
                isVisible={isFactVisible(globalIndex)}
                delayClass={getFactDelayClass(globalIndex)}
              />
            )
          })}
        </div>
      )}

      {/* Sample data indicator */}
      {propertyData?.source === "mock" && (
        <p className="text-center text-xs text-muted-foreground/70">
          Sample data for demonstration
        </p>
      )}
    </div>
  )
}

/**
 * Get total number of facts + amenities for animation orchestration
 */
export function getTotalFactCount(data: PropertyData | null): number {
  const { facts, amenities } = buildEnhancedFacts(data)
  return facts.length + amenities.length
}
