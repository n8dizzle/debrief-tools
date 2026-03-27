'use client'

import { useEffect, useRef, useCallback, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFlowEngine, getFlow, detectFlowFromIntent, getDefaultFlow } from '@/lib/flows'
import type { Flow, Chip, FlowContext } from '@/lib/flows'
import { FlowCard } from './flow-card'
import { useFlowInput } from './use-flow-input'
import { ChatInput } from '@/components/conversation/chat-input'
import { TextMessage } from '@/components/conversation/messages/text-message'
import { LoadingMessage } from '@/components/conversation/messages/loading-message'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

// Inline input cards - render IN conversation, not replacing input
import { AddressInputCard, type AddressDetails } from './cards/address-input-card'

// Auth prompt for inline authentication
import { AuthPrompt } from '@/components/flow/auth-prompt'

// Property card with loading states from homepage
import { PropertyCard as ConversationPropertyCard } from '@/components/conversation/cards/property-card'
import type { PropertyRevealData } from '@/types/conversation'

interface PropertyDataForDrawer {
  address: string
  formattedAddress?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  sqft?: number
  yearBuilt?: number
  stories?: number
  beds?: number
  baths?: number
  latitude?: number
  longitude?: number
}

interface FlowConversationProps {
  /** Optional initial message to start with (treated as user message) */
  initialMessage?: string
  /** Custom greeting from assistant (replaces default greeting when showIntro=true) */
  customGreeting?: string
  /** Callback when flow completes */
  onFlowComplete?: () => void
  /** Callback when user sends a message (for analytics, etc.) */
  onMessage?: (message: string) => void
  /** Callback when user confirms their property (for showing home drawer) */
  onPropertyConfirm?: (property: PropertyDataForDrawer) => void
  /** Show camera button in input */
  showCamera?: boolean
  /** Auto-focus input on mount */
  autoFocus?: boolean
  /** Show intro greeting message (default: true). Set false when page has its own hero/intro */
  showIntro?: boolean
  /** Visual variant - 'default' has white backgrounds, 'hero' is transparent for homepage */
  variant?: 'default' | 'hero'
  /** Additional class name */
  className?: string
}

interface PreFlowMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chips?: Chip[]
}

// Flow phase for property reveal
type PropertyPhase = 'none' | 'loading' | 'revealed'

// Inner component that uses useSearchParams
function FlowConversationInner({
  initialMessage,
  customGreeting,
  onFlowComplete,
  onMessage,
  onPropertyConfirm,
  showCamera = true,
  autoFocus = false,
  showIntro = true,
  variant = 'default',
  className,
}: FlowConversationProps) {
  const {
    activeFlow,
    currentStepId,
    history,
    isProcessing,
    startFlow,
    getContext,
    getCurrentStep,
    goBackToStep,
    detectEditIntent,
    setProperty,
    completeStep,
  } = useFlowEngine()

  const {
    inputConfig,
    handleSubmit: handleFlowSubmit,
    handleChipSelect: handleFlowChipSelect,
    validationMessages,
    clearValidationMessages,
  } = useFlowInput()

  // Clear validation messages when step changes
  const prevStepIdRef = useRef(currentStepId)
  useEffect(() => {
    if (currentStepId !== prevStepIdRef.current) {
      clearValidationMessages()
      setInFlowUserMessages([])
      prevStepIdRef.current = currentStepId
    }
  }, [currentStepId, clearValidationMessages])

  // Pre-flow conversation state
  const [preFlowMessages, setPreFlowMessages] = useState<PreFlowMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const greetingShownRef = useRef(false)

  // Track in-flow user messages
  const [inFlowUserMessages, setInFlowUserMessages] = useState<Array<{id: string, content: string, stepId: string}>>([])

  // Property reveal state
  const [propertyPhase, setPropertyPhase] = useState<PropertyPhase>('none')
  const [propertyRevealData, setPropertyRevealData] = useState<PropertyRevealData | null>(null)

  // Auth state
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [pendingPropertyData, setPendingPropertyData] = useState<PropertyDataForDrawer | null>(null)
  const [homeClaimedMessage, setHomeClaimedMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const authProcessedRef = useRef(false)

  // Edit mode state
  const [editModeMessage, setEditModeMessage] = useState<string | null>(null)
  const editModeChips: Chip[] = [
    { label: 'Address', value: 'edit_address', next: 'address' },
    { label: 'System scope', value: 'edit_scope', next: 'system_scope' },
    { label: 'System type', value: 'edit_type', next: 'system_type' },
    { label: 'Something else', value: 'edit_other' },
  ]

  const scrollRef = useRef<HTMLDivElement>(null)
  const messageIdRef = useRef(0)

  const generateId = () => {
    messageIdRef.current += 1
    return `pre-${Date.now()}-${messageIdRef.current}`
  }

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [preFlowMessages, history, currentStepId, isProcessing, isTyping, validationMessages, inFlowUserMessages, propertyPhase, showAuthPrompt, homeClaimedMessage])

  // Handle auth success from OAuth callback
  useEffect(() => {
    if (authProcessedRef.current || isAuthLoading) return

    const authSuccess = searchParams.get('auth') === 'success'

    if (authSuccess && isAuthenticated) {
      authProcessedRef.current = true

      // Restore pending property data from sessionStorage
      const storedProperty = sessionStorage.getItem('pendingPropertyClaim')
      if (storedProperty) {
        try {
          const propertyData: PropertyDataForDrawer = JSON.parse(storedProperty)
          sessionStorage.removeItem('pendingPropertyClaim')

          // Show claimed message
          const shortAddress = propertyData.address?.split(',')[0] || 'your home'
          setHomeClaimedMessage(`Welcome back. I've claimed ${shortAddress} to your account and pulled in all your home details.`)

          // Trigger the drawer after a brief delay
          setTimeout(() => {
            setShowAuthPrompt(false)
            setPropertyPhase('revealed')
            onPropertyConfirm?.(propertyData)

            // Complete the step if we have a current step
            if (currentStepId) {
              completeStep(currentStepId, {
                displayText: "Yes, that's my home",
                value: 'confirmed',
              })
            }
          }, 500)

          // Add follow-up message after artifacts panel has time to reveal
          setTimeout(() => {
            setHomeClaimedMessage(`Welcome back. I've claimed ${shortAddress} to your account and pulled in all your home details.\n\nAll saved to your portal. Now let's get you pricing.`)
          }, 3000)
        } catch (e) {
          console.error('Failed to restore property data:', e)
        }
      }

      // Clean up URL params
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.delete('auth')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [searchParams, isAuthenticated, isAuthLoading, onPropertyConfirm, currentStepId, completeStep])

  // Handle initial message
  useEffect(() => {
    if (initialMessage && preFlowMessages.length === 0 && !activeFlow) {
      handleUserMessage(initialMessage)
    }
  }, [initialMessage])

  // Show initial greeting (only if showIntro is true or customGreeting is provided)
  useEffect(() => {
    if (!showIntro && !customGreeting) return
    if (greetingShownRef.current) return
    if (preFlowMessages.length > 0 || activeFlow || initialMessage) return

    const timer = setTimeout(() => {
      // Double-check we haven't shown greeting yet (in case of race conditions)
      if (greetingShownRef.current) return
      greetingShownRef.current = true

      // Use custom greeting if provided, otherwise use default
      const greetingContent = customGreeting ||
        "Hey there. Tell me what's going on with your home and I'll get you real pricing from vetted local pros."

      // Show contextual chips based on whether user is returning
      const chips = customGreeting ? [
        { label: 'Get HVAC pricing', value: 'hvac_replacement' },
        { label: 'Schedule a tune-up', value: 'tune_up' },
        { label: 'Something else', value: 'questions' },
      ] : [
        { label: 'I need a new HVAC system', value: 'hvac_replacement' },
        { label: 'My AC isn\'t cooling', value: 'ac_issue' },
        { label: 'Just exploring', value: 'questions' },
      ]

      setPreFlowMessages([{
        id: generateId(),
        role: 'assistant',
        content: greetingContent,
        chips,
      }])
    }, 300)

    return () => clearTimeout(timer)
  }, [showIntro, customGreeting, preFlowMessages.length, activeFlow, initialMessage])

  const addPreFlowMessage = useCallback((
    role: 'user' | 'assistant',
    content: string,
    chips?: Chip[]
  ) => {
    setPreFlowMessages((prev) => [
      ...prev,
      { id: generateId(), role, content, chips }
    ])
  }, [])

  const tryStartFlow = useCallback((message: string): boolean => {
    const flowId = detectFlowFromIntent(message)
    if (flowId) {
      const flow = getFlow(flowId)
      if (flow) {
        startFlow(flow)
        return true
      }
    }
    return false
  }, [startFlow])

  const handleUserMessage = useCallback(async (message: string) => {
    onMessage?.(message)

    if (activeFlow) {
      handleFlowSubmit(message)
      return
    }

    addPreFlowMessage('user', message)
    setIsTyping(true)

    await new Promise((r) => setTimeout(r, 400))

    const flowStarted = tryStartFlow(message)

    if (flowStarted) {
      setIsTyping(false)
      return
    }

    setIsTyping(false)
    addPreFlowMessage(
      'assistant',
      "I can help you with HVAC replacement pricing. Would you like to see what a new system would cost for your home?",
      [
        { label: 'Yes, show me pricing', value: 'hvac_replacement' },
        { label: 'I have questions first', value: 'questions' },
      ]
    )
  }, [activeFlow, handleFlowSubmit, addPreFlowMessage, tryStartFlow, onMessage])

  const handlePreFlowChipSelect = useCallback((chip: Chip) => {
    addPreFlowMessage('user', chip.label)

    if (chip.value === 'hvac_replacement' || chip.value === 'ac_issue') {
      const flow = getDefaultFlow()
      if (flow) {
        setIsTyping(true)
        setTimeout(() => {
          setIsTyping(false)
          startFlow(flow)
        }, 300)
      }
    } else if (chip.value === 'questions') {
      setTimeout(() => {
        addPreFlowMessage(
          'assistant',
          "Of course. What would you like to know? I can answer questions about pricing, the installation process, financing options, or help you understand what system might be right for your home.",
          [
            { label: 'How much does it cost?', value: 'cost_question' },
            { label: 'How long does install take?', value: 'timeline_question' },
            { label: 'Get pricing for my home', value: 'hvac_replacement' },
          ]
        )
      }, 400)
    } else if (chip.value === 'cost_question') {
      setTimeout(() => {
        addPreFlowMessage(
          'assistant',
          "HVAC replacement typically ranges from $6,000 to $15,000 depending on your home's size and the efficiency level you choose. The best way to get an accurate price is to let me look up your home's details - it only takes a minute.",
          [
            { label: 'Get pricing for my home', value: 'hvac_replacement' },
            { label: 'What affects the price?', value: 'price_factors' },
          ]
        )
      }, 400)
    } else if (chip.value === 'timeline_question') {
      setTimeout(() => {
        addPreFlowMessage(
          'assistant',
          "Most HVAC installations are completed in a single day - typically 4 to 8 hours. We can usually schedule within a few days of booking.",
          [
            { label: 'Get pricing for my home', value: 'hvac_replacement' },
            { label: 'I have more questions', value: 'questions' },
          ]
        )
      }, 400)
    } else if (chip.value === 'price_factors') {
      setTimeout(() => {
        addPreFlowMessage(
          'assistant',
          "The main factors are your home's square footage (determines system size), the efficiency rating you choose (SEER), and whether you need just AC or a full heating/cooling system. Higher efficiency costs more upfront but saves on energy bills.",
          [
            { label: 'Get pricing for my home', value: 'hvac_replacement' },
          ]
        )
      }, 400)
    }
  }, [addPreFlowMessage, startFlow])

  const handleEditChipSelect = useCallback((chip: Chip) => {
    if (currentStepId) {
      setInFlowUserMessages(prev => [...prev, {
        id: `inflow-${Date.now()}`,
        content: chip.label,
        stepId: currentStepId,
      }])
    }

    setEditModeMessage(null)

    if (chip.next) {
      goBackToStep(chip.next)
    }
  }, [currentStepId, goBackToStep])

  const handleChipSelect = useCallback((chip: Chip) => {
    if (editModeMessage) {
      handleEditChipSelect(chip)
      return
    }

    if (activeFlow) {
      handleFlowChipSelect(chip)
    } else {
      handlePreFlowChipSelect(chip)
    }
  }, [activeFlow, editModeMessage, handleFlowChipSelect, handlePreFlowChipSelect, handleEditChipSelect])

  // Handle address selection from inline card
  const handleAddressSelect = useCallback(async (address: string, details: AddressDetails) => {
    if (!currentStepId) return

    // Show user message
    setInFlowUserMessages(prev => [...prev, {
      id: `inflow-${Date.now()}`,
      content: details.street || address,
      stepId: currentStepId,
    }])

    // Set up property reveal data
    setPropertyRevealData({
      kind: 'property-reveal',
      address: details.formattedAddress,
      latitude: details.latitude,
      longitude: details.longitude,
    })
    setPropertyPhase('loading')

    // Update flow context with property
    setProperty({
      address: details.formattedAddress,
      formattedAddress: details.formattedAddress,
      placeId: details.placeId,
      latitude: details.latitude,
      longitude: details.longitude,
      street: details.street,
      city: details.city,
      state: details.state,
      postalCode: details.zipCode,
    })

    // Complete the address step
    completeStep(currentStepId, {
      displayText: details.street || address,
      value: details.formattedAddress,
    })
  }, [currentStepId, setProperty, completeStep])

  // Handle property confirmation from PropertyCard
  const handlePropertyConfirm = useCallback(() => {
    if (!currentStepId) return

    // Get property data from context
    const ctx = getContext()
    const propertyData: PropertyDataForDrawer = {
      address: ctx.property?.address || '',
      formattedAddress: ctx.property?.formattedAddress,
      street: ctx.property?.street,
      city: ctx.property?.city,
      state: ctx.property?.state,
      postalCode: ctx.property?.postalCode,
      sqft: ctx.property?.sqft,
      yearBuilt: ctx.property?.yearBuilt,
      stories: ctx.property?.stories,
      beds: ctx.property?.beds,
      baths: ctx.property?.baths,
      latitude: ctx.property?.latitude,
      longitude: ctx.property?.longitude,
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      // Show user message first
      setInFlowUserMessages(prev => [...prev, {
        id: `inflow-${Date.now()}`,
        content: "That's my home",
        stepId: currentStepId,
      }])

      // Store property data for after auth
      setPendingPropertyData(propertyData)
      sessionStorage.setItem('pendingPropertyClaim', JSON.stringify(propertyData))
      setShowAuthPrompt(true)
      return
    }

    // User is authenticated - proceed with claim
    setPropertyPhase('revealed')
    const shortAddress = propertyData.address?.split(',')[0] || 'your home'
    setHomeClaimedMessage(`Welcome back. I've claimed ${shortAddress} to your account and pulled in all your home details.`)

    if (onPropertyConfirm) {
      onPropertyConfirm(propertyData)
    }

    // Add follow-up message after artifacts panel has time to reveal
    setTimeout(() => {
      setHomeClaimedMessage(`Welcome back. I've claimed ${shortAddress} to your account and pulled in all your home details.\n\nAll saved to your portal. Now let's get you pricing.`)
    }, 2500)

    completeStep(currentStepId, {
      displayText: "Yes, that's my home",
      value: 'confirmed',
    })
  }, [currentStepId, completeStep, getContext, onPropertyConfirm, isAuthenticated])

  // Handle "not my home" from PropertyCard
  const handleNotMyHome = useCallback(() => {
    setPropertyPhase('none')
    setPropertyRevealData(null)
    goBackToStep('address')
  }, [goBackToStep])

  // Handle property data fetched
  const handlePropertyDataFetched = useCallback((data: Partial<PropertyRevealData>) => {
    setPropertyRevealData(prev => prev ? { ...prev, ...data } : null)
    // Update flow context
    const ctx = getContext()
    if (ctx.property) {
      setProperty({
        ...ctx.property,
        sqft: data.sqft ?? ctx.property.sqft,
        yearBuilt: data.yearBuilt ?? ctx.property.yearBuilt,
        beds: data.beds ?? ctx.property.beds,
        baths: data.baths ?? ctx.property.baths,
        stories: data.stories ?? ctx.property.stories,
      })
    }
  }, [getContext, setProperty])

  const handleSend = useCallback((message: string, options?: { fromPrefill?: boolean }) => {
    if (activeFlow && currentStepId) {
      const editIntent = detectEditIntent(message)

      if (editIntent.detected) {
        setInFlowUserMessages(prev => [...prev, {
          id: `inflow-${Date.now()}`,
          content: message,
          stepId: currentStepId,
        }])

        if (editIntent.targetStepId) {
          setEditModeMessage(null)
          goBackToStep(editIntent.targetStepId)
          return
        } else {
          setEditModeMessage("What would you like to change?")
          return
        }
      }

      if (editModeMessage) {
        setEditModeMessage(null)
      }

      setInFlowUserMessages(prev => [...prev, {
        id: `inflow-${Date.now()}`,
        content: message,
        stepId: currentStepId,
      }])
      handleFlowSubmit(message, options)
    } else {
      handleUserMessage(message)
    }
  }, [activeFlow, currentStepId, handleFlowSubmit, handleUserMessage, detectEditIntent, goBackToStep, editModeMessage])

  // Get current step info
  const currentStep = getCurrentStep()
  const ctx = getContext()

  const currentPrompt = currentStep
    ? typeof currentStep.prompt === 'function'
      ? currentStep.prompt(ctx)
      : currentStep.prompt
    : null

  const shouldShowCurrentStep = currentStep
    ? !currentStep.condition || currentStep.condition(ctx)
    : false

  // Check if we're on address step or property_confirm step
  const isAddressStep = currentStep?.inputType === 'address_autocomplete'
  const isPropertyConfirmStep = currentStepId === 'property_confirm'

  // Get placeholder for current step (inputType affects placeholder, not input rendering)
  const getPlaceholderForStep = () => {
    if (!currentStep) return 'Describe what you need help with...'
    if (currentStep.inputType === 'address_autocomplete') return 'Type your address or ask a question...'
    if (currentStep.inputType === 'calendar') return 'Type a date or ask a question...'
    if (currentStep.inputType === 'phone') return 'Type your phone or ask a question...'
    if (currentStep.inputType === 'email') return 'Type your email or ask a question...'
    return 'Type your response or ask a question...'
  }

  // Determine input config - NO inputType passed to ChatInput now
  // When showing PropertyCard, suppress the flow's chips (card has its own buttons)
  // When showing auth prompt, disable input and hide chips
  const finalInputConfig = showAuthPrompt
    ? {
        chips: undefined,
        prefill: undefined,
        placeholder: 'Sign in to continue...',
        disabled: true,
      }
    : activeFlow
      ? editModeMessage
        ? {
            chips: editModeChips,
            prefill: inputConfig.prefill,
            placeholder: 'Or type what you want to change...',
            disabled: false,
          }
        : isPropertyConfirmStep
          ? {
              // PropertyCard has its own buttons, suppress chips
              chips: undefined,
              prefill: undefined,
              placeholder: 'Ask a question about your home...',
              disabled: propertyPhase === 'loading',
            }
          : {
              chips: inputConfig.chips,
              prefill: inputConfig.prefill,
              placeholder: getPlaceholderForStep(),
              disabled: inputConfig.disabled,
            }
      : {
          chips: preFlowMessages[preFlowMessages.length - 1]?.chips,
          prefill: undefined,
          placeholder: 'Describe what you need help with...',
          disabled: isTyping,
        }

  // Check if chat is empty (no messages, no active flow)
  const isChatEmpty = preFlowMessages.length === 0 && !activeFlow && history.length === 0

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Messages area */}
      <div className="flex-1 space-y-5 pb-6">
        {/* Welcome message when chat is empty and user is authenticated */}
        {isChatEmpty && isAuthenticated && (
          <TextMessage
            content="Welcome back. What would you like help with today? You can ask about HVAC pricing, home maintenance, or anything else about your home."
            role="assistant"
          />
        )}

        {/* Pre-flow messages */}
        {preFlowMessages.map((msg) => (
          <div key={msg.id} className="space-y-3">
            <TextMessage content={msg.content} role={msg.role} />
          </div>
        ))}

        {/* Flow history */}
        {activeFlow && history.map((entry, index) => (
          <div key={`${entry.stepId}-${index}`} className="space-y-4">
            <TextMessage content={entry.prompt} role="assistant" />

            {/* Card if applicable (not PropertyCard - that's special) */}
            {(() => {
              const step = activeFlow.steps.find((s) => s.id === entry.stepId)
              if (step?.card && step.card !== 'PropertyCard' && shouldShowCardInHistory(step.card)) {
                const cardProps = step.cardProps
                  ? typeof step.cardProps === 'function'
                    ? step.cardProps(ctx)
                    : step.cardProps
                  : {}
                return (
                  <div className="ml-11 max-w-[calc(85%-2.75rem)]">
                    <FlowCard
                      cardType={step.card}
                      props={cardProps}
                      completed
                      selectedValue={entry.response.value}
                    />
                  </div>
                )
              }
              return null
            })()}

            <TextMessage content={entry.response.displayText} role="user" />
          </div>
        ))}

        {/* Current step - skip when showing PropertyCard with loading states */}
        {activeFlow && currentStep && shouldShowCurrentStep && !isPropertyConfirmStep && (
          <div className="space-y-4">
            <TextMessage content={currentPrompt || ''} role="assistant" />

            {/* Inline Address Input Card */}
            {isAddressStep && (
              <div className="ml-11 max-w-[calc(85%-2.75rem)]">
                <AddressInputCard
                  onSelect={handleAddressSelect}
                  autoFocus
                />
              </div>
            )}

            {/* Other cards (not address, not PropertyCard) */}
            {currentStep.card && currentStep.card !== 'PropertyCard' && !isAddressStep && (
              <div className="ml-11 max-w-[calc(85%-2.75rem)]">
                <FlowCard
                  cardType={currentStep.card}
                  props={
                    currentStep.cardProps
                      ? typeof currentStep.cardProps === 'function'
                        ? currentStep.cardProps(ctx)
                        : currentStep.cardProps
                      : {}
                  }
                  onSelect={(value, displayText) => {
                    handleFlowSubmit(displayText, { fromPrefill: false })
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Property reveal with loading states */}
        {propertyPhase !== 'none' && propertyRevealData && !showAuthPrompt && (
          <div className="ml-11 max-w-[calc(85%-2.75rem)]">
            <ConversationPropertyCard
              data={propertyRevealData}
              onConfirm={handlePropertyConfirm}
              onNotMyHome={handleNotMyHome}
              onPropertyDataFetched={handlePropertyDataFetched}
            />
          </div>
        )}

        {/* Auth prompt - shown inline when user needs to authenticate */}
        {showAuthPrompt && (
          <div className="space-y-4">
            <TextMessage
              content="Great choice. To save your home and see personalized pricing, I'll need you to sign in real quick."
              role="assistant"
            />
            <div className="ml-11 max-w-[calc(85%-2.75rem)]">
              <AuthPrompt redirectTo="/dashboard?auth=success" />
            </div>
          </div>
        )}

        {/* Home claimed message - shown after successful auth */}
        {homeClaimedMessage && (
          <TextMessage content={homeClaimedMessage} role="assistant" />
        )}

        {/* In-flow user messages */}
        {activeFlow && currentStepId && inFlowUserMessages
          .filter(msg => msg.stepId === currentStepId)
          .map((msg) => (
            <TextMessage key={msg.id} content={msg.content} role="user" />
          ))
        }

        {/* Validation messages */}
        {validationMessages.map((msg) => (
          <TextMessage key={msg.id} content={msg.content} role="assistant" />
        ))}

        {/* Edit mode prompt */}
        {editModeMessage && (
          <TextMessage content={editModeMessage} role="assistant" />
        )}

        {/* Loading indicator */}
        {(isTyping || isProcessing) && <LoadingMessage />}

        {/* Scroll anchor */}
        <div ref={scrollRef} />
      </div>

      {/* Sticky input area - ALWAYS visible text input */}
      <div className={cn(
        'sticky bottom-0 left-0 right-0',
        'pt-6 pb-6',
        'z-10',
        // Only show gradient backgrounds in default variant
        variant === 'default' && [
          'before:absolute before:inset-x-0 before:top-0 before:h-8',
          'before:bg-gradient-to-b before:from-transparent before:to-white before:pointer-events-none'
        ]
      )}>
        {variant === 'default' && (
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white to-white/95" />
        )}

        <div className="relative">
          <ChatInput
            onSend={handleSend}
            onChipSelect={handleChipSelect}
            showCamera={showCamera}
            autoFocus={autoFocus}
            chips={finalInputConfig.chips}
            prefill={finalInputConfig.prefill}
            placeholder={finalInputConfig.placeholder}
            disabled={finalInputConfig.disabled || isTyping}
            isLoading={isProcessing || isTyping}
            variant={variant}
            // NO inputType - ChatInput always shows text input now
          />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function shouldShowCardInHistory(cardType: string): boolean {
  const persistentCards = [
    'SizingCard',
    'SizingExplainerCard',
    'OrderSummaryCard',
    'ConfirmationCard',
  ]
  return persistentCards.includes(cardType)
}

// =============================================================================
// Export - wraps in Suspense for useSearchParams
// =============================================================================

export function FlowConversation(props: FlowConversationProps) {
  return (
    <Suspense fallback={<FlowConversationSkeleton />}>
      <FlowConversationInner {...props} />
    </Suspense>
  )
}

function FlowConversationSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex-1 space-y-5 pb-6">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>
  )
}
