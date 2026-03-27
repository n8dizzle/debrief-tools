'use client'

import { useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFlowStore } from '@/lib/flow-state'
import { AppSidebar } from './app-sidebar'
import { ArtifactsPanel } from './artifacts-panel'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface ConversationalLayoutProps {
  children: ReactNode
  showArtifacts?: boolean
  isOnboarding?: boolean
  className?: string
}

export function ConversationalLayout({
  children,
  showArtifacts = false,
  isOnboarding = false,
  className,
}: ConversationalLayoutProps) {
  const homeData = useFlowStore((s) => s.homeData)

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobile only
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(showArtifacts)

  // Open artifacts panel when showArtifacts changes
  useEffect(() => {
    if (showArtifacts) {
      setIsArtifactsOpen(true)
    }
  }, [showArtifacts])

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

  // Check for saved sidebar preference
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

  const handleArtifactsToggle = () => {
    setIsArtifactsOpen(!isArtifactsOpen)
  }

  return (
    <div className={cn('flex h-screen bg-white dark:bg-slate-950 overflow-hidden', className)}>
      {/* Mobile Header - only visible on small screens */}
      <div className="fixed top-0 left-0 right-0 z-50 flex md:hidden items-center justify-between h-14 px-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-slate-900 dark:text-white">Homework</span>
        {homeData && (
          <button
            onClick={handleArtifactsToggle}
            className={cn(
              'p-2 -mr-2 rounded-lg transition-colors',
              isArtifactsOpen
                ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            <span className="text-sm font-medium">Home</span>
          </button>
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar
              user={user}
              isCollapsed={false}
              onToggleCollapse={() => setIsSidebarOpen(false)}
              conversations={[]}
            />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
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
          conversations={[]}
        />
      </div>

      {/* Main content area */}
      <main className={cn(
        'flex-1 flex flex-col overflow-hidden',
        'pt-14 md:pt-0', // Padding for mobile header
      )}>
        {children}
      </main>

      {/* Artifacts panel (desktop only - becomes bottom sheet on mobile) */}
      <div className="hidden md:block flex-shrink-0">
        {homeData && (
          <ArtifactsPanel
            homeData={homeData}
            isOpen={isArtifactsOpen}
            isOnboarding={isOnboarding}
            onClose={() => setIsArtifactsOpen(false)}
            onToggle={handleArtifactsToggle}
          />
        )}
      </div>

      {/* Mobile artifacts bottom sheet */}
      {homeData && isArtifactsOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden animate-in slide-in-from-bottom duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-700 max-h-[70vh] overflow-hidden flex flex-col">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <ArtifactsPanel
                homeData={homeData}
                isOpen={true}
                isOnboarding={isOnboarding}
                onClose={() => setIsArtifactsOpen(false)}
                onToggle={handleArtifactsToggle}
                className="border-0 h-auto"
              />
            </div>
          </div>
          {/* Backdrop */}
          <div
            className="fixed inset-0 -z-10 bg-black/30"
            onClick={() => setIsArtifactsOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
