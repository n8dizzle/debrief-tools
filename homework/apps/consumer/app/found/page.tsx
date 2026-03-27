"use client"

import Image from "next/image"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PropertyRevealOrchestrator } from "@/components/home/property-reveal/property-reveal-orchestrator"
import {
  createPlacesClients,
  fetchPlaceDetails,
  loadGooglePlacesApi,
  type ParsedPlace,
} from "@/lib/places-client"
import { getPropertyData } from "@/lib/property-data-server"
import type { PropertyData } from "@/lib/property-data-client"
import { getUser } from "@/lib/supabase/actions"

type LoadState = {
  isLoading: boolean
  error?: string
}

const buildStaticMapUrl = (latitude: number, longitude: number, token?: string) => {
  if (!token) return null
  // Zoom 18 is closer (street-level view)
  const center = `${longitude},${latitude},18`
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${center}/800x600@2x?access_token=${token}`
}

const PlaceholderShell = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-72 w-full rounded-3xl bg-muted" />
    <div className="rounded-3xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-4 h-5 w-28 rounded-full bg-muted" />
      <div className="h-4 w-48 rounded-full bg-muted" />
      <div className="mt-4 h-14 w-full rounded-2xl bg-muted" />
    </div>
  </div>
)

function FoundPageContent() {
  const searchParams = useSearchParams()
  const placeId = searchParams.get("placeId") ?? ""
  const addressFromQuery = searchParams.get("address") ?? ""
  const latFromQuery = searchParams.get("lat")
  const lngFromQuery = searchParams.get("lng")

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const [place, setPlace] = useState<ParsedPlace | null>(null)
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>(() => {
    if (!placeId)
      return { isLoading: false, error: "Missing place id. Start again." }
    if (!googleApiKey) {
      return {
        isLoading: false,
        error: "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to confirm this address.",
      }
    }
    return { isLoading: true }
  })

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const user = await getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [])

  // Fetch place details and property data
  useEffect(() => {
    let cancelled = false
    if (!placeId || !googleApiKey) return () => {}

    loadGooglePlacesApi(googleApiKey)
      .then((google) => fetchPlaceDetails(createPlacesClients(google), placeId))
      .then(async (details) => {
        if (cancelled) return
        setPlace(details)

        // Fetch property data using the formatted address
        console.log("[FoundPage] Fetching property data for:", details.formattedAddress)
        const propData = await getPropertyData(details.formattedAddress)
        if (!cancelled) {
          setPropertyData(propData)
          setLoadState({ isLoading: false })
        }
      })
      .catch((error) => {
        if (cancelled) return
        // Fallback to query params if place details fail
        setPlace(
          latFromQuery && lngFromQuery
            ? {
                placeId,
                formattedAddress: addressFromQuery || "Selected address",
                latitude: Number.parseFloat(latFromQuery),
                longitude: Number.parseFloat(lngFromQuery),
              }
            : null
        )
        setLoadState({
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "We could not confirm this address.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [addressFromQuery, googleApiKey, latFromQuery, lngFromQuery, placeId])

  const mapUrl = useMemo(
    () =>
      place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
        ? buildStaticMapUrl(place.latitude, place.longitude, mapboxToken)
        : null,
    [mapboxToken, place]
  )

  const isDataReady = !loadState.isLoading && !loadState.error && !!propertyData

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="flex items-center justify-between text-sm text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Home
          </Link>
          <Image
            src="/logo.svg"
            alt="homework"
            width={100}
            height={20}
            className="h-5 w-auto"
          />
          <span className="invisible">placeholder</span>
        </header>

        {/* Main content */}
        {loadState.isLoading ? (
          <PlaceholderShell />
        ) : loadState.error ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-destructive">{loadState.error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Try again
            </Link>
          </div>
        ) : (
          <PropertyRevealOrchestrator
            place={place}
            propertyData={propertyData}
            mapUrl={mapUrl}
            isDataReady={isDataReady}
            isAuthenticated={isAuthenticated}
          />
        )}
      </div>
    </div>
  )
}

export default function FoundPage() {
  return (
    <Suspense fallback={<PlaceholderShell />}>
      <FoundPageContent />
    </Suspense>
  )
}
