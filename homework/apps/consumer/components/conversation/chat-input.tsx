'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { Camera, ArrowUp, Loader2, X, MapPin, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chip, Prefill, InputType } from '@/lib/flows'

interface ChatInputProps {
  onSend: (message: string, options?: { fromPrefill?: boolean }) => void
  onChipSelect?: (chip: Chip) => void
  onPhotoClick?: () => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  showCamera?: boolean
  autoFocus?: boolean
  /** Pre-populated text with optional source indicator */
  prefill?: Prefill | null
  /** Quick tap options displayed above input */
  chips?: Chip[]
  /** Input type - only affects placeholder now, specialized UIs render as inline cards */
  inputType?: InputType
  /** Visual variant - 'default' has white background, 'hero' is transparent/softer for homepage */
  variant?: 'default' | 'hero'
  className?: string
}

/**
 * Get contextual placeholder based on input type
 * Specialized UIs render as inline cards above, this input is ALWAYS available
 */
function getPlaceholderForInputType(inputType?: InputType, defaultPlaceholder?: string): string {
  switch (inputType) {
    case 'address_autocomplete':
      return 'Type your address or ask a question...'
    case 'calendar':
      return 'Type a date (e.g. "next Tuesday") or ask a question...'
    case 'time_picker':
      return 'Type a time (e.g. "2pm") or ask a question...'
    case 'phone':
      return 'Type your phone number or ask a question...'
    case 'email':
      return 'Type your email or ask a question...'
    case 'camera':
      return 'Describe your system or ask a question...'
    default:
      return defaultPlaceholder || 'Message...'
  }
}

/**
 * ChatInput - The persistent text input that NEVER disappears
 *
 * This is the constant anchor of the conversational experience.
 * Specialized UIs (address autocomplete, calendars, etc.) render as
 * inline cards ABOVE this input in the conversation flow.
 *
 * Users can ALWAYS:
 * - Type freely
 * - Ask questions
 * - Go off-script
 * - Use the specialized card OR just type
 */
export function ChatInput({
  onSend,
  onChipSelect,
  onPhotoClick,
  placeholder,
  disabled = false,
  isLoading = false,
  showCamera = true,
  autoFocus = false,
  prefill,
  chips,
  inputType,
  variant = 'default',
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [showSourceBadge, setShowSourceBadge] = useState(true)
  const [hasEditedPrefill, setHasEditedPrefill] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prefillAppliedRef = useRef<string | null>(null)

  // Resolve placeholder - inputType affects it, but custom placeholder takes precedence
  const resolvedPlaceholder = placeholder || getPlaceholderForInputType(inputType)

  // Apply prefill when it changes
  useEffect(() => {
    if (prefill?.text && prefill.text !== prefillAppliedRef.current) {
      setValue(prefill.text)
      setShowSourceBadge(true)
      setHasEditedPrefill(false)
      prefillAppliedRef.current = prefill.text

      // Select all text so user can easily replace
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.select()
        }
      }, 50)
    } else if (!prefill && prefillAppliedRef.current) {
      // Prefill was removed
      setValue('')
      setShowSourceBadge(false)
      prefillAppliedRef.current = null
    }
  }, [prefill])

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 120)
    textarea.style.height = `${Math.max(44, newHeight)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isLoading) return

    // Check if this is the unmodified prefill
    const isFromPrefill = prefill?.text === trimmed && !hasEditedPrefill

    onSend(trimmed, { fromPrefill: isFromPrefill })
    setValue('')
    setShowSourceBadge(false)
    setHasEditedPrefill(false)
    prefillAppliedRef.current = null

    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }
  }, [value, disabled, isLoading, onSend, prefill, hasEditedPrefill])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // If user modifies the prefill, mark it as edited
    if (prefill?.text && e.target.value !== prefill.text) {
      setHasEditedPrefill(true)
    }
  }, [prefill])

  const handleDismissPrefill = useCallback(() => {
    setValue('')
    setShowSourceBadge(false)
    setHasEditedPrefill(false)
    prefillAppliedRef.current = null
    textareaRef.current?.focus()
  }, [])

  const handleChipClick = useCallback((chip: Chip) => {
    if (onChipSelect) {
      onChipSelect(chip)
    } else {
      // Fallback: send chip label as message
      onSend(chip.label)
    }
  }, [onChipSelect, onSend])

  const canSend = value.trim().length > 0 && !disabled && !isLoading

  // Get source icon
  const SourceIcon = getSourceIcon(prefill?.source)

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full',
        'pb-[env(safe-area-inset-bottom,0px)]',
        className
      )}
    >
      {/* Chips - quick tap options (compact inline style) */}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled || isLoading}
              className={cn(
                'inline-flex items-center',
                'px-3 py-2 rounded-full',
                'text-[13px] font-medium leading-tight',
                'bg-slate-100 border border-slate-200/50',
                'text-slate-600',
                'hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700',
                'active:scale-[0.98]',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:pointer-events-none',
                // Touch target - still accessible
                'min-h-[36px]'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Source Badge - shows where prefill came from */}
      {prefill?.sourceLabel && showSourceBadge && !hasEditedPrefill && (
        <div className="flex items-center gap-2 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div
            className={cn(
              'inline-flex items-center gap-1.5',
              'px-3 py-1.5 rounded-full',
              'text-xs font-medium',
              'bg-teal-50 text-teal-700',
              'border border-teal-200'
            )}
          >
            {SourceIcon && <SourceIcon className="h-3 w-3" />}
            <span>{prefill.sourceLabel}</span>
            {prefill.dismissible !== false && (
              <button
                type="button"
                onClick={handleDismissPrefill}
                className="ml-1 p-0.5 rounded-full hover:bg-teal-100 transition-colors"
                aria-label="Clear suggestion"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Card - ALWAYS renders, never replaced */}
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl',
          'p-2.5',
          'transition-all duration-200',
          // Variant-based styling
          variant === 'default' && [
            'bg-white border border-slate-200',
            'shadow-[0_4px_20px_rgba(0,0,0,0.06)]',
            'focus-within:shadow-[0_4px_24px_rgba(13,148,136,0.12)]',
            'focus-within:border-teal-300'
          ],
          variant === 'hero' && [
            'bg-white/80 backdrop-blur-sm border border-slate-200/60',
            'shadow-[0_2px_12px_rgba(0,0,0,0.04)]',
            'focus-within:bg-white focus-within:shadow-[0_4px_20px_rgba(13,148,136,0.1)]',
            'focus-within:border-teal-300/80'
          ]
        )}
      >
        {/* Camera button */}
        {showCamera && (
          <button
            type="button"
            onClick={onPhotoClick}
            disabled={disabled}
            aria-label="Upload photo"
            className={cn(
              'flex items-center justify-center',
              'h-11 w-11 min-h-[44px] min-w-[44px]',
              'rounded-xl',
              'text-slate-400',
              'hover:bg-slate-100 hover:text-slate-600',
              'active:scale-95',
              'transition-all duration-150',
              'disabled:opacity-40 disabled:pointer-events-none'
            )}
          >
            <Camera className="h-5 w-5" />
          </button>
        )}

        {/* Text input - the constant anchor */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
          className={cn(
            'flex-1 resize-none',
            'min-h-[44px] max-h-[120px]',
            'py-3 px-1',
            'text-base leading-snug',
            'placeholder:text-slate-400',
            'bg-transparent',
            'focus:outline-none',
            'disabled:opacity-50',
            'border-none'
          )}
          style={{ fontSize: '16px' }} // Prevent iOS zoom
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'bg-slate-100 text-slate-400',
            canSend && 'bg-teal-600 text-white shadow-sm',
            canSend && 'hover:bg-teal-700 active:scale-95',
            'transition-all duration-150',
            'disabled:opacity-100'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Hint text when prefill is active */}
      {prefill?.text && value === prefill.text && !hasEditedPrefill && (
        <p className="text-xs text-slate-500 text-center mt-2 animate-in fade-in duration-300">
          Press Enter to confirm, or edit to change
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function getSourceIcon(source?: string) {
  switch (source) {
    case 'location':
      return MapPin
    case 'profile':
      return User
    case 'previous':
      return Clock
    case 'property':
      return MapPin
    default:
      return null
  }
}
