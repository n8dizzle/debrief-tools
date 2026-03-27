"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api"
import { Check, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddressMapProps {
  latitude: number
  longitude: number
  address: string
  onMapReady?: () => void
  className?: string
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

const FINAL_ZOOM = 18

export function AddressMap({
  latitude,
  longitude,
  address,
  onMapReady,
  className,
}: AddressMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  })

  const [showContent, setShowContent] = useState(false)
  const hasCalledReady = useRef(false)

  const center = { lat: latitude, lng: longitude }

  // Trigger fade-in and callback after map loads
  const onMapLoad = useCallback(() => {
    // Small delay for map tiles to render, then fade in
    setTimeout(() => {
      setShowContent(true)
      if (!hasCalledReady.current) {
        hasCalledReady.current = true
        onMapReady?.()
      }
    }, 300)
  }, [onMapReady])

  if (loadError) {
    return (
      <div className={cn("rounded-xl bg-muted flex items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">Unable to load map</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={cn("rounded-xl bg-muted animate-pulse", className)} />
    )
  }

  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden transition-opacity duration-500",
      showContent ? "opacity-100" : "opacity-0",
      className
    )}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={FINAL_ZOOM}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "none",
          mapTypeId: "satellite",
        }}
      />

      {/* Pin overlay - coral for visibility on satellite */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <MapPin
            className="h-8 w-8 drop-shadow-lg"
            style={{ color: '#f97316' }}
            fill="currentColor"
          />
          <div
            className="absolute -top-1 -right-1 rounded-full p-0.5"
            style={{ backgroundColor: '#f97316' }}
          >
            <Check className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>

      {/* Address confirmation overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent p-3 pt-6">
        <div className="flex items-start gap-2">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Address confirmed</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{address}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
