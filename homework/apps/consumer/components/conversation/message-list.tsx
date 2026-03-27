'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { ConversationMessage, ChipButton } from '@/types/conversation'
import { TextMessage, ChipMessage, LoadingMessage } from './messages'

interface MessageListProps {
  messages: ConversationMessage[]
  onChipSelect?: (button: ChipButton, messageId: string) => void
  isTyping?: boolean
  className?: string
}

export function MessageList({
  messages,
  onChipSelect,
  isTyping = false,
  className,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isTyping])

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto',
        // Padding for content
        'px-4 py-4',
        // Space for messages
        'space-y-3',
        className
      )}
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      {messages.map((message, index) => {
        const isNew = index === messages.length - 1

        // Loading message
        if (message.type === 'loading' || message.isLoading) {
          return <LoadingMessage key={message.id} />
        }

        // Text message with optional chips below
        return (
          <div key={message.id} className="space-y-2">
            {/* Text content */}
            {message.content && (
              <TextMessage
                content={message.content}
                role={message.role}
                isNew={isNew}
              />
            )}

            {/* Chip buttons (if present and assistant message) */}
            {message.buttons && message.buttons.length > 0 && message.role === 'assistant' && (
              <div className="pl-0 pt-1">
                <ChipMessage
                  buttons={message.buttons}
                  onSelect={(button) => onChipSelect?.(button, message.id)}
                  isNew={isNew}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Show typing indicator when AI is thinking */}
      {isTyping && <LoadingMessage />}

      {/* Scroll anchor */}
      <div ref={endRef} className="h-px" />
    </div>
  )
}
