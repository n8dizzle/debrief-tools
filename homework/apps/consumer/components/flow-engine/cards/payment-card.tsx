'use client'

import { useState } from 'react'
import { CreditCard, Lock, Check, ChevronRight, Banknote, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

type PaymentMethod = 'card' | 'financing' | 'bank'

interface PaymentOption {
  id: PaymentMethod
  label: string
  description: string
  icon: 'card' | 'financing' | 'bank'
}

interface PaymentCardProps {
  depositAmount?: number
  totalAmount?: number
  financingAvailable?: boolean
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

const DEFAULT_PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'card',
    label: 'Credit or Debit Card',
    description: 'Pay deposit now, balance after installation',
    icon: 'card',
  },
  {
    id: 'financing',
    label: 'Finance with Affirm',
    description: '0% APR for 12 months with approved credit',
    icon: 'financing',
  },
]

const ICON_MAP = {
  card: CreditCard,
  financing: Calendar,
  bank: Banknote,
}

export function PaymentCard({
  depositAmount = 500,
  totalAmount,
  financingAvailable = true,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: PaymentCardProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    typeof selectedValue === 'string' ? (selectedValue as PaymentMethod) : null
  )
  const [isProcessing, setIsProcessing] = useState(false)

  // Helper flag for showing financing details
  const showFinancingDetails = selectedMethod === 'financing' && financingAvailable
  const showMonthlyPayment = typeof totalAmount === 'number' && totalAmount > 0
  const hasSelectedValue = selectedValue !== undefined && selectedValue !== null

  const paymentOptions = DEFAULT_PAYMENT_OPTIONS.filter(
    (opt) => opt.id !== 'financing' || financingAvailable
  )

  const handleSelectMethod = (method: PaymentMethod) => {
    if (completed || isProcessing) return
    setSelectedMethod(method)
  }

  const handleProceed = async () => {
    if (!selectedMethod || completed || isProcessing) return

    setIsProcessing(true)

    // In production, this would:
    // 1. For 'card': Initialize Stripe Elements or redirect to Stripe Checkout
    // 2. For 'financing': Redirect to Affirm/financing partner
    // 3. For 'bank': Initialize ACH payment flow

    // For now, simulate processing and call onSelect
    setTimeout(() => {
      setIsProcessing(false)

      const option = paymentOptions.find((o) => o.id === selectedMethod)
      onSelect?.(
        { method: selectedMethod, amount: depositAmount },
        `${option?.label || selectedMethod} - $${depositAmount} deposit`
      )
    }, 500)
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed ? 'border-primary/30 bg-primary/5' : 'border-border',
        className
      )}
    >
      {/* Header */}
      <div className="bg-primary/5 border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Secure Payment</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Deposit due today</p>
            <p className="font-bold text-foreground">${depositAmount}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Payment method selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Choose payment method
          </p>
          {paymentOptions.map((option) => {
            const isSelected = selectedMethod === option.id
            const Icon = ICON_MAP[option.icon]

            return (
              <button
                key={option.id}
                onClick={() => handleSelectMethod(option.id)}
                disabled={completed || isProcessing}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-3',
                  'transition-all duration-150',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/30',
                  completed && 'cursor-default',
                  isProcessing && 'cursor-wait opacity-70'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                    isSelected ? 'bg-primary/20' : 'bg-muted'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground text-sm">
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Financing details */}
        {showFinancingDetails && (
          <div className="rounded-xl bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">
              Financing with Affirm
            </p>
            {showMonthlyPayment && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Est. monthly payment
                </span>
                <span className="font-medium text-foreground">
                  ${Math.round((totalAmount ?? 0) / 12)}/mo
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Subject to credit approval. See terms at checkout.
            </p>
          </div>
        )}

        {/* Proceed button */}
        {!completed && (
          <button
            onClick={handleProceed}
            disabled={!selectedMethod || isProcessing}
            className={cn(
              'w-full rounded-xl py-3 px-4',
              'font-medium text-sm',
              'transition-all duration-200',
              'flex items-center justify-center gap-2',
              selectedMethod && !isProcessing
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                Continue to Payment
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}

        {/* Completed state */}
        {completed && hasSelectedValue && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-sm text-primary">
            <Check className="h-4 w-4" />
            <span>Payment method selected</span>
          </div>
        )}

        {/* Security note */}
        <p className="text-xs text-center text-muted-foreground">
          <Lock className="inline h-3 w-3 mr-1" />
          256-bit encrypted. Your payment info is never stored.
        </p>
      </div>
    </div>
  )
}
