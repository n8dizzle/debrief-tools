'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Phone, ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chip } from '@/lib/flows'

interface PhoneInputProps {
  onSubmit: (phone: string) => void
  onChipSelect?: (chip: Chip) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  initialValue?: string
  chips?: Chip[]
  className?: string
}

// Format phone as (XXX) XXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Extract just digits
function getDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// Validate phone (must be 10 digits)
function isValidPhone(value: string): boolean {
  return getDigits(value).length === 10
}

export function PhoneInput({
  onSubmit,
  onChipSelect,
  placeholder = 'Enter your phone number...',
  disabled = false,
  isLoading = false,
  initialValue = '',
  chips,
  className,
}: PhoneInputProps) {
  const [value, setValue] = useState(() => formatPhone(initialValue))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setValue(formatted)
    setError(null)
  }, [])

  const handleSubmit = useCallback(() => {
    if (disabled || isLoading) return

    if (!isValidPhone(value)) {
      setError('Please enter a valid 10-digit phone number')
      return
    }

    onSubmit(value)
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

  const canSend = isValidPhone(value) && !disabled && !isLoading

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
          error ? 'border-destructive' : 'border-border',
          'shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
          'p-2',
          'transition-shadow duration-200',
          'focus-within:shadow-[0_2px_20px_rgba(13,148,136,0.15)]',
          !error && 'focus-within:border-primary/30'
        )}
      >
        {/* Phone icon */}
        <div
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'text-muted-foreground'
          )}
        >
          <Phone className="h-5 w-5" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Phone number input"
          aria-invalid={!!error}
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
          aria-label="Submit phone number"
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
      {error && (
        <p className="text-xs text-destructive mt-2 animate-in fade-in duration-200">
          {error}
        </p>
      )}

      {/* Format hint */}
      {!error && value.length > 0 && !isValidPhone(value) && (
        <p className="text-xs text-muted-foreground/70 text-center mt-2">
          Format: (555) 555-5555
        </p>
      )}
    </div>
  )
}
