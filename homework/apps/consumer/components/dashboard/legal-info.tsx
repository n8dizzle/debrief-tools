"use client"

import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface LegalInfoProps {
  apn?: string
  assessorId?: string
  subdivision?: string
  legalDescription?: string
  visible?: boolean
}

export function LegalInfo({
  apn,
  assessorId,
  subdivision,
  legalDescription,
  visible = true,
}: LegalInfoProps) {
  // Don't render if no data
  if (!apn && !assessorId && !subdivision) {
    return null
  }

  const displayApn = apn || assessorId

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        Legal & Subdivision
      </h3>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 md:gap-x-8 text-xs md:text-sm text-muted-foreground">
        {displayApn && (
          <span className="whitespace-nowrap">
            <span className="font-medium text-foreground">APN:</span> {displayApn}
          </span>
        )}
        {subdivision && (
          <span className="whitespace-nowrap">
            <span className="font-medium text-foreground">Subdivision:</span> {subdivision}
          </span>
        )}
      </div>
    </div>
  )
}
