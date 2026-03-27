'use client'

import { useCallback } from 'react'
import {
  Settings2,
  ChevronDown,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFlowStore } from '@/lib/flow-state'
import type {
  HVACSystemCard as HVACSystemCardType,
  SystemComponent,
  HealthGrade,
  WarrantyStatus,
} from '@/types/hvac-shopping'
import { HEALTH_GRADE_CONFIG } from '@/types/hvac-shopping'

// Component type icons
const COMPONENT_ICONS: Record<string, string> = {
  thermostat: '🌡️',
  condenser: '❄️',
  coil: '💨',
  furnace: '🔥',
  air_handler: '💨',
  heat_strips: '⚡',
}

// Warranty status config
const WARRANTY_CONFIG: Record<WarrantyStatus, { label: string; color: string; bgColor: string; Icon: typeof ShieldCheck }> = {
  active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-50', Icon: ShieldCheck },
  expired: { label: 'Expired', color: 'text-red-700', bgColor: 'bg-red-50', Icon: ShieldAlert },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted', Icon: ShieldAlert },
}

interface SystemCardProps {
  system: HVACSystemCardType
  onSmartShopping?: () => void
  onExpand?: () => void
  onEdit?: () => void
  className?: string
}

function HealthGradeBadge({ grade }: { grade: HealthGrade }) {
  const config = HEALTH_GRADE_CONFIG[grade]
  return (
    <div className={cn('flex flex-col items-center justify-center p-3 rounded-lg', config.bgColor)}>
      <span className={cn('text-2xl font-bold', config.color)}>{grade}</span>
      <span className="text-xs text-muted-foreground">System Grade</span>
    </div>
  )
}

function ComponentRow({ component }: { component: SystemComponent }) {
  const warrantyConfig = WARRANTY_CONFIG[component.warrantyStatus]
  const icon = COMPONENT_ICONS[component.type] || '⚙️'

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      {/* Icon */}
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-lg">
        {icon}
      </div>

      {/* Add photo placeholder */}
      <button className="flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted transition-colors">
        <span className="text-lg">+</span>
      </button>

      {/* Component info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{component.name}</span>
          {component.brand && (
            <span className="text-sm text-muted-foreground">{component.brand}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {component.age && (
            <span className="text-xs text-muted-foreground">~{component.age} years</span>
          )}
          {component.warrantyStatus !== 'unknown' && (
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
              warrantyConfig.bgColor,
              warrantyConfig.color
            )}>
              Parts: {warrantyConfig.label}
            </span>
          )}
        </div>
        {component.warrantyStatus === 'active' && (
          <button className="text-xs text-primary hover:underline mt-0.5">
            Tap to see details
          </button>
        )}
      </div>

      {/* Edit button */}
      <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  )
}

export function SystemCard({
  system,
  onSmartShopping,
  onExpand,
  onEdit,
  className,
}: SystemCardProps) {
  // Store actions for opening sheet
  const openSheet = useFlowStore((s) => s.openSheet)

  const handleExpand = useCallback(() => {
    if (onExpand) {
      onExpand()
    } else {
      // Open the system-detail sheet
      openSheet('system-detail')
    }
  }, [onExpand, openSheet])

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 sm:p-5">
        {/* System name and edit */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">{system.name}</h3>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* System type */}
        <p className="text-sm text-muted-foreground mb-3">{system.systemType}</p>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {system.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
            >
              {tag === 'attic' && '📍 '}
              {tag}
            </span>
          ))}
          <button className="text-xs text-primary hover:underline">+ Add Filters</button>
        </div>

        {/* Grade and age row */}
        <div className="flex items-stretch gap-3 mb-4">
          <HealthGradeBadge grade={system.healthGrade} />
          <div className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">~{system.estimatedAge} years old</p>
              <p className="text-xs text-muted-foreground">{system.healthMessage}</p>
            </div>
          </div>
        </div>

        {/* Smart Shopping CTA */}
        <Button
          onClick={onSmartShopping}
          className="w-full rounded-xl"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Smart Shopping
        </Button>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-center gap-2 py-3 border-t border-border bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronDown className="w-4 h-4" />
        View details
      </button>
    </div>
  )
}

// Export for use in card registry
export default SystemCard
