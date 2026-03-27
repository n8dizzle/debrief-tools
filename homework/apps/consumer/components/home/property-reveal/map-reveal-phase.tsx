"use client"

import Image from "next/image"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

type MapRevealPhaseProps = {
  mapUrl: string | null
  address: string
  isRevealed: boolean
  className?: string
}

export function MapRevealPhase({
  mapUrl,
  address,
  isRevealed,
  className,
}: MapRevealPhaseProps) {
  return (
    <div
      className={cn(
        "relative h-72 w-full overflow-hidden rounded-t-[32px] bg-muted",
        // Animation
        isRevealed
          ? "animate-in fade-in zoom-in-95 duration-700"
          : "opacity-0 scale-95",
        className
      )}
    >
      {mapUrl ? (
        <Image
          src={mapUrl}
          alt={`Satellite view of ${address}`}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-muted-foreground">
          Map preview unavailable
        </div>
      )}

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/35" />

      {/* Pin marker */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "flex flex-col items-center gap-2",
            isRevealed
              ? "animate-in fade-in slide-in-from-top-4 duration-500 delay-300"
              : "opacity-0"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg ring-2 ring-white/80">
            <MapPin className="h-5 w-5 text-primary-foreground" aria-hidden />
          </div>
          {/* Pin shadow/drop indicator */}
          <div className="h-1 w-6 rounded-full bg-black/20 blur-sm" />
        </div>
      </div>
    </div>
  )
}
