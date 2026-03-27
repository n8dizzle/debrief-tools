"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import {
  Check,
  ChevronRight,
  Droplets,
  Flame,
  Sparkles,
  ThermometerSun,
  X,
  Zap,
} from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { useFlowStore, useFlowPhase } from "@/lib/flow-state"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/lib/supabase/actions"

// Flow section components
import { ContextCards } from "@/components/flow/context-cards"
import { PricingSection } from "@/components/flow/pricing-section"
import { ProsSection } from "@/components/flow/pros-section"
import { AddonsSection } from "@/components/flow/addons-section"
import { ScheduleSection } from "@/components/flow/schedule-section"
import { ContactSection } from "@/components/flow/contact-section"
import { CheckoutSection } from "@/components/flow/checkout-section"
import { ProgressIndicator } from "@/components/flow/progress-indicator"

// NEW: Conversational flow component
import { FlowConversation } from "@/components/flow-engine"

// Homepage components
import {
  HeroSection,
  TrustBadges,
  HowItWorksSection,
  HomepageHeader,
  PopularProjectsSection,
  TrustSection,
} from "@/components/homepage"

// Layout components
import { AnonymousLayout } from "@/components/layout/anonymous-layout"

import type { FlowPhase, PricingOption, ProOption } from "@/types/flow"

// Seasonal prompt tags
const month = new Date().getMonth()
const isCoolingSeason = month >= 3 && month <= 9

const PROMPT_TAGS = [
  {
    label: "Water heater leaking",
    value: "My water heater is leaking",
    icon: Droplets,
  },
  {
    label: isCoolingSeason ? "AC not cooling" : "Furnace tune-up",
    value: isCoolingSeason ? "My AC is not cooling properly" : "I need a furnace tune-up",
    icon: isCoolingSeason ? ThermometerSun : Flame,
  },
  {
    label: "New HVAC pricing",
    value: "I want to see pricing for a new HVAC system",
    icon: Zap,
  },
  {
    label: "Smart thermostat install",
    value: "I want to install a smart thermostat",
    icon: Sparkles,
  },
]


export default function HomePage() {
  const flowPhase = useFlowPhase()
  const setFlowPhase = useFlowStore((s) => s.setFlowPhase)
  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const reset = useFlowStore((s) => s.reset)

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Chat state
  const [hasStartedChat, setHasStartedChat] = useState(false)
  const [initialMessage, setInitialMessage] = useState<string | undefined>(undefined)
  const [showResumePrompt, setShowResumePrompt] = useState(false)

  const flowSectionRef = useRef<HTMLDivElement>(null)

  // Check auth status
  useEffect(() => {
    const supabase = createClient()

    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setCurrentUser(user)
      setIsCheckingAuth(false)

      // Check for returning user with persisted data
      if (flowPhase === "intro" && homeData && !user) {
        setShowResumePrompt(true)
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isAuthed = !!session?.user
      setIsAuthenticated(isAuthed)
      setCurrentUser(session?.user ?? null)
      setIsCheckingAuth(false)

      // If user just signed in, redirect to dashboard
      if (event === 'SIGNED_IN' && session?.user) {
        window.location.href = '/dashboard'
      }
    })

    return () => subscription.unsubscribe()
  }, [flowPhase, homeData])

  // Scroll to flow section when phase changes
  useEffect(() => {
    if (flowPhase !== "intro" && flowPhase !== "address" && flowSectionRef.current) {
      setTimeout(() => {
        flowSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    }
  }, [flowPhase])

  // Handle prompt tag click
  const handleTagClick = (value: string) => {
    setInitialMessage(value)
    setHasStartedChat(true)
  }

  // Handle message sent (from FlowConversation)
  const handleMessage = () => {
    setHasStartedChat(true)
  }

  // Flow phase handlers
  const handlePricingSelect = (_option: PricingOption) => {
    setFlowPhase("pros")
  }

  const handleProSelect = (_pro: ProOption) => {
    setFlowPhase("addons")
  }

  const handleAddonsComplete = () => {
    setFlowPhase("schedule")
  }

  const handleScheduleComplete = () => {
    setFlowPhase("contact")
  }

  const handleContactComplete = () => {
    setFlowPhase("checkout")
  }

  const handleCheckoutComplete = () => {
    setFlowPhase("confirmation")
  }

  const handlePhaseChange = (phase: FlowPhase) => {
    setFlowPhase(phase)
  }

  const handleStartOver = () => {
    reset()
    setHasStartedChat(false)
    setInitialMessage(undefined)
    setShowResumePrompt(false)
  }

  const handleResumeOrder = () => {
    setShowResumePrompt(false)
    if (selectedTier) {
      setFlowPhase(isAuthenticated ? "pricing" : "auth")
    } else if (homeData) {
      setFlowPhase(isAuthenticated ? "discovery" : "auth")
    }
  }

  const handleSignOut = async () => {
    await signOut()
    reset()
    window.location.href = "/"
  }

  // Determine which sections to show
  const showHeroContent = flowPhase === "intro"
  const showHomepageSections = flowPhase === "intro"
  const showContextCards = flowPhase !== "intro"
  const showPricing = flowPhase === "pricing"
  const showPros = flowPhase === "pros"
  const showAddons = flowPhase === "addons"
  const showSchedule = flowPhase === "schedule"
  const showContact = flowPhase === "contact"
  const showCheckout = flowPhase === "checkout"
  const showConfirmation = flowPhase === "confirmation"

  // Full-screen chat overlay when conversation has started
  if (hasStartedChat) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Chat header with close button */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-white">
          <Link href="/" className="block">
            <Image
              src="/logo.svg"
              alt="homework"
              width={100}
              height={20}
              className="h-5 w-auto"
              priority
            />
          </Link>
          <button
            onClick={handleStartOver}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Close chat"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </header>

        {/* Full-screen chat content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="h-full max-w-2xl mx-auto px-4">
            <FlowConversation
              initialMessage={initialMessage}
              onMessage={handleMessage}
              onFlowComplete={() => console.log('Flow completed')}
              onPropertyConfirm={() => console.log('Property confirmed')}
              showCamera
              autoFocus
              showIntro={false}
              variant="default"
            />
          </div>
        </div>
      </div>
    )
  }

  // Hero content for AnonymousLayout
  const heroContent = (
    <section className="px-4 sm:px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <HeroSection />

        {/* Resume Order Prompt */}
        {showResumePrompt && homeData && (
          <div className="mb-8 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="font-semibold text-foreground mb-2">Welcome back</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You have an order in progress for{" "}
                <span className="font-medium text-foreground">
                  {homeData.street || homeData.formattedAddress?.split(",")[0]}
                </span>
              </p>
              <div className="flex gap-3">
                <Button onClick={handleResumeOrder} className="flex-1 min-h-[44px]">Resume order</Button>
                <Button variant="outline" onClick={handleStartOver} className="flex-1 min-h-[44px]">Start over</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )

  // Footer content for AnonymousLayout (homepage sections)
  const footerContent = (
    <>
      <HowItWorksSection />
      <PopularProjectsSection />
      <TrustSection />

      {/* Footer CTA */}
      <section className="border-t border-border px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-6">
            Describe your project above and get instant pricing in minutes.
          </p>
          <Button
            size="lg"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="rounded-xl px-8 min-h-[44px]"
          >
            Start a Project
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </>
  )

  return (
    <AnonymousLayout
      headerContent={
        <HomepageHeader
          user={currentUser}
          isLoading={isCheckingAuth}
          onSignOut={handleSignOut}
        />
      }
      heroContent={heroContent}
      footerContent={footerContent}
      showHero={showHeroContent}
    >
      {/* Chat input area */}
      <div className="px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto max-w-2xl relative">
            {/* Simple input that opens full-screen chat */}
            <button
              onClick={() => setHasStartedChat(true)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl p-4",
                "bg-white/80 backdrop-blur-sm border border-slate-200/60",
                "shadow-[0_2px_12px_rgba(0,0,0,0.04)]",
                "hover:bg-white hover:shadow-[0_4px_20px_rgba(13,148,136,0.1)]",
                "hover:border-teal-300/80",
                "transition-all duration-200",
                "text-left",
                "min-h-[56px]"
              )}
            >
              <div className="flex-1 text-slate-400 text-base">
                Describe what you need help with...
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </button>

            {/* Quick prompt tags */}
            <div className="mt-5 flex flex-wrap justify-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
              {PROMPT_TAGS.map((tag, index) => (
                <button
                  key={tag.value}
                  onClick={() => handleTagClick(tag.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2.5",
                    "text-sm font-medium",
                    "bg-white/70 backdrop-blur-sm border border-slate-200/60",
                    "text-slate-700 shadow-sm",
                    "hover:bg-white hover:border-primary/40 hover:text-primary",
                    "hover:shadow-md hover:-translate-y-0.5",
                    "active:scale-[0.98]",
                    "transition-all duration-200",
                    "min-h-[44px]"
                  )}
                  style={{ animationDelay: `${300 + index * 50}ms` }}
                >
                  <tag.icon className="h-4 w-4 opacity-60" />
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          {showHeroContent && <TrustBadges className="mt-10" />}
        </div>
      </div>

      {/* Flow Sections Container */}
      <div ref={flowSectionRef}>
        {/* Progress Indicator */}
        {(showPricing || showPros || showAddons || showSchedule || showContact || showCheckout) && (
          <div className="border-t border-border bg-background px-4 pt-8 pb-4">
            <ProgressIndicator currentPhase={flowPhase} />
          </div>
        )}

        {showPricing && (
          <section className="border-t border-border bg-background px-4 py-12">
            <PricingSection onSelect={handlePricingSelect} />
          </section>
        )}

        {showPros && (
          <section className="border-t border-border bg-background px-4 py-12">
            <ProsSection onSelect={handleProSelect} />
          </section>
        )}

        {showAddons && (
          <section className="border-t border-border bg-background px-4 py-12">
            <AddonsSection onContinue={handleAddonsComplete} />
          </section>
        )}

        {showSchedule && (
          <section className="border-t border-border bg-background px-4 py-12">
            <ScheduleSection onContinue={handleScheduleComplete} />
          </section>
        )}

        {showContact && (
          <section className="border-t border-border bg-background px-4 py-12">
            <ContactSection onContinue={handleContactComplete} />
          </section>
        )}

        {showCheckout && (
          <section className="border-t border-border bg-background px-4 py-12">
            <CheckoutSection onContinue={handleCheckoutComplete} />
          </section>
        )}

        {showConfirmation && (
          <section className="border-t border-border bg-background px-4 py-12">
            <div className="mx-auto max-w-xl text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">You&apos;re all set</h2>
              <p className="text-muted-foreground">
                Your installation has been scheduled. The contractor will reach out to confirm details.
              </p>
              <Button variant="outline" onClick={() => setFlowPhase("intro")} className="min-h-[44px]">
                Start a new project
              </Button>
            </div>
          </section>
        )}
      </div>
    </AnonymousLayout>
  )
}
