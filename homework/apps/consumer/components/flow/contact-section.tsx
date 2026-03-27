"use client"

import { useState } from "react"
import { Phone, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"
import { cn } from "@/lib/utils"

interface ContactSectionProps {
  onContinue?: () => void
  className?: string
}

export function ContactSection({ onContinue, className }: ContactSectionProps) {
  const setContactInfo = useFlowStore((s) => s.setContactInfo)
  const storedName = useFlowStore((s) => s.customerName)
  const storedPhone = useFlowStore((s) => s.customerPhone)

  const [name, setName] = useState(storedName || "")
  const [phone, setPhone] = useState(storedPhone || "")
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})

  // Format phone number as user types
  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "")

    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }))
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }))
    }
  }

  const validateForm = () => {
    const newErrors: { name?: string; phone?: string } = {}

    if (!name.trim()) {
      newErrors.name = "Please enter your name"
    }

    // Phone should have at least 10 digits
    const phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits.length < 10) {
      newErrors.phone = "Please enter a valid phone number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = () => {
    if (validateForm()) {
      setContactInfo(name.trim(), phone)
      onContinue?.()
    }
  }

  return (
    <div className={cn("space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">
          How can we reach you?
        </h2>
        <p className="text-muted-foreground">
          The contractor will text to confirm installation details
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto space-y-4">
        {/* Name field */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Your name
          </label>
          <div className={cn(
            "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
            errors.name ? "border-destructive" : "border-border focus-within:border-primary"
          )}>
            <User className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Jane Smith"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="name"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Phone field */}
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Phone number
          </label>
          <div className={cn(
            "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
            errors.phone ? "border-destructive" : "border-border focus-within:border-primary"
          )}>
            <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="tel"
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone}</p>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div className="max-w-md mx-auto">
        <Button
          onClick={handleContinue}
          className="w-full"
          size="lg"
        >
          Continue to checkout
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          We'll only use this to coordinate your installation
        </p>
      </div>
    </div>
  )
}
