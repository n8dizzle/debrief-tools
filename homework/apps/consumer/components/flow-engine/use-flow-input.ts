'use client'

import { useState, useCallback, useRef } from 'react'
import { useFlowEngine, executeAction } from '@/lib/flows'
import type { Chip, Prefill, StepResponse } from '@/lib/flows'

export interface ValidationMessage {
  id: string
  content: string
  timestamp: Date
}

/**
 * Hook that provides input handling for the flow engine.
 * Use this to connect ChatInput to FlowRenderer.
 */
export function useFlowInput() {
  const {
    activeFlow,
    currentStepId,
    isProcessing,
    getContext,
    getCurrentStep,
    completeStep,
    setProcessing,
    setError,
    setProperty,
    setCalculatedTonnage,
    setMatchedPros,
    setPricingOptions,
  } = useFlowEngine()

  // Track validation messages that should be shown
  const [validationMessages, setValidationMessages] = useState<ValidationMessage[]>([])

  const currentStep = getCurrentStep()
  const ctx = getContext()

  // Get current input configuration
  const getInputConfig = useCallback(() => {
    if (!currentStep) {
      return {
        chips: undefined,
        prefill: undefined,
        inputType: undefined,
        placeholder: 'Message...',
        disabled: isProcessing || !activeFlow,
      }
    }

    // Resolve prefill
    let prefill: Prefill | null = null
    if (currentStep.prefill) {
      prefill = typeof currentStep.prefill === 'function'
        ? currentStep.prefill(ctx)
        : currentStep.prefill
    }

    // Get placeholder
    let placeholder = 'Type your response...'
    switch (currentStep.inputType) {
      case 'address_autocomplete':
        placeholder = 'Enter your address...'
        break
      case 'email':
        placeholder = 'Enter your email...'
        break
      case 'phone':
        placeholder = 'Enter your phone number...'
        break
      case 'camera':
        placeholder = 'Tap to take a photo...'
        break
    }

    return {
      chips: currentStep.chips,
      prefill,
      inputType: currentStep.inputType,
      placeholder,
      disabled: isProcessing,
    }
  }, [currentStep, ctx, isProcessing, activeFlow])

  // Add a validation message
  const addValidationMessage = useCallback((content: string) => {
    const message: ValidationMessage = {
      id: `val-${Date.now()}`,
      content,
      timestamp: new Date(),
    }
    setValidationMessages(prev => [...prev, message])
  }, [])

  // Clear validation messages
  const clearValidationMessages = useCallback(() => {
    setValidationMessages([])
  }, [])

  // Handle text input submission
  const handleSubmit = useCallback(
    async (text: string, options?: { fromPrefill?: boolean }) => {
      if (!currentStep || !currentStepId || isProcessing) return

      const response: StepResponse = {
        displayText: text,
        value: text,
        fromPrefill: options?.fromPrefill,
      }

      // Check if text matches a chip
      const matchedChip = currentStep.chips?.find(
        (c) => c.label.toLowerCase() === text.toLowerCase() ||
               c.value.toLowerCase() === text.toLowerCase()
      )

      if (matchedChip) {
        response.fromChip = true
        response.value = matchedChip.value
        response.displayText = matchedChip.label
      }

      // Run validation if step has one
      if (currentStep.validate && !matchedChip) {
        const validationResult = currentStep.validate(response, ctx)
        if (!validationResult.valid) {
          // Add validation message as an AI response
          if (validationResult.message) {
            addValidationMessage(validationResult.message)
          }
          // Stay on the step if stayOnStep is true
          if (validationResult.stayOnStep) {
            return
          }
        }
      }

      // Run action if step has one
      if (currentStep.action) {
        setProcessing(true)
        const result = await executeAction(currentStep.action, ctx, response)
        setProcessing(false)

        if (!result.success) {
          setError(result.error || 'Something went wrong')
          return
        }

        // Apply context updates from action result
        if (result.contextUpdates) {
          if (result.contextUpdates.property) {
            setProperty(result.contextUpdates.property)
          }
          if (result.contextUpdates.calculatedTonnage) {
            setCalculatedTonnage(result.contextUpdates.calculatedTonnage)
          }
          if (result.contextUpdates.matchedPros) {
            setMatchedPros(result.contextUpdates.matchedPros)
          }
          if (result.contextUpdates.pricingOptions) {
            setPricingOptions(result.contextUpdates.pricingOptions)
          }
        }
      }

      // Complete the step
      completeStep(currentStepId, response)
    },
    [currentStep, currentStepId, ctx, isProcessing, completeStep, setProcessing, setError, addValidationMessage, setProperty, setCalculatedTonnage, setMatchedPros, setPricingOptions]
  )

  // Handle chip selection
  const handleChipSelect = useCallback(
    async (chip: Chip) => {
      if (!currentStep || !currentStepId || isProcessing) return

      // If chip has an action (like auth), run it
      if (chip.action) {
        setProcessing(true)
        await executeAction(chip.action, ctx)
        setProcessing(false)
        return
      }

      const response: StepResponse = {
        displayText: chip.label,
        value: chip.value,
        fromChip: true,
      }

      // Run step action if present
      if (currentStep.action) {
        setProcessing(true)
        const result = await executeAction(currentStep.action, ctx, response)
        setProcessing(false)

        if (!result.success) {
          setError(result.error || 'Something went wrong')
          return
        }

        // Apply context updates from action result
        if (result.contextUpdates) {
          if (result.contextUpdates.property) {
            setProperty(result.contextUpdates.property)
          }
          if (result.contextUpdates.calculatedTonnage) {
            setCalculatedTonnage(result.contextUpdates.calculatedTonnage)
          }
          if (result.contextUpdates.matchedPros) {
            setMatchedPros(result.contextUpdates.matchedPros)
          }
          if (result.contextUpdates.pricingOptions) {
            setPricingOptions(result.contextUpdates.pricingOptions)
          }
        }
      }

      // Complete the step
      completeStep(currentStepId, response)
    },
    [currentStep, currentStepId, ctx, isProcessing, completeStep, setProcessing, setError, setProperty, setCalculatedTonnage, setMatchedPros, setPricingOptions]
  )

  // Handle card selection
  const handleCardSelect = useCallback(
    async (value: unknown, displayText: string) => {
      if (!currentStep || !currentStepId || isProcessing) return

      const response: StepResponse = {
        displayText,
        value,
        fromCard: true,
      }

      // Run step action if present
      if (currentStep.action) {
        setProcessing(true)
        const result = await executeAction(currentStep.action, ctx, response)
        setProcessing(false)

        if (!result.success) {
          setError(result.error || 'Something went wrong')
          return
        }

        // Apply context updates from action result
        if (result.contextUpdates) {
          if (result.contextUpdates.property) {
            setProperty(result.contextUpdates.property)
          }
          if (result.contextUpdates.calculatedTonnage) {
            setCalculatedTonnage(result.contextUpdates.calculatedTonnage)
          }
          if (result.contextUpdates.matchedPros) {
            setMatchedPros(result.contextUpdates.matchedPros)
          }
          if (result.contextUpdates.pricingOptions) {
            setPricingOptions(result.contextUpdates.pricingOptions)
          }
        }
      }

      // Complete the step
      completeStep(currentStepId, response)
    },
    [currentStep, currentStepId, ctx, isProcessing, completeStep, setProcessing, setError, setProperty, setCalculatedTonnage, setMatchedPros, setPricingOptions]
  )

  return {
    // Config for ChatInput
    inputConfig: getInputConfig(),

    // Handlers
    handleSubmit,
    handleChipSelect,
    handleCardSelect,

    // Validation
    validationMessages,
    clearValidationMessages,

    // State
    isProcessing,
    hasActiveFlow: !!activeFlow,
    currentStepId,
  }
}
