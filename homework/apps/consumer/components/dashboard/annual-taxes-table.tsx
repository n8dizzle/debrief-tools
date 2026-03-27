"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaxHistory } from "@/lib/property-data-client"

interface AnnualTaxesTableProps {
  taxHistory?: TaxHistory[]
  visible?: boolean
}

// Calculate YoY change percentage
function calculateYoYChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function AnnualTaxesTable({
  taxHistory,
  visible = true,
}: AnnualTaxesTableProps) {
  // Need at least 1 year of data
  if (!taxHistory || taxHistory.length === 0) {
    return null
  }

  // Sort by year descending (most recent first)
  const sortedHistory = [...taxHistory].sort((a, b) => b.year - a.year)

  // Calculate tax trend
  const oldestAmount = sortedHistory[sortedHistory.length - 1]?.amount
  const newestAmount = sortedHistory[0]?.amount
  const yearsSpan = sortedHistory[0]?.year - sortedHistory[sortedHistory.length - 1]?.year

  let taxTrend: number | null = null
  if (oldestAmount && newestAmount && oldestAmount > 0) {
    taxTrend = ((newestAmount - oldestAmount) / oldestAmount) * 100
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
          Annual Property Taxes
        </h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left font-medium text-muted-foreground px-3 md:px-4 py-2">Year</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">Tax Amount</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">Tax Rate</th>
              <th className="text-right font-medium text-muted-foreground px-3 md:px-4 py-2">YoY</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.map((entry, index) => {
              const previousYear = sortedHistory[index + 1]
              const yoyChange = previousYear
                ? calculateYoYChange(entry.amount, previousYear.amount)
                : null

              return (
                <tr
                  key={entry.year}
                  className={cn(
                    "border-b border-border last:border-0 transition-all duration-300",
                    visible ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <td className="px-3 md:px-4 py-2 md:py-2.5 font-medium text-foreground">
                    {entry.year}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5 text-foreground">
                    ${entry.amount.toLocaleString()}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5 text-muted-foreground">
                    {entry.rate ? `${(entry.rate * 100).toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right px-3 md:px-4 py-2 md:py-2.5">
                    {yoyChange !== null ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          // For taxes, lower is better so colors are inverted
                          yoyChange < 0
                            ? "text-green-600"
                            : yoyChange > 0
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
      {taxTrend !== null && yearsSpan > 0 && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Tax Trend:{" "}
              <span
                className={cn(
                  taxTrend < 0
                    ? "text-green-600"
                    : taxTrend > 0
                    ? "text-red-600"
                    : ""
                )}
              >
                {taxTrend > 0 ? "Increased" : taxTrend < 0 ? "Decreased" : "Unchanged"}{" "}
                {Math.abs(taxTrend).toFixed(1)}% from {sortedHistory[sortedHistory.length - 1]?.year}
              </span>
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
