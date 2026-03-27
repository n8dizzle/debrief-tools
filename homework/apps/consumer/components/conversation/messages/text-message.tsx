'use client'

import { cn } from '@/lib/utils'
import type { MessageRole } from '@/types/conversation'
import { Bot } from 'lucide-react'

interface TextMessageProps {
  content: string
  role: MessageRole
  isNew?: boolean
  className?: string
}

export function TextMessage({
  content,
  role,
  isNew = false,
  className,
}: TextMessageProps) {
  const isUser = role === 'user'
  const isSystem = role === 'system'

  if (isSystem) {
    // System messages are centered, subtle
    return (
      <div
        className={cn(
          'flex justify-center my-4',
          isNew && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
          className
        )}
      >
        <div
          className={cn(
            'max-w-[90%] px-4 py-2',
            'text-xs text-slate-500 text-center',
            'bg-slate-100/80 rounded-full',
            'font-medium'
          )}
        >
          {content}
        </div>
      </div>
    )
  }

  if (isUser) {
    // User messages - right-aligned, teal accent
    return (
      <div
        className={cn(
          'flex justify-end',
          isNew && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
          className
        )}
      >
        <div
          className={cn(
            // Max width for readability
            'max-w-[85%]',
            // Padding - slightly more generous
            'px-4 py-3',
            // Typography - clean, readable
            'text-[15px] leading-relaxed',
            // Rounded corners - message bubble style
            'rounded-2xl rounded-br-md',
            // User styling - teal background
            'bg-teal-600 text-white',
            // Subtle shadow for depth
            'shadow-sm'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    )
  }

  // Assistant messages - left-aligned with subtle avatar
  return (
    <div
      className={cn(
        'flex items-start gap-3',
        isNew && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* Avatar indicator */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm ring-1 ring-slate-200/50">
        <Bot className="w-4 h-4 text-slate-500" strokeWidth={2} />
      </div>

      <div
        className={cn(
          // Max width for readability
          'max-w-[85%]',
          // Padding - generous for comfort
          'px-4 py-3',
          // Typography - clean, readable
          'text-[15px] leading-relaxed text-slate-700',
          // Rounded corners - message bubble style
          'rounded-2xl rounded-tl-md',
          // Warm background with subtle styling
          'bg-white',
          // Border and shadow for definition
          'border border-slate-200/80',
          'shadow-sm'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </div>
  )
}
