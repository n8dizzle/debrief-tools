'use client'

import { Check, Calendar, MapPin, User, Phone, Mail, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertyData, ProData } from '@/lib/flows'

interface ConfirmationCardProps {
  property?: PropertyData
  scheduledDate?: string
  scheduledTime?: string
  pro?: ProData
  orderId?: string
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

export function ConfirmationCard({
  property,
  scheduledDate,
  scheduledTime,
  pro,
  orderId,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: ConfirmationCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-2 duration-500',
        className
      )}
    >
      {/* Success header */}
      <div className="bg-primary/10 px-4 py-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary mb-3">
          <Check className="h-8 w-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-1">You're all set</h3>
        <p className="text-sm text-muted-foreground">
          Confirmation #{orderId || 'HW-' + Date.now().toString(36).toUpperCase()}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Installation details */}
        <div className="space-y-3">
          {/* Date/Time */}
          {scheduledDate && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Installation</p>
                <p className="font-medium text-foreground">{formatDate(scheduledDate)}</p>
                {scheduledTime && (
                  <p className="text-sm text-muted-foreground">{scheduledTime}</p>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {property && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium text-foreground">
                  {property.street || property.formattedAddress?.split(',')[0]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {property.city}, {property.state}
                </p>
              </div>
            </div>
          )}

          {/* Pro */}
          {pro && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your installer</p>
                <p className="font-medium text-foreground">{pro.name}</p>
                <p className="text-sm text-muted-foreground">
                  Will contact you to confirm
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What's next */}
        <div className="rounded-xl bg-muted/50 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">What happens next</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Confirmation email sent with all details</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{pro?.name || 'Your pro'} will call to confirm the appointment</span>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Balance due after installation is complete</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
