"use client"

import Image from "next/image"
import { MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface HeroMapCardProps {
  formattedAddress: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  county?: string
  latitude?: number
  longitude?: number
  visible?: boolean
}

export function HeroMapCard({
  formattedAddress,
  street,
  city,
  state,
  postalCode,
  county,
  latitude,
  longitude,
  visible = true,
}: HeroMapCardProps) {
  // Generate Mapbox Static API URL with pin
  // Using satellite-streets style, zoom 17 to see house + lot + some street
  // Pin color: Brand Teal (#0D9488)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const hasCoordinates = latitude && longitude && mapboxToken

  const mapUrl = hasCoordinates
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+0D9488(${longitude},${latitude})/${longitude},${latitude},17,0/600x200@2x?access_token=${mapboxToken}`
    : null

  const displayStreet = street || formattedAddress.split(",")[0]
  const displayLocation = city && state ? `${city}, ${state} ${postalCode || ""}`.trim() : ""

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background overflow-hidden transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Map Image */}
      <div className="relative h-40 md:h-48 bg-muted">
        {mapUrl ? (
          <Image
            src={mapUrl}
            alt={`Map of ${formattedAddress}`}
            fill
            className="object-cover"
            unoptimized // Mapbox URLs are dynamic
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <MapPin className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Address overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 md:h-5 md:w-5 text-white/90 flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-white leading-tight">
                {displayStreet}
              </h1>
              {displayLocation && (
                <p className="text-xs md:text-sm text-white/80">{displayLocation}</p>
              )}
              {county && (
                <p className="text-[10px] md:text-xs text-white/60 mt-0.5">{county} County</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
