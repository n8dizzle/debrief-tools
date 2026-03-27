"use client"

import { useState, useEffect } from "react"
import { Home } from "lucide-react"
import type { HomeData } from "@/types/flow"
import type { PropertyData } from "@/lib/property-data-client"

// New modular components
import { HeroMapCard } from "./hero-map-card"
import { QuickSummary } from "./quick-summary"
import { FeaturesAmenities } from "./features-amenities"
import { TaxAssessmentTable } from "./tax-assessment-table"
import { AnnualTaxesTable } from "./annual-taxes-table"
import { KeyInsights } from "./key-insights"
import { LegalInfo } from "./legal-info"

interface HomeDataRevealProps {
  homeData: HomeData | null
  propertyData: PropertyData | null
  isLoading: boolean
}

export function HomeDataReveal({ homeData, propertyData, isLoading }: HomeDataRevealProps) {
  const [revealStage, setRevealStage] = useState(0)

  // Cascading reveal animation - simpler staged approach
  useEffect(() => {
    if (!isLoading && propertyData) {
      const stages = 6 // Total reveal stages
      let current = 0
      const interval = setInterval(() => {
        current++
        setRevealStage(current)
        if (current >= stages) {
          clearInterval(interval)
        }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [isLoading, propertyData])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  // No data state
  if (!homeData) {
    return (
      <div className="text-center py-12">
        <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">No home data yet</h2>
        <p className="text-sm text-muted-foreground">
          Start by entering your address on the homepage
        </p>
      </div>
    )
  }

  const data: Partial<PropertyData> = propertyData || {}

  // Helper to convert null to undefined (HomeData uses null, components use undefined)
  const nullToUndef = <T,>(val: T | null | undefined): T | undefined =>
    val === null ? undefined : val

  return (
    <div className="space-y-4">
      {/* Stage 1: Hero Map Card with Address */}
      <HeroMapCard
        formattedAddress={homeData.formattedAddress}
        street={homeData.street}
        city={homeData.city ?? data.city}
        state={homeData.state ?? data.state}
        postalCode={homeData.postalCode ?? data.zipCode}
        county={data.county}
        latitude={data.latitude}
        longitude={data.longitude}
        visible={revealStage >= 1}
      />

      {/* Stage 2: Quick Summary (6 individual cards) */}
      <QuickSummary
        propertyType={data.propertyType}
        yearBuilt={data.yearBuilt ?? nullToUndef(homeData.yearBuilt)}
        beds={data.beds ?? nullToUndef(homeData.beds)}
        baths={data.baths ?? nullToUndef(homeData.baths)}
        sqft={data.sqft ?? nullToUndef(homeData.sqft)}
        stories={data.stories ?? nullToUndef(homeData.stories)}
        lotSizeSqft={data.lotSizeSqft ?? nullToUndef(homeData.lotSizeSqft)}
        visible={revealStage >= 2}
      />

      {/* Stage 3: Key Insights & Metrics (moved up) */}
      <KeyInsights
        taxAssessments={data.taxAssessments}
        taxHistory={data.taxHistory}
        sqft={data.sqft ?? nullToUndef(homeData.sqft)}
        taxAssessedValue={data.taxAssessedValue}
        yearBuilt={data.yearBuilt ?? nullToUndef(homeData.yearBuilt)}
        visible={revealStage >= 3}
      />

      {/* Stage 4: Features & Amenities (checkmarks) */}
      <FeaturesAmenities
        pool={data.pool}
        fireplace={data.fireplace}
        garageSpaces={data.garageSpaces}
        garageType={data.garageType}
        coolingType={data.coolingType}
        heatingType={data.heatingType}
        basement={data.basement}
        attic={data.attic}
        stories={data.stories ?? nullToUndef(homeData.stories)}
        visible={revealStage >= 4}
      />

      {/* Stage 5: Tax Assessment History Table */}
      <TaxAssessmentTable
        assessments={data.taxAssessments}
        visible={revealStage >= 5}
      />

      {/* Stage 6: Annual Property Taxes Table */}
      <AnnualTaxesTable
        taxHistory={data.taxHistory}
        visible={revealStage >= 6}
      />

      {/* Stage 6: Legal & Subdivision */}
      <LegalInfo
        apn={data.apn}
        assessorId={data.assessorId}
        subdivision={data.subdivision}
        legalDescription={data.legalDescription}
        visible={revealStage >= 6}
      />
    </div>
  )
}
