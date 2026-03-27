'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useFlowEngine, executeAction } from '@/lib/flows'
import type { FlowStep, StepResponse, Chip, Prefill } from '@/lib/flows'
import { FlowMessage } from './flow-message'
import { FlowCard } from './flow-card'
import { TextMessage } from '@/components/conversation/messages/text-message'
import { LoadingMessage } from '@/components/conversation/messages/loading-message'
import { cn } from '@/lib/utils'

interface FlowRendererProps {
  /** Callback when chips/prefill change (to update ChatInput) */
  onInputConfigChange?: (config: InputConfig) => void
  /** Callback when flow completes */
  onFlowComplete?: () => void
  /** Additional class name */
  className?: string
}

export interface InputConfig {
  chips?: Chip[]
  prefill?: Prefill | null
  inputType?: string
  placeholder?: string
  disabled?: boolean
}

export function FlowRenderer({
  onInputConfigChange,
  onFlowComplete,
  className,
}: FlowRendererProps) {
  const {
    activeFlow,
    currentStepId,
    history,
    isProcessing,
    getContext,
    getCurrentStep,
    completeStep,
    advanceToStep,
    setProcessing,
    setError,
  } = useFlowEngine()

  const scrollRef = useRef<HTMLDivElement>(null)
  const hasNotifiedComplete = useRef(false)

  // Get current step
  const currentStep = getCurrentStep()
  const ctx = getContext()

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history, currentStepId, isProcessing])

  // Notify parent of input config changes
  useEffect(() => {
    if (!currentStep || !onInputConfigChange) return

    const prefill = getPrefillForStep(currentStep, ctx)

    onInputConfigChange({
      chips: currentStep.chips,
      prefill,
      inputType: currentStep.inputType,
      placeholder: getPlaceholderForStep(currentStep),
      disabled: isProcessing,
    })
  }, [currentStep, ctx, isProcessing, onInputConfigChange])

  // Check for flow completion
  useEffect(() => {
    if (currentStepId === null && history.length > 0 && !hasNotifiedComplete.current) {
      hasNotifiedComplete.current = true
      onFlowComplete?.()
    }
  }, [currentStepId, history.length, onFlowComplete])

  // Run step action if needed
  useEffect(() => {
    if (!currentStep?.action || isProcessing) return

    const runAction = async () => {
      setProcessing(true)
      const result = await executeAction(currentStep.action!, ctx)
      setProcessing(false)

      if (!result.success) {
        setError(result.error || 'Action failed')
        return
      }

      // Auto-advance if step is configured for it
      if (currentStep.autoAdvance) {
        const nextStepId = getNextStepId(currentStep, null, ctx)
        if (nextStepId) {
          advanceToStep(nextStepId)
        }
      }
    }

    runAction()
  }, [currentStepId]) // Only run when step changes

  // Handle user response (called from parent via ChatInput)
  const handleResponse = useCallback(
    async (displayText: string, value: unknown, options?: { fromChip?: boolean; fromPrefill?: boolean; fromCard?: boolean }) => {
      if (!currentStep || !currentStepId) return

      const response: StepResponse = {
        displayText,
        value,
        fromChip: options?.fromChip,
        fromPrefill: options?.fromPrefill,
        fromCard: options?.fromCard,
      }

      // If step has an action that runs on response
      if (currentStep.action && !currentStep.autoAdvance) {
        setProcessing(true)
        const result = await executeAction(currentStep.action, ctx, response)
        setProcessing(false)

        if (!result.success) {
          setError(result.error || 'Action failed')
          return
        }
      }

      // Complete the step
      completeStep(currentStepId, response)
    },
    [currentStep, currentStepId, ctx, completeStep, setProcessing, setError]
  )

  // Handle chip selection
  const handleChipSelect = useCallback(
    (chip: Chip) => {
      // If chip has an action, run it
      if (chip.action) {
        executeAction(chip.action, ctx)
        return
      }

      handleResponse(chip.label, chip.value, { fromChip: true })
    },
    [ctx, handleResponse]
  )

  // Handle card selection
  const handleCardSelect = useCallback(
    (value: unknown, displayText: string) => {
      handleResponse(displayText, value, { fromCard: true })
    },
    [handleResponse]
  )

  if (!activeFlow) {
    return null
  }

  // Get prompt text for current step
  const currentPrompt = currentStep
    ? typeof currentStep.prompt === 'function'
      ? currentStep.prompt(ctx)
      : currentStep.prompt
    : null

  // Check if current step should be shown (condition check)
  const shouldShowCurrentStep = currentStep
    ? !currentStep.condition || currentStep.condition(ctx)
    : false

  // If condition fails, auto-advance
  useEffect(() => {
    if (currentStep && !shouldShowCurrentStep) {
      const nextStepId = getNextStepId(currentStep, null, ctx)
      if (nextStepId) {
        advanceToStep(nextStepId)
      }
    }
  }, [currentStep, shouldShowCurrentStep, ctx, advanceToStep])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Render history */}
      {history.map((entry, index) => (
        <FlowMessage
          key={`${entry.stepId}-${index}`}
          prompt={entry.prompt}
          response={entry.response}
          stepId={entry.stepId}
          // Find the step to get card info
          step={activeFlow.steps.find((s) => s.id === entry.stepId)}
          context={ctx}
        />
      ))}

      {/* Render current step */}
      {currentStep && shouldShowCurrentStep && (
        <>
          {/* AI Message */}
          <TextMessage content={currentPrompt || ''} role="assistant" />

          {/* Inline Card (if any) */}
          {currentStep.card && (
            <div className="max-w-[85%]">
              <FlowCard
                cardType={currentStep.card}
                props={getCardProps(currentStep, ctx)}
                onSelect={handleCardSelect}
              />
            </div>
          )}
        </>
      )}

      {/* Loading indicator */}
      {isProcessing && <LoadingMessage />}

      {/* Scroll anchor */}
      <div ref={scrollRef} />
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function getPrefillForStep(step: FlowStep, ctx: any): Prefill | null {
  if (!step.prefill) return null

  if (typeof step.prefill === 'function') {
    return step.prefill(ctx)
  }

  return step.prefill
}

function getPlaceholderForStep(step: FlowStep): string {
  switch (step.inputType) {
    case 'address_autocomplete':
      return 'Enter your address...'
    case 'email':
      return 'Enter your email...'
    case 'phone':
      return 'Enter your phone number...'
    case 'camera':
      return 'Tap to take a photo...'
    default:
      return 'Type your response...'
  }
}

function getCardProps(step: FlowStep, ctx: any): Record<string, unknown> {
  if (!step.cardProps) return {}

  if (typeof step.cardProps === 'function') {
    return step.cardProps(ctx)
  }

  return step.cardProps
}

function getNextStepId(step: FlowStep, response: StepResponse | null, ctx: any): string | null {
  if (typeof step.next === 'function') {
    return step.next(response!, ctx)
  }
  return step.next
}

// =============================================================================
// Export handler for ChatInput integration
// =============================================================================

export type FlowResponseHandler = (
  displayText: string,
  value: unknown,
  options?: { fromChip?: boolean; fromPrefill?: boolean; fromCard?: boolean }
) => Promise<void>
