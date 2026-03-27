'use client'

import { useState, useCallback } from 'react'
import { User, Phone, Mail, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContactInfo {
  name?: string
  phone?: string
  email?: string
}

interface ContactCardProps {
  initialData?: ContactInfo
  requiredFields?: ('name' | 'phone' | 'email')[]
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Phone formatting helper
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Validation helpers
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10
}

export function ContactCard({
  initialData = {},
  requiredFields = ['name', 'phone', 'email'],
  onSelect,
  completed = false,
  selectedValue,
  className,
}: ContactCardProps) {
  const [formData, setFormData] = useState<ContactInfo>(() => {
    if (typeof selectedValue === 'object' && selectedValue !== null) {
      return selectedValue as ContactInfo
    }
    return initialData
  })

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  const handleChange = useCallback((field: keyof ContactInfo, value: string) => {
    if (completed) return

    let formattedValue = value
    if (field === 'phone') {
      formattedValue = formatPhone(value)
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }))
  }, [completed])

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  const getError = useCallback((field: keyof ContactInfo): string | null => {
    if (!touched[field] && !submitted) return null

    const value = formData[field] || ''
    const isRequired = requiredFields.includes(field)

    if (isRequired && !value.trim()) {
      return 'Required'
    }

    if (field === 'email' && value && !isValidEmail(value)) {
      return 'Invalid email'
    }

    if (field === 'phone' && value && !isValidPhone(value)) {
      return 'Invalid phone'
    }

    return null
  }, [formData, touched, submitted, requiredFields])

  const isValid = useCallback((): boolean => {
    return requiredFields.every((field) => {
      const value = formData[field] || ''
      if (!value.trim()) return false
      if (field === 'email' && !isValidEmail(value)) return false
      if (field === 'phone' && !isValidPhone(value)) return false
      return true
    })
  }, [formData, requiredFields])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)

    if (!isValid()) return

    const displayParts: string[] = []
    if (formData.name) displayParts.push(formData.name)
    if (formData.phone) displayParts.push(formData.phone)
    if (formData.email) displayParts.push(formData.email)

    onSelect?.(formData, displayParts.join(' • '))
  }, [formData, isValid, onSelect])

  const nameError = getError('name')
  const phoneError = getError('phone')
  const emailError = getError('email')

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-4',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30 bg-primary/5' : 'border-border',
        className
      )}
    >
      <div className="space-y-4">
        {/* Name field */}
        {requiredFields.includes('name') && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="h-4 w-4 text-muted-foreground" />
              Name
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              disabled={completed}
              placeholder="Your full name"
              className={cn(
                'w-full rounded-xl border px-4 py-3',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                'transition-colors duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                nameError
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border bg-background hover:border-primary/30 focus:border-primary'
              )}
            />
            {nameError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {nameError}
              </p>
            )}
          </div>
        )}

        {/* Phone field */}
        {requiredFields.includes('phone') && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
              disabled={completed}
              placeholder="(555) 555-5555"
              className={cn(
                'w-full rounded-xl border px-4 py-3',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                'transition-colors duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                phoneError
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border bg-background hover:border-primary/30 focus:border-primary'
              )}
            />
            {phoneError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {phoneError}
              </p>
            )}
          </div>
        )}

        {/* Email field */}
        {requiredFields.includes('email') && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              disabled={completed}
              placeholder="you@example.com"
              className={cn(
                'w-full rounded-xl border px-4 py-3',
                'text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                'transition-colors duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                emailError
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border bg-background hover:border-primary/30 focus:border-primary'
              )}
            />
            {emailError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {emailError}
              </p>
            )}
          </div>
        )}

        {/* Submit button */}
        {!completed && (
          <button
            onClick={handleSubmit}
            disabled={!isValid()}
            className={cn(
              'w-full rounded-xl py-3 px-4',
              'font-medium text-sm',
              'transition-all duration-200',
              'flex items-center justify-center gap-2',
              isValid()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Check className="h-4 w-4" />
            Confirm Contact Info
          </button>
        )}

        {/* Completed state */}
        {completed && formData && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-sm text-primary">
            <Check className="h-4 w-4" />
            <span>Contact info confirmed</span>
          </div>
        )}
      </div>
    </div>
  )
}
