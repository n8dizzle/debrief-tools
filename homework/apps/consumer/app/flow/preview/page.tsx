"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowRight,
  Calendar,
  Check,
  Home,
  Lock,
  MapPin,
  MessageCircle,
  Shield,
  Sparkles,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { signInWithGoogle } from "@/lib/supabase/actions"
import { createClient } from "@/lib/supabase/client"

const BENEFITS = [
  { icon: Check, label: "Exact prices, not ranges" },
  { icon: Star, label: "Top-rated, vetted contractors" },
  { icon: Calendar, label: "Book online, no sales calls" },
  { icon: Shield, label: "Guaranteed work" },
]

export default function PreviewPage() {
  const router = useRouter()
  const homeData = useFlowStore((s) => s.homeData)
  const userIntent = useFlowStore((s) => s.userIntent)

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (!homeData) {
      router.replace("/flow/address")
    }
  }, [homeData, router])

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsCheckingAuth(false)

      if (user) {
        router.push("/flow/agent")
      }
    }
    checkAuth()
  }, [router])

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle("/flow/agent")
    } catch (error) {
      console.error("Sign in error:", error)
      setIsSigningIn(false)
    }
  }

  if (!homeData || isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const shortAddress = homeData.street
    ? `${homeData.street}, ${homeData.city || ""}`
    : homeData.formattedAddress.split(",")[0]

  const propertyDetails = [
    homeData.sqft ? `${homeData.sqft.toLocaleString()} sq ft` : null,
    homeData.yearBuilt ? `Built ${homeData.yearBuilt}` : null,
    homeData.beds ? `${homeData.beds} bed` : null,
    homeData.baths ? `${homeData.baths} bath` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col items-center">
      {/* Context cards */}
      <div className="w-full max-w-xl space-y-3 mb-8">
        {/* User intent card */}
        {userIntent && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">You mentioned</p>
                <p className="text-sm text-foreground">{userIntent}</p>
              </div>
            </div>
          </div>
        )}

        {/* Home found card */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 shrink-0">
              <Home className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-primary font-medium">Home found</p>
                <Check className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">{shortAddress}</p>
              {propertyDetails && (
                <p className="text-xs text-muted-foreground mt-0.5">{propertyDetails}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="w-full max-w-xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          Step 2 of 3
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ready to see your pricing
        </h1>
        <p className="mb-8 text-muted-foreground">
          Sign in to get personalized quotes from vetted pros in your area.
        </p>

        {/* Pros available card */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">3 pros ready in your area</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Next available: Tomorrow
              </p>
            </div>
          </div>

          {/* Benefits grid */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            {BENEFITS.map((benefit) => (
              <div key={benefit.label} className="flex items-center gap-2 text-left">
                <benefit.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{benefit.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign in button */}
        <Button
          onClick={handleSignIn}
          size="lg"
          className="w-full rounded-xl mb-4"
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            "Signing in..."
          ) : (
            <>
              Continue with Google
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>

        {/* Privacy note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Your home profile will be saved automatically</span>
        </div>
      </div>

      {/* Trust section */}
      <div className="w-full max-w-xl mt-12 pt-8 border-t border-border">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Why sign in?</h2>
          <p className="text-sm text-muted-foreground">
            We need to verify you're a real homeowner to show you actual contractor pricing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Shield,
              title: "Protect your data",
              description: "We never share your info with contractors until you book.",
            },
            {
              icon: Star,
              title: "Save your progress",
              description: "Come back anytime to compare options or finish booking.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
