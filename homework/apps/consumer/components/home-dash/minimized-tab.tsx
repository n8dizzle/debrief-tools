'use client'

import { Home, ChevronLeft, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MinimizedTabProps {
  onClick: () => void
  address?: string
  /** 'vertical' for desktop (right edge), 'horizontal' for mobile (bottom) */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function MinimizedTab({
  onClick,
  address,
  orientation = 'horizontal',
  className,
}: MinimizedTabProps) {
  const shortAddress = address?.split(',')[0] || 'Your Home'

  if (orientation === 'vertical') {
    // Desktop: Vertical tab on right edge
    return (
      <button
        onClick={onClick}
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          'flex items-center gap-2',
          'bg-teal-600 text-white',
          'rounded-l-xl',
          'py-3 px-2.5',
          'shadow-lg',
          'hover:bg-teal-700 hover:pr-4',
          'active:scale-[0.98]',
          'transition-all duration-200',
          'animate-in slide-in-from-right-2 fade-in duration-300',
          className
        )}
        aria-label="Open home dashboard"
      >
        <ChevronLeft className="w-4 h-4" />
        <div className="flex flex-col items-center gap-0.5">
          <Home className="w-5 h-5" />
          <span
            className="text-xs font-medium writing-mode-vertical"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            Your Home
          </span>
        </div>
      </button>
    )
  }

  // Mobile: Horizontal tab at bottom
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-center gap-2',
        'bg-teal-600 text-white',
        'rounded-t-xl',
        'py-2.5 px-4',
        'shadow-lg',
        'hover:bg-teal-700',
        'active:scale-[0.99]',
        'transition-all duration-200',
        'animate-in slide-in-from-bottom-2 fade-in duration-300',
        'min-h-[44px]',
        className
      )}
      aria-label="Open home dashboard"
    >
      <Home className="w-4 h-4" />
      <span className="text-sm font-medium truncate max-w-[200px]">
        {shortAddress}
      </span>
      <ChevronUp className="w-4 h-4" />
    </button>
  )
}
