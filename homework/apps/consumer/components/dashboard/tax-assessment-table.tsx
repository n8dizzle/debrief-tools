"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaxAssessment } from "@/lib/property-data-client"

interface TaxAssessmentTableProps {
  assessments?: TaxAssessment[]
  visible?: boolean
}

// Calculate YoY change percentage
function calculateYoYChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toLocaleString()}`
}

export function TaxAssessmentTable({
  assessments,
  visible = true,
}: TaxAssessmentTableProps) {
  // Need at least 1 year of data
  if (!assessments || assessments.length === 0) {
    return null
  }

  // Sort by year descending (most recent first)
  const sortedAssessments = [...assessments].sort((a, b) => b.year - a.year)

  // Calculate 5-year growth (or whatever span we have)
  const oldestValue = sortedAssessments[sortedAssessments.length - 1]?.totalValue
  const newestValue = sortedAssessments[0]?.totalValue
  const yearsSpan = sortedAssessments[0]?.year - sortedAssessments[sortedAssessments.length - 1]?.year

  let growthPercentage: number | null = null
  if (oldestValue && newestValue && oldestValue > 0) {
    growthPercentage = ((newestValue - oldestValue) / oldestValue) * 100
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background overflow-hidden transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          Tax Assessment History
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left font-medium text-muted-foreground px-3 md:px-4 py-2">Year</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">Total Value</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">Land</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">Improvements</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">YoY</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssessments.map((assessment, index) => {
              const previousYear = sortedAssessments[index + 1]
              const yoyChange = previousYear
                ? calculateYoYChange(assessment.totalValue, previousYear.totalValue)
                : null

              return (
                <tr
                  key={assessment.year}
                  className={cn(
                    "border-b border-border last:border-0 transition-all duration-300",
                    visible ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <td className="px-3 md:px-4 py-2 md:py-2.5 font-medium text-foreground">
                    {assessment.year}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5 text-foreground">
                    ${assessment.totalValue.toLocaleString()}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5 text-muted-foreground">
                    {assessment.landValue ? formatCurrency(assessment.landValue) : "—"}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5 text-muted-foreground">
                    {assessment.improvements ? formatCurrency(assessment.improvements) : "—"}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5">
                    {yoyChange !== null ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          yoyChange > 0
                            ? "text-green-600"
                            : yoyChange < 0
                            ? "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {yoyChange > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : yoyChange < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {yoyChange > 0 ? "+" : ""}
                        {yoyChange.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      {growthPercentage !== null && yearsSpan > 0 && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {yearsSpan}-Year Growth:{" "}
              <span
                className={cn(
                  growthPercentage > 0
                    ? "text-green-600"
                    : growthPercentage < 0
                    ? "text-red-600"
                    : ""
                )}
              >
                {growthPercentage > 0 ? "+" : ""}
                {growthPercentage.toFixed(1)}%
              </span>
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
