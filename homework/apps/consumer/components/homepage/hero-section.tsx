'use client'

import { Sparkles, Check, Shield, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroSectionProps {
  /** Additional class name */
  className?: string
}

/**
 * HeroSection - Homepage hero with headline, tagline
 *
 * Shows:
 * - "The New Standard for Home Services" badge
 * - "Stop guessing what things should cost." headline
 * - "Get prices, not quotes." tagline
 * - Description
 *
 * Note: Does not include its own section wrapper - parent provides layout context.
 */
export function HeroSection({ className }: HeroSectionProps) {
  return (
    <div className={cn('text-center animate-in fade-in slide-in-from-bottom-4 duration-500', className)}>
      {/* Badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
        <Sparkles className="h-4 w-4" />
        The New Standard for Home Services
      </div>

      {/* Headline */}
      <h1 className="mb-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        Stop guessing what things should cost.
      </h1>

      {/* Tagline */}
      <p className="mb-4 text-2xl font-semibold text-primary sm:text-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        Get prices, not quotes.
      </p>

      {/* Description */}
      <p className="mb-10 text-lg text-muted-foreground sm:text-xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        Tell us what&apos;s going on and we&apos;ll get you real pricing for your home.
      </p>
    </div>
  )
}

/**
 * TrustBadges - Trust indicators shown below the hero
 */
export function TrustBadges({ className }: { className?: string }) {
  return (
    <div className={cn(
      'flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground',
      className
    )}>
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-primary" />
        Standardized Scopes
      </div>
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        Vetted Pros
      </div>
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-primary" />
        Data-Driven Pricing
      </div>
    </div>
  )
}
