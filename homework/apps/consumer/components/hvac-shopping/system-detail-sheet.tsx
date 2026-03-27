'use client'

import { useState } from 'react'
import {
  Settings2,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Camera,
  Info,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import type {
  HVACSystemCard,
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

// Health grade explanations
const HEALTH_EXPLANATIONS: Record<HealthGrade, string> = {
  A: 'Your system is relatively new and should provide reliable comfort for years to come. Focus on regular maintenance to maximize its lifespan.',
  B: 'Your system is in good working condition. With proper maintenance, you can expect several more years of reliable operation.',
  C: 'Your system is showing its age. While it may still work, consider budgeting for replacement in the next few years.',
  D: 'Your system has exceeded its typical lifespan. Replacement should be planned soon to avoid unexpected breakdowns.',
  F: 'Your system is well past its useful life. Replacement is strongly recommended to avoid costly repairs and poor efficiency.',
}

interface SystemDetailSheetProps {
  /** Whether the sheet is open */
  open: boolean
  /** Callback when sheet should close */
  onClose: () => void
  /** The system to display */
  system: HVACSystemCard
  /** Callback when user wants to start shopping */
  onSmartShopping?: () => void
  /** Callback when user wants to add a photo to a component */
  onAddPhoto?: (componentId: string) => void
  /** Callback when user wants to edit a component */
  onEditComponent?: (componentId: string) => void
  className?: string
}

function HealthGradeBadge({ grade, size = 'lg' }: { grade: HealthGrade; size?: 'sm' | 'lg' }) {
  const config = HEALTH_GRADE_CONFIG[grade]
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-xl',
      config.bgColor,
      size === 'lg' ? 'w-20 h-20' : 'w-14 h-14'
    )}>
      <span className={cn(
        'font-bold',
        config.color,
        size === 'lg' ? 'text-3xl' : 'text-xl'
      )}>
        {grade}
      </span>
      <span className={cn(
        'text-muted-foreground',
        size === 'lg' ? 'text-xs' : 'text-[10px]'
      )}>
        {config.label}
      </span>
    </div>
  )
}

function ComponentDetail({
  component,
  onAddPhoto,
  onEdit,
}: {
  component: SystemComponent
  onAddPhoto?: () => void
  onEdit?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const warrantyConfig = WARRANTY_CONFIG[component.warrantyStatus]
  const icon = COMPONENT_ICONS[component.type] || '⚙️'

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-xl shrink-0">
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{component.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {component.brand && (
              <span className="text-sm text-muted-foreground">{component.brand}</span>
            )}
            {component.brand && component.age && (
              <span className="text-muted-foreground/50">·</span>
            )}
            {component.age && (
              <span className="text-sm text-muted-foreground">~{component.age} years</span>
            )}
          </div>
        </div>

        {/* Warranty badge */}
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0',
          warrantyConfig.bgColor,
          warrantyConfig.color
        )}>
          <warrantyConfig.Icon className="w-3 h-3" />
          {warrantyConfig.label}
        </span>

        {/* Chevron */}
        <ChevronRight className={cn(
          'w-4 h-4 text-muted-foreground transition-transform shrink-0',
          isExpanded && 'rotate-90'
        )} />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border bg-muted/30">
          <div className="pt-4 space-y-3">
            {/* Model info */}
            {component.model && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{component.model}</span>
              </div>
            )}

            {/* Warranty expiration */}
            {component.warrantyExpires && component.warrantyStatus === 'active' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Warranty expires</span>
                <span className="font-medium">{new Date(component.warrantyExpires).toLocaleDateString()}</span>
              </div>
            )}

            {/* Photo placeholder */}
            {component.photoUrl ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={component.photoUrl}
                  alt={component.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddPhoto?.()
                }}
                className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Add photo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function SystemDetailSheet({
  open,
  onClose,
  system,
  onSmartShopping,
  onAddPhoto,
  onEditComponent,
  className,
}: SystemDetailSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const gradeConfig = HEALTH_GRADE_CONFIG[system.healthGrade]

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          isDesktop
            ? 'w-[420px] sm:max-w-[420px]'
            : 'h-[90vh] max-h-[90vh] rounded-t-2xl',
          'p-0 flex flex-col',
          className
        )}
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <SheetTitle className="text-left">{system.name} System</SheetTitle>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Health Overview */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-4">
              <HealthGradeBadge grade={system.healthGrade} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">
                  System Health: {gradeConfig.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {system.healthMessage}
                </p>
              </div>
            </div>

            {/* Health explanation */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {HEALTH_EXPLANATIONS[system.healthGrade]}
                </p>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="p-4 border-b border-border">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">System type</span>
                <span className="font-medium">{system.systemType}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated age</span>
                <span className="font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  ~{system.estimatedAge} years
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">{system.tonnage} ton</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {system.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                >
                  {tag === 'attic' && '📍 '}
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Components */}
          <div className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Components ({system.components.length})
            </h3>
            <div className="space-y-3">
              {system.components.map((component) => (
                <ComponentDetail
                  key={component.id}
                  component={component}
                  onAddPhoto={() => onAddPhoto?.(component.id)}
                  onEdit={() => onEditComponent?.(component.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer with CTA */}
        <SheetFooter className="flex-shrink-0 p-4 border-t border-border bg-background">
          <Button
            onClick={() => {
              onSmartShopping?.()
              onClose()
            }}
            className="w-full rounded-xl"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Smart Shopping
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            See transparent pricing from vetted local pros
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default SystemDetailSheet
