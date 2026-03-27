'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mail, ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chip } from '@/lib/flows'

interface EmailInputProps {
  onSubmit: (email: string) => void
  onChipSelect?: (chip: Chip) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  initialValue?: string
  chips?: Chip[]
  className?: string
}

// Basic email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function EmailInput({
  onSubmit,
  onChipSelect,
  placeholder = 'Enter your email...',
  disabled = false,
  isLoading = false,
  initialValue = '',
  chips,
  className,
}: EmailInputProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    if (error) setError(null)
  }, [error])

  const handleBlur = useCallback(() => {
    setTouched(true)
    if (value && !isValidEmail(value)) {
      setError('Please enter a valid email address')
    }
  }, [value])

  const handleSubmit = useCallback(() => {
    if (disabled || isLoading) return

    if (!value.trim()) {
      setError('Email is required')
      return
    }

    if (!isValidEmail(value)) {
      setError('Please enter a valid email address')
      return
    }

    onSubmit(value.trim())
  }, [value, disabled, isLoading, onSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleChipClick = useCallback((chip: Chip) => {
    onChipSelect?.(chip)
  }, [onChipSelect])

  const canSend = value.trim().length > 0 && !disabled && !isLoading
  const showError = error || (touched && value && !isValidEmail(value))

  return (
    <div className={cn('relative w-full pb-[env(safe-area-inset-bottom,0px)]', className)}>
      {/* Chips */}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled || isLoading}
              className={cn(
                'inline-flex items-center gap-1.5',
                'px-4 py-2.5 rounded-full',
                'text-sm font-medium',
                'bg-card border border-border',
                'text-foreground',
                'hover:bg-muted hover:border-primary/30',
                'active:scale-[0.98]',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:pointer-events-none',
                'min-h-[44px]'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Card */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl',
          'bg-card border',
          showError ? 'border-destructive' : 'border-border',
          'shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
          'p-2',
          'transition-shadow duration-200',
          'focus-within:shadow-[0_2px_20px_rgba(13,148,136,0.15)]',
          !showError && 'focus-within:border-primary/30'
        )}
      >
        {/* Email icon */}
        <div
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'text-muted-foreground'
          )}
        >
          <Mail className="h-5 w-5" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Email input"
          aria-invalid={!!showError}
          className={cn(
            'flex-1',
            'min-h-[44px]',
            'py-3 px-1',
            'text-base leading-snug',
            'placeholder:text-muted-foreground/60',
            'bg-transparent',
            'focus:outline-none',
            'disabled:opacity-50',
            'border-none'
          )}
          style={{ fontSize: '16px' }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Submit email"
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'bg-muted text-muted-foreground',
            canSend && 'bg-primary text-primary-foreground',
            canSend && 'hover:bg-primary/90 active:scale-95',
            'transition-all duration-150',
            'disabled:opacity-100'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Error message */}
      {showError && (
        <p className="text-xs text-destructive mt-2 animate-in fade-in duration-200">
          {error || 'Please enter a valid email address'}
        </p>
      )}

      {/* Valid indicator */}
      {value && isValidEmail(value) && (
        <p className="text-xs text-primary/70 text-center mt-2 animate-in fade-in duration-200">
          Press Enter to confirm
        </p>
      )}
    </div>
  )
}
