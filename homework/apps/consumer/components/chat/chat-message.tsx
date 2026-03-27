"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage as ChatMessageType, ChatButton } from "@/types/flow"

interface ChatMessageProps {
  message: ChatMessageType
  onButtonClick?: (button: ChatButton) => void
}

export function ChatMessage({ message, onButtonClick }: ChatMessageProps) {
  const isUser = message.role === "user"
  const isLoading = message.isLoading

  return (
    <div
      className={cn(
        "flex animate-in fade-in duration-300",
        isUser
          ? "justify-end slide-in-from-right-4"
          : "justify-start slide-in-from-bottom-4"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {/* Action buttons */}
            {message.buttons && message.buttons.length > 0 && onButtonClick && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.buttons.map((button) => (
                  <button
                    key={button.value}
                    onClick={() => onButtonClick(button)}
                    className="rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
                  >
                    {button.emoji && <span className="mr-1">{button.emoji}</span>}
                    {button.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Typing indicator for when the AI is "thinking"
 */
export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  )
}
