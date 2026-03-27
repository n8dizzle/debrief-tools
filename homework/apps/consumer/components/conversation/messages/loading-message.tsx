'use client'

import { cn } from '@/lib/utils'
import { Bot } from 'lucide-react'

interface LoadingMessageProps {
  className?: string
}

export function LoadingMessage({ className }: LoadingMessageProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* Avatar indicator - matches assistant style */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm ring-1 ring-slate-200/50">
        <Bot className="w-4 h-4 text-slate-500" strokeWidth={2} />
      </div>

      <div
        className={cn(
          'bg-white rounded-2xl rounded-tl-md',
          'border border-slate-200/80',
          'shadow-sm',
          'px-5 py-4',
          'flex items-center gap-1.5'
        )}
      >
        {/* Refined animated dots */}
        <span
          className="w-2 h-2 rounded-full bg-slate-400"
          style={{
            animation: 'pulse-dot 1.4s ease-in-out infinite',
            animationDelay: '0ms',
          }}
        />
        <span
          className="w-2 h-2 rounded-full bg-slate-400"
          style={{
            animation: 'pulse-dot 1.4s ease-in-out infinite',
            animationDelay: '200ms',
          }}
        />
        <span
          className="w-2 h-2 rounded-full bg-slate-400"
          style={{
            animation: 'pulse-dot 1.4s ease-in-out infinite',
            animationDelay: '400ms',
          }}
        />

        {/* Keyframe animation */}
        <style jsx>{`
          @keyframes pulse-dot {
            0%, 80%, 100% {
              transform: scale(0.7);
              opacity: 0.4;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  )
}

// Alternative: Shimmer variant for content loading
export function LoadingMessageShimmer({ className }: LoadingMessageProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* Avatar indicator */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm ring-1 ring-slate-200/50">
        <Bot className="w-4 h-4 text-slate-500" strokeWidth={2} />
      </div>

      <div
        className={cn(
          'bg-white rounded-2xl rounded-tl-md',
          'border border-slate-200/80',
          'shadow-sm',
          'px-4 py-3',
          'space-y-2',
          'min-w-[200px]'
        )}
      >
        {/* Shimmer lines */}
        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-48" />
        <div className="h-3.5 bg-slate-100 rounded-full animate-pulse w-36" />
      </div>
    </div>
  )
}
