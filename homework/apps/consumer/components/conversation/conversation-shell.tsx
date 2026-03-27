'use client'

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { ChatInput } from './chat-input'
import { MessageList } from './message-list'
import type { ConversationMessage, ChipButton } from '@/types/conversation'

// Context for ambient content slot
interface ConversationContextValue {
  hasAmbient: boolean
}

const ConversationContext = createContext<ConversationContextValue>({
  hasAmbient: false,
})

interface ConversationShellProps {
  messages: ConversationMessage[]
  onSendMessage: (message: string) => void
  onChipSelect?: (button: ChipButton, messageId: string) => void
  onPhotoClick?: () => void
  isTyping?: boolean
  inputPlaceholder?: string
  inputDisabled?: boolean
  showInput?: boolean
  showCamera?: boolean
  autoFocusInput?: boolean
  children?: ReactNode
  className?: string
}

export function ConversationShell({
  messages,
  onSendMessage,
  onChipSelect,
  onPhotoClick,
  isTyping = false,
  inputPlaceholder,
  inputDisabled = false,
  showInput = true,
  showCamera = true,
  autoFocusInput = false,
  children,
  className,
}: ConversationShellProps) {
  const mainRef = useRef<HTMLDivElement>(null)

  return (
    <ConversationContext.Provider value={{ hasAmbient: !!children }}>
      <div
        ref={mainRef}
        className={cn(
          // Full height container
          'flex flex-col',
          'min-h-dvh',
          // Background
          'bg-gradient-to-b from-secondary via-secondary to-background',
          className
        )}
      >
        {/* Main scrollable area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Ambient content slot (hero, property panel, etc.) */}
          {children}

          {/* Messages */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full">
                <MessageList
                  messages={messages}
                  onChipSelect={onChipSelect}
                  isTyping={isTyping}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky input at bottom */}
        {showInput && (
          <div
            className={cn(
              // Sticky positioning
              'sticky bottom-0 left-0 right-0',
              // Background gradient for fade effect
              'bg-gradient-to-t from-background via-background to-transparent',
              // Padding
              'px-4 pt-4 pb-4',
              // Z-index to stay above content
              'z-10'
            )}
          >
            <div className="max-w-2xl mx-auto">
              <ChatInput
                onSend={onSendMessage}
                onPhotoClick={onPhotoClick}
                placeholder={inputPlaceholder}
                disabled={inputDisabled}
                isLoading={isTyping}
                showCamera={showCamera}
                autoFocus={autoFocusInput}
              />
            </div>
          </div>
        )}
      </div>
    </ConversationContext.Provider>
  )
}

// Ambient content wrapper - for hero sections, side content, etc.
interface AmbientProps {
  children: ReactNode
  visible?: boolean
  className?: string
}

function Ambient({ children, visible = true, className }: AmbientProps) {
  if (!visible) return null

  return (
    <div
      className={cn(
        // Shrink to fit content, not flex-1
        'shrink-0',
        className
      )}
    >
      {children}
    </div>
  )
}

// Attach Ambient as static property
ConversationShell.Ambient = Ambient

// Hook for checking ambient state
export function useConversationContext() {
  return useContext(ConversationContext)
}
