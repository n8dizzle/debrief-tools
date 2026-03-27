"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeaturesAmenitiesProps {
  pool?: boolean
  fireplace?: boolean
  garageSpaces?: number
  garageType?: string
  coolingType?: string
  heatingType?: string
  basement?: boolean
  attic?: boolean
  stories?: number
  visible?: boolean
}

interface FeatureItem {
  label: string
  available: boolean
}

export function FeaturesAmenities({
  pool,
  fireplace,
  garageSpaces,
  garageType,
  coolingType,
  heatingType,
  basement,
  attic,
  stories,
  visible = true,
}: FeaturesAmenitiesProps) {
  // Build list of features with availability status
  const features: FeatureItem[] = []

  // Pool
  if (pool !== undefined) {
    features.push({ label: "Pool", available: pool })
  }

  // Garage
  if (garageSpaces !== undefined && garageSpaces > 0) {
    features.push({
      label: `${garageSpaces}-Car ${garageType || "Garage"}`,
      available: true,
    })
  }

  // Cooling
  if (coolingType) {
    features.push({
      label: `${coolingType} A/C`,
      available: true,
    })
  }

  // Heating
  if (heatingType) {
    features.push({
      label: `${heatingType} Heat`,
      available: true,
    })
  }

  // Fireplace
  if (fireplace !== undefined) {
    features.push({ label: "Fireplace", available: fireplace })
  }

  // Basement
  if (basement !== undefined) {
    features.push({ label: "Basement", available: basement })
  }

  // Attic
  if (attic !== undefined) {
    features.push({ label: "Attic", available: attic })
  }

  // Multi-story
  if (stories !== undefined && stories > 1) {
    features.push({ label: `${stories} Stories`, available: true })
  }

  // Only show available features (like Rentcast report)
  // Limit to max 6 features to keep them on one line
  const availableFeatures = features.filter((f) => f.available).slice(0, 6)

  // Don't render if no features available
  if (availableFeatures.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <h3 className="text-sm font-medium text-foreground mb-3">
        Features & Amenities
      </h3>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 md:gap-x-8">
        {availableFeatures.map((feature, index) => (
          <div
            key={feature.label}
            className={cn(
              "flex items-center gap-1.5 md:gap-2 text-xs md:text-sm transition-all duration-300 whitespace-nowrap",
              visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
            )}
            style={{ transitionDelay: `${index * 50}ms` }}
          >
            <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary flex-shrink-0" />
            <span className="text-foreground">{feature.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
