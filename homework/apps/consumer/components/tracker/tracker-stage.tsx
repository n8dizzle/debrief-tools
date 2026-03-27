'use client'

import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  Loader2,
  Package,
  Calendar,
  Truck,
  Wrench,
  ClipboardCheck,
  Home,
  ChevronRight,
} from 'lucide-react'
import type { OrderStage, StageStatus } from '@/types/tracker'

interface TrackerStageProps {
  stage: OrderStage
  isLast?: boolean
  onClick?: () => void
  showConnector?: boolean
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ElementType> = {
  'check-circle': CheckCircle2,
  'package': Package,
  'calendar': Calendar,
  'truck': Truck,
  'wrench': Wrench,
  'clipboard-check': ClipboardCheck,
  'home': Home,
}

function getStatusIcon(status: StageStatus, iconName?: string | null) {
  if (status === 'completed') {
    return <CheckCircle2 className="w-5 h-5 text-teal-500" />
  }

  if (status === 'current') {
    return <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
  }

  // Pending - show custom icon or default circle
  const IconComponent = iconName ? iconMap[iconName] : Circle
  return <IconComponent className="w-5 h-5 text-slate-300" />
}

function formatDate(dateString: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TrackerStage({
  stage,
  isLast = false,
  onClick,
  showConnector = true,
}: TrackerStageProps) {
  const status = stage.status as StageStatus
  const isCompleted = status === 'completed'
  const isCurrent = status === 'current'
  const isPending = status === 'pending'

  const completedDate = formatDate(stage.completed_at)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'w-full flex items-start gap-3 py-2 text-left transition-colors',
          onClick && 'hover:bg-slate-50 rounded-lg -mx-2 px-2',
          onClick && 'cursor-pointer',
          !onClick && 'cursor-default'
        )}
      >
        {/* Icon column with connector line */}
        <div className="relative flex flex-col items-center">
          {/* Status icon */}
          <div className={cn(
            'relative z-10 flex items-center justify-center',
            'w-6 h-6',
          )}>
            {getStatusIcon(status, stage.icon)}
          </div>

          {/* Connector line */}
          {showConnector && !isLast && (
            <div
              className={cn(
                'w-0.5 flex-1 min-h-[24px] mt-1',
                isCompleted ? 'bg-teal-500' : 'bg-slate-200'
              )}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'font-medium text-sm leading-tight',
                isCompleted && 'text-slate-500',
                isCurrent && 'text-slate-900',
                isPending && 'text-slate-400'
              )}
            >
              {stage.name}
              {isCurrent && (
                <span className="ml-2 text-xs text-teal-600 font-normal">
                  Current
                </span>
              )}
            </span>

            {completedDate && (
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {completedDate}
              </span>
            )}
          </div>

          {/* Description for current stage */}
          {isCurrent && stage.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {stage.description}
            </p>
          )}

          {/* Contractor note */}
          {stage.contractor_note && (
            <p className="mt-1 text-xs text-slate-600 italic bg-slate-50 rounded px-2 py-1">
              Note: {stage.contractor_note}
            </p>
          )}
        </div>

        {/* Chevron for clickable stages */}
        {onClick && (
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
        )}
      </button>
    </div>
  )
}
