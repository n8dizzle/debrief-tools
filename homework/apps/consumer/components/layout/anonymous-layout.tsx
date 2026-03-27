'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AnonymousLayoutProps {
  children: ReactNode
  /** Hero section - shown when showHero is true, collapses on chat start */
  heroContent?: ReactNode
  /** Footer content - shown when showHero is true */
  footerContent?: ReactNode
  /** Custom header - defaults to Homework branding */
  headerContent?: ReactNode
  /** Whether to show hero and footer sections */
  showHero?: boolean
  /** Additional class name */
  className?: string
}

/**
 * AnonymousLayout - Clean, focused layout for pre-auth users
 *
 * Single-column layout with:
 * - Header (logo + sign in)
 * - Hero section (collapses when conversation starts)
 * - Main chat area (always visible)
 * - Footer section (How it Works - visible in hero state)
 *
 * No sidebar, no artifacts panel - just the conversation.
 */
export function AnonymousLayout({
  children,
  heroContent,
  footerContent,
  headerContent,
  showHero = true,
  className,
}: AnonymousLayoutProps) {
  return (
    <div className={cn(
      'min-h-dvh bg-gradient-to-b from-secondary via-secondary to-background flex flex-col',
      className
    )}>
      {/* Header */}
      {headerContent && (
        <header className="sticky top-0 z-50 border-b border-border/50 bg-secondary/80 backdrop-blur-sm flex-shrink-0">
          {headerContent}
        </header>
      )}

      {/* Main content area */}
      <main className={cn(
        'flex-1 flex flex-col',
        // When showing hero, don't let chat expand - keep it compact under hero
        showHero ? '' : ''
      )}>
        {/* Hero section - collapses when conversation starts */}
        {showHero && heroContent && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {heroContent}
          </div>
        )}

        {/* Chat area */}
        <div className={cn(
          'flex flex-col',
          // Only expand to fill space when conversation has started (no hero)
          showHero ? 'flex-shrink-0' : 'flex-1 pt-4'
        )}>
          {children}
        </div>

        {/* Footer section - only visible in hero state */}
        {showHero && footerContent && (
          <div className="flex-shrink-0 mt-auto">
            {footerContent}
          </div>
        )}
      </main>
    </div>
  )
}
