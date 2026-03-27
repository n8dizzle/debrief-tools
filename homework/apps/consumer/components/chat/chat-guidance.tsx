"use client"

import { Check } from "lucide-react"
import type { ChatMessage } from "@/types/flow"

interface GuidanceContent {
  title: string
  tips: string[]
  currentStep?: string
}

interface ChatGuidanceProps {
  content: GuidanceContent
  recentMessages?: ChatMessage[]
}

export function ChatGuidance({ content, recentMessages }: ChatGuidanceProps) {
  // Get last few messages for context (read-only display)
  const displayMessages = recentMessages?.slice(-3) || []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">{content.title}</h2>
        {content.currentStep && (
          <p className="text-sm text-muted-foreground">{content.currentStep}</p>
        )}
      </div>

      {/* Recent conversation (read-only) */}
      {displayMessages.length > 0 && (
        <div className="p-4 space-y-3 opacity-60 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent conversation
          </p>
          <div className="space-y-2">
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={`text-sm p-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary/10 text-foreground ml-4"
                    : "bg-muted text-foreground mr-4"
                }`}
              >
                <p className="line-clamp-2">{message.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="flex-1 p-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tips
          </p>
          <ul className="space-y-2">
            {content.tips.map((tip, i) => (
              <li
                key={i}
                className="text-sm text-foreground flex items-start gap-2"
              >
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disabled input indicator */}
      <div className="p-4 border-t border-border">
        <div className="text-center text-sm text-muted-foreground py-2">
          Complete this step to continue chatting
        </div>
      </div>
    </div>
  )
}
