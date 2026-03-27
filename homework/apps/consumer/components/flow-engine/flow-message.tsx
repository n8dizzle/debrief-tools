'use client'

import type { FlowStep, FlowHistoryEntry, StepResponse, FlowContext } from '@/lib/flows'
import { TextMessage } from '@/components/conversation/messages/text-message'
import { FlowCard } from './flow-card'
import { cn } from '@/lib/utils'

interface FlowMessageProps {
  /** The AI prompt that was shown */
  prompt: string
  /** The user's response */
  response: StepResponse
  /** Step ID for reference */
  stepId: string
  /** The step definition (for card rendering) */
  step?: FlowStep
  /** Flow context for card props */
  context?: FlowContext
  /** Additional class name */
  className?: string
}

/**
 * Renders a completed flow step as AI message + user response
 */
export function FlowMessage({
  prompt,
  response,
  stepId,
  step,
  context,
  className,
}: FlowMessageProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* AI Message */}
      <TextMessage content={prompt} role="assistant" />

      {/* Card (if step had one and it should persist in history) */}
      {step?.card && shouldShowCardInHistory(step.card) && context && (
        <div className="max-w-[85%]">
          <FlowCard
            cardType={step.card}
            props={getCardProps(step, context)}
            completed
            selectedValue={response.value}
          />
        </div>
      )}

      {/* User Response */}
      <TextMessage content={response.displayText} role="user" />
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Some cards should persist in history (like PropertyCard showing the home)
 * Others collapse to just the user's text response (like simple chip selections)
 */
function shouldShowCardInHistory(cardType: string): boolean {
  const persistentCards = [
    'PropertyCard',
    'SizingCard',
    'OrderSummaryCard',
    'ConfirmationCard',
  ]
  return persistentCards.includes(cardType)
}

function getCardProps(step: FlowStep, ctx: FlowContext): Record<string, unknown> {
  if (!step.cardProps) return {}

  if (typeof step.cardProps === 'function') {
    return step.cardProps(ctx)
  }

  return step.cardProps
}
