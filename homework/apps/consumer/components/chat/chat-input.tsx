"use client"

import { useRef, useState, forwardRef, useImperativeHandle } from "react"
import { Camera, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSend: (message: string) => void
  onPhotoUpload?: (base64: string, mimeType: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  showCamera?: boolean
}

export interface ChatInputRef {
  focus: () => void
  clear: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  function ChatInput(
    {
      onSend,
      onPhotoUpload,
      disabled = false,
      isLoading = false,
      placeholder = "Type a message...",
      showCamera = false,
    },
    ref
  ) {
    const [message, setMessage] = useState("")
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        setMessage("")
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto'
        }
      },
    }))

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (message.trim() && !disabled && !isLoading) {
        onSend(message.trim())
        setMessage("")
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto'
        }
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (message.trim() && !disabled && !isLoading) {
          handleSubmit(e as unknown as React.FormEvent)
        }
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value)
      // Auto-resize textarea
      e.target.style.height = 'auto'
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onPhotoUpload) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        onPhotoUpload(base64, file.type)
      }
      reader.readAsDataURL(file)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }

    return (
      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        {/* Hidden file input */}
        {showCamera && onPhotoUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        )}

        {/* Camera button */}
        {showCamera && onPhotoUpload && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <Camera className="h-5 w-5" />
            <span className="sr-only">Upload photo</span>
          </Button>
        )}

        {/* Text input - auto-expanding textarea */}
        <textarea
          ref={inputRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none min-h-[44px] max-h-[120px]"
        />

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled || isLoading}
          className="shrink-0 min-h-[44px] min-w-[44px]"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    )
  }
)
