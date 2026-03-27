"use client"

import { TrendingUp, DollarSign, Calendar, PieChart, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaxAssessment, TaxHistory } from "@/lib/property-data-client"

interface KeyInsightsProps {
  taxAssessments?: TaxAssessment[]
  taxHistory?: TaxHistory[]
  sqft?: number
  taxAssessedValue?: number
  hoaAnnual?: number // Annual HOA fee
  yearBuilt?: number
  visible?: boolean
}

interface InsightItem {
  icon: React.ElementType
  label: string
  value: string
  subtext?: string
}

export function KeyInsights({
  taxAssessments,
  taxHistory,
  sqft,
  taxAssessedValue,
  hoaAnnual,
  yearBuilt,
  visible = true,
}: KeyInsightsProps) {
  const insights: InsightItem[] = []

  // Property age
  if (yearBuilt) {
    const currentYear = new Date().getFullYear()
    const age = currentYear - yearBuilt
    insights.push({
      icon: Clock,
      label: "Property Age",
      value: `${age} years`,
      subtext: `Built ${yearBuilt}`,
    })
  }

  // Calculate 5-year growth from tax assessments
  if (taxAssessments && taxAssessments.length >= 2) {
    const sorted = [...taxAssessments].sort((a, b) => b.year - a.year)
    const newestValue = sorted[0]?.totalValue
    const oldestValue = sorted[sorted.length - 1]?.totalValue
    const yearsSpan = sorted[0]?.year - sorted[sorted.length - 1]?.year

    if (newestValue && oldestValue && oldestValue > 0) {
      const growth = ((newestValue - oldestValue) / oldestValue) * 100
      insights.push({
        icon: TrendingUp,
        label: `${yearsSpan}-Year Growth`,
        value: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`,
        subtext: `${sorted[sorted.length - 1]?.year}-${sorted[0]?.year}`,
      })
    }
  }

  // Price per square foot
  if (taxAssessedValue && sqft && sqft > 0) {
    const pricePerSqft = taxAssessedValue / sqft
    insights.push({
      icon: DollarSign,
      label: "Price / Sq Ft",
      value: `$${pricePerSqft.toFixed(0)}`,
      subtext: "Assessed",
    })
  }

  // Monthly cost estimate (taxes + HOA)
  if (taxHistory && taxHistory.length > 0) {
    const sorted = [...taxHistory].sort((a, b) => b.year - a.year)
    const latestTax = sorted[0]?.amount
    if (latestTax) {
      const monthlyTax = latestTax / 12
      const monthlyHoa = hoaAnnual ? hoaAnnual / 12 : 0
      const totalMonthly = monthlyTax + monthlyHoa

      insights.push({
        icon: Calendar,
        label: "Monthly Cost",
        value: `$${Math.round(totalMonthly).toLocaleString()}`,
        subtext: hoaAnnual ? "Tax + HOA" : `Tax (${sorted[0]?.year})`,
      })
    }
  }

  // Land vs Improvements ratio
  if (taxAssessments && taxAssessments.length > 0) {
    const sorted = [...taxAssessments].sort((a, b) => b.year - a.year)
    const latest = sorted[0]
    if (latest?.landValue && latest?.totalValue && latest.totalValue > 0) {
      const landPercent = (latest.landValue / latest.totalValue) * 100
      const improvPercent = 100 - landPercent
      insights.push({
        icon: PieChart,
        label: "Land / Improvements",
        value: `${landPercent.toFixed(0)}% / ${improvPercent.toFixed(0)}%`,
        subtext: "Value split",
      })
    }
  }

  // Don't render if no insights
  if (insights.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <h3 className="text-sm font-medium text-foreground mb-4">
        Key Insights & Metrics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {insights.map((insight, index) => {
          const Icon = insight.icon
          return (
            <div
              key={insight.label}
              className={cn(
                "text-center transition-all duration-300",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              )}
              style={{ transitionDelay: `${index * 75}ms` }}
            >
              <Icon className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1.5 md:mb-2 text-muted-foreground" />
              <p className="text-base md:text-lg font-semibold text-foreground">{insight.value}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{insight.label}</p>
              {insight.subtext && (
                <p className="text-[10px] md:text-xs text-muted-foreground/70">{insight.subtext}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
