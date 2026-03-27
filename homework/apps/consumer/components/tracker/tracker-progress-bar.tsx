'use client'

import { cn } from '@/lib/utils'

interface TrackerProgressBarProps {
  currentPosition: number
  totalStages: number
  className?: string
}

export function TrackerProgressBar({
  currentPosition,
  totalStages,
  className,
}: TrackerProgressBarProps) {
  // Calculate progress percentage (current stage is in progress, so subtract 0.5)
  const progressPercent = totalStages > 0
    ? ((currentPosition - 0.5) / totalStages) * 100
    : 0

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Progress bar */}
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>

      {/* Stage count */}
      <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
        {currentPosition} of {totalStages}
      </span>
    </div>
  )
}
