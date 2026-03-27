'use client'

import Image from 'next/image'
import Link from 'next/link'
import { User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface HomepageHeaderProps {
  /** Current user (null if not authenticated) */
  user: SupabaseUser | null
  /** Whether auth check is in progress */
  isLoading?: boolean
  /** Sign out handler */
  onSignOut?: () => void
  /** Additional class name */
  className?: string
}

/**
 * HomepageHeader - Logo + user menu header for the homepage
 *
 * Shows:
 * - Logo (always)
 * - Dashboard link + avatar + sign out (authenticated)
 * - Sign in link (not authenticated)
 */
export function HomepageHeader({
  user,
  isLoading = false,
  onSignOut,
  className,
}: HomepageHeaderProps) {
  return (
    <div className={cn(
      'mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6',
      className
    )}>
      {/* Logo */}
      <Link href="/" className="block">
        <Image
          src="/logo.svg"
          alt="homework"
          width={120}
          height={24}
          className="h-6 w-auto"
          priority
        />
      </Link>

      {/* Right side */}
      {isLoading ? (
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      ) : user ? (
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          {user.user_metadata?.avatar_url ? (
            <Image
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata?.full_name || 'User'}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-border"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <Link
          href="/login"
          className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      )}
    </div>
  )
}
