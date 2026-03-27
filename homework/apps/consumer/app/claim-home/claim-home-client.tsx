"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Home, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import Image from "next/image"

import { createHome } from "@/lib/home/actions"
import {
  getPendingHome,
  clearPendingHome,
  getScannedEquipment,
  clearScannedEquipment,
} from "@/lib/home/pending-home"

type ClaimStatus = "loading" | "creating" | "success" | "error" | "no-data"

export function ClaimHomeClient() {
  const router = useRouter()
  const [status, setStatus] = useState<ClaimStatus>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [homeAddress, setHomeAddress] = useState<string | null>(null)

  useEffect(() => {
    const claimHome = async () => {
      // Get pending home data from sessionStorage
      const pending = getPendingHome()

      if (!pending) {
        console.log("[ClaimHome] No pending home data found")
        setStatus("no-data")
        // Give user a moment to see the message, then redirect
        setTimeout(() => router.replace("/"), 2000)
        return
      }

      setHomeAddress(pending.formattedAddress)
      setStatus("creating")

      try {
        const result = await createHome({
          placeId: pending.placeId,
          formattedAddress: pending.formattedAddress,
          latitude: pending.latitude,
          longitude: pending.longitude,
          street: pending.street,
          city: pending.city ?? "",
          state: pending.state ?? "",
          postalCode: pending.postalCode ?? "",
          propertyData: pending.propertyData,
        })

        if (result.error) {
          console.error("[ClaimHome] Error creating home:", result.error)
          setErrorMessage(result.error)
          setStatus("error")
          return
        }

        console.log("[ClaimHome] Home created successfully:", result.home?.id)

        // Clear pending data
        clearPendingHome()
        clearScannedEquipment()

        setStatus("success")

        // Short delay to show success, then redirect with welcome flag
        setTimeout(() => {
          router.replace("/dashboard?welcome=true")
        }, 1500)
      } catch (error) {
        console.error("[ClaimHome] Unexpected error:", error)
        setErrorMessage("Something went wrong. Please try again.")
        setStatus("error")
      }
    }

    claimHome()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo */}
          <Image
            src="/logo.svg"
            alt="homework"
            width={120}
            height={24}
            className="h-6 w-auto"
          />

          {/* Status display */}
          <div className="w-full rounded-3xl border border-border bg-white p-8 shadow-lg">
            {status === "loading" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Preparing your home
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Just a moment...
                  </p>
                </div>
              </div>
            )}

            {status === "creating" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Home className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Setting up your HomeFit
                  </h2>
                  {homeAddress && (
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                      {homeAddress}
                    </p>
                  )}
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Welcome home
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Taking you to your dashboard...
                  </p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Something went wrong
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {errorMessage || "Please try again."}
                  </p>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Start over
                </button>
              </div>
            )}

            {status === "no-data" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <Home className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    No home to claim
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Redirecting you to start fresh...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
