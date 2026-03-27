'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrackerProgressBar } from './tracker-progress-bar'
import { TrackerStage } from './tracker-stage'
import { StageDetailSheet } from './stage-detail-sheet'
import { useTrackerRealtime } from '@/hooks/use-tracker-realtime'
import {
  Calendar,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import type { OrderWithDetails, OrderStage, OrderStageWithContent } from '@/types/tracker'

interface InstallTrackerCardProps {
  orderId: string
  initialOrder?: OrderWithDetails
  showEducationalContent?: boolean
  compact?: boolean
  className?: string
}

export function InstallTrackerCard({
  orderId,
  initialOrder,
  showEducationalContent = true,
  compact = false,
  className,
}: InstallTrackerCardProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const [selectedStage, setSelectedStage] = useState<OrderStageWithContent | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Use realtime hook for live updates
  const { order, stages, isLoading, error } = useTrackerRealtime(orderId, initialOrder)

  const handleStageClick = useCallback((stage: OrderStage) => {
    if (showEducationalContent) {
      setSelectedStage(stage as OrderStageWithContent)
      setIsSheetOpen(true)
    }
  }, [showEducationalContent])

  const handleSheetClose = useCallback(() => {
    setIsSheetOpen(false)
    setSelectedStage(null)
  }, [])

  if (isLoading && !order) {
    return (
      <Card className={cn('bg-white', className)}>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (error || !order) {
    return (
      <Card className={cn('bg-white', className)}>
        <CardContent className="py-6">
          <p className="text-sm text-slate-500 text-center">
            Unable to load order status
          </p>
        </CardContent>
      </Card>
    )
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const totalStages = sortedStages.length
  const currentPosition = order.current_stage_position || 1
  const isComplete = order.status === 'completed'

  // For compact mode, only show current and next stage
  const displayStages = compact && !isExpanded
    ? sortedStages.filter(
        (s) => s.position >= currentPosition - 1 && s.position <= currentPosition + 1
      )
    : sortedStages

  // Format scheduled date
  const scheduledDateDisplay = order.scheduled_date
    ? new Date(order.scheduled_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null

  // Contractor name
  const contractorName = order.contractor?.company_name || order.contractor?.name || 'Your installer'

  return (
    <>
      <Card className={cn('bg-white overflow-hidden', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                {order.service_type?.name || 'Your Installation'}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Order #{order.order_number}
              </p>
            </div>

            {/* Status badge */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                isComplete && 'bg-teal-100 text-teal-700',
                !isComplete && order.status === 'confirmed' && 'bg-blue-100 text-blue-700',
                !isComplete && order.status === 'in_progress' && 'bg-amber-100 text-amber-700',
                !isComplete && order.status === 'pending' && 'bg-slate-100 text-slate-600'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isComplete && 'bg-teal-500',
                  !isComplete && 'bg-current animate-pulse'
                )}
              />
              {isComplete ? 'Complete' : 'Active'}
            </div>
          </div>

          {/* Progress bar */}
          <TrackerProgressBar
            currentPosition={currentPosition}
            totalStages={totalStages}
            className="mt-3"
          />
        </CardHeader>

        <CardContent className="pt-0">
          {/* Stages list */}
          <div className="space-y-0">
            {displayStages.map((stage, index) => (
              <TrackerStage
                key={stage.id}
                stage={stage}
                isLast={index === displayStages.length - 1}
                onClick={showEducationalContent ? () => handleStageClick(stage) : undefined}
                showConnector={!compact || isExpanded}
              />
            ))}
          </div>

          {/* Expand/collapse for compact mode */}
          {compact && sortedStages.length > 3 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all {sortedStages.length} stages
                </>
              )}
            </button>
          )}

          {/* Footer info */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {scheduledDateDisplay && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{scheduledDateDisplay}</span>
                {order.scheduled_time_slot && (
                  <span className="text-slate-400">• {order.scheduled_time_slot}</span>
                )}
              </div>
            )}

            {contractorName && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300">•</span>
                <span>{contractorName}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            {showEducationalContent && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9"
                onClick={() => {
                  const currentStage = sortedStages.find(s => s.position === currentPosition)
                  if (currentStage) handleStageClick(currentStage)
                }}
              >
                Learn More
              </Button>
            )}

            {order.customer_phone && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-9"
                asChild
              >
                <a href={`tel:${order.customer_phone}`}>
                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                  Contact Pro
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Educational content sheet */}
      <StageDetailSheet
        stage={selectedStage}
        isOpen={isSheetOpen}
        onClose={handleSheetClose}
      />
    </>
  )
}
