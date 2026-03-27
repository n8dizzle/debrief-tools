"use client"

import { useState } from "react"
import { Camera, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeroInputProps {
  onSubmit: (message: string) => void
  className?: string
}

const PROMPT_TAGS = [
  { label: "AC trouble", value: "I'm having AC trouble" },
  { label: "Water heater issue", value: "I have a water heater issue" },
  { label: "Get pricing", value: "I want to get pricing for a replacement" },
  { label: "Just exploring", value: "I'm just exploring my options" },
]

export function HeroInput({ onSubmit, className }: HeroInputProps) {
  const [message, setMessage] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSubmit(message.trim())
    }
  }

  const handleTagClick = (value: string) => {
    onSubmit(value)
  }

  return (
    <div className={cn("w-full max-w-lg mx-auto space-y-4", className)}>
      {/* Input field */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue..."
            className="w-full rounded-xl border border-border bg-background px-4 py-3.5 pr-24 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Upload photo"
            >
              <Camera className="h-5 w-5" />
            </button>
            <Button
              type="submit"
              size="sm"
              disabled={!message.trim()}
              className="rounded-lg"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Submit</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Quick prompt tags */}
      <div className="flex flex-wrap justify-center gap-2">
        {PROMPT_TAGS.map((tag) => (
          <button
            key={tag.value}
            onClick={() => handleTagClick(tag.value)}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  )
}
