"use client"

import { ArrowRight, Loader2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { storePendingHome, type PendingHomeData } from "@/lib/home/pending-home"
import { signInWithGoogle } from "@/lib/supabase/actions"
import type { PropertyData } from "@/lib/property-data-client"
import type { ParsedPlace } from "@/lib/places-client"

type ClaimHomeCtaProps = {
  place: ParsedPlace | null
  propertyData: PropertyData | null
  isRevealed: boolean
  isAuthenticated: boolean
  onClaimSuccess?: () => void
  className?: string
}

export function ClaimHomeCta({
  place,
  propertyData,
  isRevealed,
  isAuthenticated,
  onClaimSuccess,
  className,
}: ClaimHomeCtaProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleClaimHome = async () => {
    if (!place || !propertyData) return

    setIsLoading(true)

    // Store pending home data
    const pendingData: Omit<PendingHomeData, "createdAt"> = {
      placeId: place.placeId,
      formattedAddress: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      street: place.street,
      city: place.city,
      state: place.state,
      postalCode: place.postalCode,
      propertyData,
    }

    const stored = storePendingHome(pendingData)

    if (!stored) {
      console.error("[ClaimHomeCta] Failed to store pending home")
      setIsLoading(false)
      return
    }

    if (isAuthenticated) {
      // Already authenticated, go directly to claim page
      router.push("/claim-home")
    } else {
      // Need to authenticate first
      // The signInWithGoogle will redirect to Google, then back to /auth/callback
      // After auth, user will be redirected to /claim-home
      await signInWithGoogle("/claim-home")
    }
  }

  const handleNotMyPlace = () => {
    router.push("/")
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        isRevealed
          ? "animate-in fade-in zoom-in-95 duration-400"
          : "opacity-0",
        className
      )}
    >
      <Button
        size="lg"
        className="w-full justify-center rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={handleClaimHome}
        disabled={isLoading || !place || !propertyData}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="ml-2">Saving...</span>
          </>
        ) : (
          <>
            Claim this home
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
          </>
        )}
      </Button>

      <Button
        variant="ghost"
        size="lg"
        className="w-full justify-center rounded-xl text-base text-muted-foreground"
        onClick={handleNotMyPlace}
        disabled={isLoading}
      >
        Not my place — try again
      </Button>
    </div>
  )
}
