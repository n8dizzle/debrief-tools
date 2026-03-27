"use client"

import { useEffect, useMemo, useState } from "react"
import { MapPin, Shield } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { MapRevealPhase } from "./map-reveal-phase"
import { FactCascade, getTotalFactCount } from "./fact-cascade"
import { InsightCard } from "./insight-card"
import { ClaimHomeCta } from "./claim-home-cta"
import { useRevealPhases } from "@/hooks/use-reveal-phases"
import { getPrimaryInsight } from "@/lib/home/insights/insight-generator"
import type { PropertyData } from "@/lib/property-data-client"
import type { ParsedPlace } from "@/lib/places-client"

type PropertyRevealOrchestratorProps = {
  place: ParsedPlace | null
  propertyData: PropertyData | null
  mapUrl: string | null
  isDataReady: boolean
  isAuthenticated: boolean
}

export function PropertyRevealOrchestrator({
  place,
  propertyData,
  mapUrl,
  isDataReady,
  isAuthenticated,
}: PropertyRevealOrchestratorProps) {
  // Calculate total facts for animation timing
  const totalFacts = useMemo(() => getTotalFactCount(propertyData), [propertyData])

  // Get primary insight
  const insight = useMemo(() => getPrimaryInsight(propertyData), [propertyData])

  // Initialize reveal phases hook
  const {
    mapRevealed,
    insightRevealed,
    ctaRevealed,
    isFactVisible,
    getFactDelayClass,
    currentPhase,
  } = useRevealPhases({
    totalFacts,
    isDataReady,
    respectReducedMotion: true,
  })

  const address = place?.formattedAddress || "Selected address"

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-xl">
      {/* Map Phase */}
      <MapRevealPhase
        mapUrl={mapUrl}
        address={address}
        isRevealed={mapRevealed}
      />

      {/* Content Card overlapping map */}
      <div className="relative -mt-12 px-4 pb-6">
        <Card className="mx-auto max-w-[400px] rounded-3xl border border-border/70 bg-white/95 shadow-xl backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Found it</CardTitle>
            <CardDescription>Here&apos;s what we know about your home.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Address display */}
            <div className="flex items-start gap-2 rounded-2xl border border-border bg-secondary/70 px-4 py-3 text-sm text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="leading-relaxed">{address}</span>
            </div>

            {/* Property facts cascade */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" aria-hidden />
                What we know
              </div>
              <FactCascade
                propertyData={propertyData}
                isFactVisible={isFactVisible}
                getFactDelayClass={getFactDelayClass}
              />
            </div>

            {/* Insight card */}
            {insight && (
              <InsightCard insight={insight} isRevealed={insightRevealed} />
            )}
          </CardContent>

          <CardFooter>
            <ClaimHomeCta
              place={place}
              propertyData={propertyData}
              isRevealed={ctaRevealed}
              isAuthenticated={isAuthenticated}
            />
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
