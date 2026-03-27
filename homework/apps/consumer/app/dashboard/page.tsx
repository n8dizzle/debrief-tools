"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useFlowStore, useHasHydrated } from "@/lib/flow-state"
import { getPropertyData } from "@/lib/property-data-server"
import type { PropertyData } from "@/lib/property-data-client"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

// Components
import { AppSidebar } from "@/components/layout/app-sidebar"
import { FlowConversation } from "@/components/flow-engine"
import { getUserPrimaryHome, saveHomeData } from "./actions"
import { Home, ArrowRight, Menu, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

function DashboardPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Flow state
  const homeData = useFlowStore((s) => s.homeData)
  const cachedPropertyData = useFlowStore((s) => s.cachedPropertyData)
  const setCachedPropertyData = useFlowStore((s) => s.setCachedPropertyData)
  const syncHomeFromDatabase = useFlowStore((s) => s.syncHomeFromDatabase)
  const hasHydrated = useHasHydrated()

  // Auth state
  const [user, setUser] = useState<SupabaseUser | null>(null)

  // UI state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobile
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasNoHome, setHasNoHome] = useState(false)
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>(undefined)

  // Refs
  const dbSyncDone = useRef(false)
  const homeSaved = useRef(false)
  const welcomeShown = useRef(false)

  // Get user on mount
  useEffect(() => {
    const supabase = createClient()
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setIsSidebarCollapsed(saved === 'true')
    }
  }, [])

  const handleSidebarToggle = () => {
    const newState = !isSidebarCollapsed
    setIsSidebarCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  // Generate welcome message for returning users
  useEffect(() => {
    if (welcomeShown.current) return
    if (!hasHydrated || isLoading) return
    if (!homeData?.formattedAddress) return

    welcomeShown.current = true

    const shortAddress = homeData.street || homeData.formattedAddress?.split(',')[0]
    const isAuthReturn = searchParams.get('auth') === 'success'

    if (isAuthReturn) {
      router.replace('/dashboard', { scroll: false })
      setWelcomeMessage(`Welcome back. Your home at ${shortAddress} is linked. What would you like help with today?`)
    } else {
      setWelcomeMessage(`Welcome back. What can I help you with for ${shortAddress}?`)
    }
  }, [hasHydrated, isLoading, homeData, searchParams, router])

  // Sync from database
  useEffect(() => {
    async function syncFromDatabase() {
      if (!hasHydrated) return

      if (homeData?.formattedAddress) {
        setIsLoading(false)
        setHasNoHome(false)
        return
      }

      if (dbSyncDone.current) return
      dbSyncDone.current = true

      const { home: dbHome, error } = await getUserPrimaryHome()

      if (error) {
        setIsLoading(false)
        return
      }

      if (!dbHome) {
        setHasNoHome(true)
        setIsLoading(false)
        return
      }

      syncHomeFromDatabase(dbHome)
      setHasNoHome(false)
      setIsLoading(false)
    }

    syncFromDatabase()
  }, [hasHydrated, homeData?.formattedAddress, syncHomeFromDatabase])

  // Fetch property data
  useEffect(() => {
    async function loadPropertyData() {
      if (!homeData?.formattedAddress || hasNoHome) return

      let data = cachedPropertyData
      if (!data) {
        try {
          data = await getPropertyData(homeData.formattedAddress)
          setCachedPropertyData(data)
        } catch (error) {
          console.error("Failed to fetch property data:", error)
          return
        }
      }

      setPropertyData(data)

      if (!homeSaved.current) {
        homeSaved.current = true
        await saveHomeData(homeData, data)
      }
    }

    if (!isLoading && homeData) {
      loadPropertyData()
    }
  }, [homeData, cachedPropertyData, setCachedPropertyData, isLoading, hasNoHome])

  const handleFlowComplete = useCallback(() => {
    console.log('Flow completed!')
  }, [])

  const handlePropertyConfirm = useCallback(() => {
    // Property confirmed in flow
  }, [])

  // Empty state - no home claimed
  if (hasNoHome) {
    return (
      <div className="flex h-screen bg-white">
        {/* Desktop sidebar */}
        <div className="hidden md:block flex-shrink-0">
          <AppSidebar
            user={user}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleSidebarToggle}
            conversations={[]}
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-teal-50 mb-6">
              <Home className="h-8 w-8 text-teal-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No home claimed yet
            </h2>
            <p className="text-slate-500 mb-6">
              Enter your address to claim your home and get personalized pricing.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-full font-medium hover:bg-teal-700 transition-colors min-h-[44px]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex md:hidden items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/">
          <Image
            src="/logo.svg"
            alt="homework"
            width={100}
            height={20}
            className="h-5 w-auto"
            priority
          />
        </Link>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar
              user={user}
              isCollapsed={false}
              onToggleCollapse={() => setIsSidebarOpen(false)}
              homeData={homeData}
              conversations={[]}
            />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block flex-shrink-0">
        <AppSidebar
          user={user}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleSidebarToggle}
          homeData={homeData}
          conversations={[]}
        />
      </div>

      {/* Main content - Chat */}
      <main className={cn(
        'flex-1 flex flex-col overflow-hidden',
        'pt-14 md:pt-0'
      )}>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <FlowConversation
              autoFocus
              showCamera
              showIntro={!homeData?.formattedAddress}
              customGreeting={welcomeMessage}
              className="min-h-[calc(100dvh-8rem)]"
              onFlowComplete={handleFlowComplete}
              onPropertyConfirm={handlePropertyConfirm}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

function DashboardLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="text-slate-400">Loading...</div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageInner />
    </Suspense>
  )
}
