"use client"

import { useState } from "react"
import { ArrowRight, Calendar, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/lib/supabase/actions"
import { cn } from "@/lib/utils"

interface AuthPromptProps {
  onSuccess?: () => void
  redirectTo?: string
  className?: string
}

export function AuthPrompt({ onSuccess, redirectTo = "/", className }: AuthPromptProps) {
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("preAuthPhase", "auth")
        sessionStorage.setItem("preAuthScrollY", window.scrollY.toString())
      }
      await signInWithGoogle(redirectTo)
    } catch (error) {
      console.error("Sign in error:", error)
      setIsSigningIn(false)
    }
  }

  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      <div className="w-full max-w-sm mx-auto">
        {/* Hero: Pros available - THE main focus */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-7 w-7 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-foreground mb-1">
            3 pros ready
          </p>
          <p className="text-primary font-medium flex items-center justify-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Available tomorrow
          </p>
        </div>

        {/* Simple CTA */}
        <p className="text-center text-sm text-muted-foreground mb-4">
          Sign in to see your pricing
        </p>

        <Button
          onClick={handleSignIn}
          size="lg"
          className="w-full rounded-xl"
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
      </div>
    </div>
  )
}
