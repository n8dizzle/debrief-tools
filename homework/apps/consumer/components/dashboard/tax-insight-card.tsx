"use client"

import { AlertCircle, ArrowRight, Lightbulb, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface TaxInsightCardProps {
  taxAssessedValue?: number
  estimatedValue?: number
  taxAnnualAmount?: number
  county?: string
}

export function TaxInsightCard({
  taxAssessedValue,
  estimatedValue,
  taxAnnualAmount,
  county,
}: TaxInsightCardProps) {
  // Calculate if taxes might be worth protesting
  // If assessed value is more than 90% of estimated market value, it might be high
  const shouldShowProtest =
    taxAssessedValue && estimatedValue && taxAssessedValue > estimatedValue * 0.9

  // Calculate potential savings (rough estimate: 10-20% reduction is common)
  const potentialSavings =
    taxAnnualAmount && shouldShowProtest
      ? Math.round(taxAnnualAmount * 0.15)
      : null

  // Calculate the ratio
  const assessedRatio =
    taxAssessedValue && estimatedValue
      ? ((taxAssessedValue / estimatedValue) * 100).toFixed(0)
      : null

  if (!shouldShowProtest) {
    // Show a positive message if taxes look reasonable
    if (taxAssessedValue && estimatedValue) {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm text-green-900 dark:text-green-100">
                Your tax assessment looks fair
              </h3>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1 leading-relaxed">
                Your assessed value is{" "}
                <span className="font-medium">{assessedRatio}%</span> of the
                estimated market value, which is typical.
              </p>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm text-amber-900 dark:text-amber-100">
            Your property taxes might be worth protesting
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
            Your assessed value (
            <span className="font-medium">
              ${taxAssessedValue?.toLocaleString()}
            </span>
            ) is <span className="font-medium">{assessedRatio}%</span> of the
            estimated market value. Many homeowners in {county || "your area"}{" "}
            save{" "}
            <span className="font-medium">
              $500-2,000/year
            </span>{" "}
            by protesting.
          </p>

          {potentialSavings && (
            <div className="mt-3 p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/30">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Potential savings:</span> ~$
                {potentialSavings.toLocaleString()}/year if successful
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs bg-white dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              Learn how to protest
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Deadline typically in May
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
