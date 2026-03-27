'use client'

import { useState } from 'react'
import { Users, Calendar, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AuthPromptData } from '@/types/conversation'

interface AuthCardProps {
  data?: AuthPromptData
  onSignIn: () => Promise<void> | void
  className?: string
}

export function AuthCard({ data, onSignIn, className }: AuthCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await onSignIn()
    } catch (error) {
      console.error('Sign in error:', error)
      setIsLoading(false)
    }
    // Note: Don't set isLoading false on success - redirect will handle it
  }

  // Calculate next available date
  const getNextDate = () => {
    if (data?.earliestDate) return data.earliestDate

    const today = new Date()
    let daysToAdd = 1
    const dayOfWeek = today.getDay()
    if (dayOfWeek === 5) daysToAdd = 1
    else if (dayOfWeek === 6) daysToAdd = 2
    else if (dayOfWeek === 0) daysToAdd = 1

    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysToAdd)
    return nextDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  const prosCount = data?.prosCount ?? 12

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-1">Great news!</p>
        </div>

        {/* Availability info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{prosCount} vetted pros serve your area</p>
              <p className="text-sm text-muted-foreground">Licensed, insured, and background-checked</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Installs available as early as {getNextDate()}</p>
              <p className="text-sm text-muted-foreground">Most installs take less than a day</p>
            </div>
          </div>
        </div>

        {/* Auth CTA */}
        <div className="space-y-3 pt-1">
          <p className="text-center text-sm text-muted-foreground">
            Ready to see custom pricing for <span className="font-medium text-foreground">your</span> home?
          </p>

          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full min-h-[48px]"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Continue with Google'
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            We'll save your home profile automatically
          </p>
        </div>
      </div>
    </div>
  )
}

// Compact inline auth prompt (for in-chat use)
interface InlineAuthPromptProps {
  onSignIn: () => void
  isLoading?: boolean
  className?: string
}

export function InlineAuthPrompt({ onSignIn, isLoading, className }: InlineAuthPromptProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-muted/50 p-4 text-center space-y-3',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
    >
      <div>
        <p className="text-sm font-medium text-foreground">Ready to see your pricing?</p>
        <p className="text-xs text-muted-foreground mt-1">Sign in to get personalized quotes</p>
      </div>

      <Button onClick={onSignIn} disabled={isLoading} className="w-full min-h-[44px]">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Signing in...
          </>
        ) : (
          'Continue with Google'
        )}
      </Button>

      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Shield className="h-3 w-3" />
        Your home profile will be saved automatically
      </p>
    </div>
  )
}
