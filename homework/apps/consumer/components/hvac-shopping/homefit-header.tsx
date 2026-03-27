'use client'

import { Sparkles, Pencil, Home, Thermometer, Zap, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HomeFitContext, SystemScope, TierPreference } from '@/types/hvac-shopping'

// Scope display labels
const SCOPE_LABELS: Record<SystemScope, string> = {
  whole_home: 'Whole Home',
  upstairs: 'Upstairs',
  downstairs: 'Downstairs',
  single_zone: 'Single Zone',
}

// Tier display config
const TIER_CONFIG: Record<TierPreference, { label: string; color: string; bgColor: string }> = {
  economy: { label: 'Economy', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  'mid-range': { label: 'Mid-Range', color: 'text-primary', bgColor: 'bg-primary/10' },
  premium: { label: 'Premium', color: 'text-amber-700', bgColor: 'bg-amber-50' },
}

// Heat source icons
const HEAT_SOURCE_ICONS: Record<string, typeof Flame> = {
  gas: Flame,
  electric: Zap,
  heat_pump: Thermometer,
}

interface HomeFitHeaderProps {
  /** The HomeFit context data */
  context: HomeFitContext
  /** Property address (optional, for display) */
  address?: string
  /** Callback when user wants to change settings */
  onChange?: () => void
  /** Whether the header is in compact mode */
  compact?: boolean
  /** Whether to show the change button */
  showChangeButton?: boolean
  /** Additional class name */
  className?: string
}

function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'muted'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        variant === 'default' && 'bg-muted text-muted-foreground',
        variant === 'primary' && 'bg-primary/10 text-primary',
        variant === 'muted' && 'bg-muted/50 text-muted-foreground/80',
        className
      )}
    >
      {children}
    </span>
  )
}

export function HomeFitHeader({
  context,
  address,
  onChange,
  compact = false,
  showChangeButton = true,
  className,
}: HomeFitHeaderProps) {
  const HeatIcon = HEAT_SOURCE_ICONS[context.heatSource] || Flame
  const tierConfig = context.tierPreference ? TIER_CONFIG[context.tierPreference] : null

  if (compact) {
    // Compact single-line version for tight spaces
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10',
          className
        )}
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-x-auto scrollbar-hide">
          <span className="font-medium text-foreground shrink-0">{context.tonnage}T</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="shrink-0">{context.systemType}</span>
        </div>
        {showChangeButton && onChange && (
          <button
            onClick={onChange}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  // Full version with badges
  return (
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br from-primary/5 via-background to-background border border-primary/10 overflow-hidden',
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Your HomeFit</h3>
            {address && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {address}
              </p>
            )}
          </div>
        </div>
        {showChangeButton && onChange && (
          <button
            onClick={onChange}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Change
          </button>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {/* Scope badge */}
        <Badge>
          <Home className="w-3 h-3" />
          {SCOPE_LABELS[context.scope]}
        </Badge>

        {/* Tonnage badge */}
        <Badge variant="primary">
          {context.tonnage} Ton
        </Badge>

        {/* System type badge */}
        <Badge>
          <HeatIcon className="w-3 h-3" />
          {context.systemType}
        </Badge>

        {/* Tier preference badge (if set) */}
        {tierConfig && (
          <Badge className={cn(tierConfig.bgColor, tierConfig.color)}>
            {tierConfig.label}
          </Badge>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Inline variant for conversation messages
// =============================================================================

interface HomeFitInlineProps {
  context: HomeFitContext
  className?: string
}

/**
 * Minimal inline version for embedding in conversation messages
 */
export function HomeFitInline({ context, className }: HomeFitInlineProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10',
        className
      )}
    >
      <Sparkles className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-medium text-foreground">
        {context.tonnage}T {context.systemType}
      </span>
    </div>
  )
}

// =============================================================================
// Sticky header variant for shopping pages
// =============================================================================

interface HomeFitStickyHeaderProps {
  context: HomeFitContext
  address?: string
  onChange?: () => void
  className?: string
}

/**
 * Sticky header that stays at top during shopping flow
 */
export function HomeFitStickyHeader({
  context,
  address,
  onChange,
  className,
}: HomeFitStickyHeaderProps) {
  const HeatIcon = HEAT_SOURCE_ICONS[context.heatSource] || Flame

  return (
    <div
      className={cn(
        'sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border',
        className
      )}
    >
      <div className="container max-w-screen-md px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left side - context info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {context.tonnage}T
              </span>
              <span className="text-sm text-muted-foreground">
                {context.systemType}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                <HeatIcon className="w-3 h-3" />
                {context.heatSource === 'gas' ? 'Gas' : context.heatSource === 'electric' ? 'Electric' : 'Heat Pump'}
              </span>
            </div>
          </div>

          {/* Right side - address & change */}
          <div className="flex items-center gap-2">
            {address && (
              <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[150px]">
                {address.split(',')[0]}
              </span>
            )}
            {onChange && (
              <button
                onClick={onChange}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeFitHeader
