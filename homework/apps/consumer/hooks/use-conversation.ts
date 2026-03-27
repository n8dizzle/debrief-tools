'use client'

import { useState, useCallback, useRef } from 'react'
import { useFlowStore } from '@/lib/flow-state'
import type {
  ConversationMessage,
  ChipButton,
  MessageType,
  MessageData,
} from '@/types/conversation'
import { createMessage, createLoadingMessage } from '@/types/conversation'

// Pre-auth flow steps
export type PreAuthStep = 'start' | 'intent' | 'scope' | 'education' | 'address' | 'loading' | 'confirm' | 'auth' | 'complete'

// Intent types
export type IntentType = 'replacement' | 'repair' | 'unsure' | null
export type ScopeType = 'full' | 'ac_only' | 'heat_only' | null

interface UseConversationOptions {
  onSendMessage?: (message: string) => Promise<{ message: string; buttons?: ChipButton[] } | void>
}

export function useConversation(options: UseConversationOptions = {}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [preAuthStep, setPreAuthStep] = useState<PreAuthStep>('start')
  const [intentType, setIntentType] = useState<IntentType>(null)
  const [scopeType, setScopeType] = useState<ScopeType>(null)

  // Flow store
  const setUserIntent = useFlowStore((s) => s.setUserIntent)
  const setPreAuthIntent = useFlowStore((s) => s.setPreAuthIntent)
  const setPreAuthScope = useFlowStore((s) => s.setPreAuthScope)
  const setFlowPhase = useFlowStore((s) => s.setFlowPhase)

  // Message ID counter
  const messageIdRef = useRef(0)

  // Generate unique message ID
  const generateId = useCallback(() => {
    messageIdRef.current += 1
    return `msg-${Date.now()}-${messageIdRef.current}`
  }, [])

  // Add a message to the conversation
  const addMessage = useCallback((
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: {
      type?: MessageType
      buttons?: ChipButton[]
      data?: MessageData
    }
  ) => {
    const message: ConversationMessage = {
      id: generateId(),
      role,
      type: options?.type || 'text',
      content,
      buttons: options?.buttons,
      data: options?.data,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, message])
    return message.id
  }, [generateId])

  // Add typing indicator
  const addTypingIndicator = useCallback(() => {
    setIsTyping(true)
  }, [])

  // Remove typing indicator
  const removeTypingIndicator = useCallback(() => {
    setIsTyping(false)
  }, [])

  // Send a user message and get AI response
  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    addMessage('user', content)

    // First message sets intent
    if (messages.length === 0) {
      setUserIntent(content)
    }

    // Show typing
    addTypingIndicator()

    try {
      if (options.onSendMessage) {
        const response = await options.onSendMessage(content)
        removeTypingIndicator()

        if (response) {
          addMessage('assistant', response.message, {
            buttons: response.buttons,
          })
        }
      } else {
        // Default: Use intro chat API
        const historyForApi = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch('/api/intro/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            chatHistory: historyForApi,
          }),
        })

        const data = await response.json()
        removeTypingIndicator()

        addMessage('assistant', data.message, {
          buttons: data.buttons,
          type: data.readyForAddress ? 'address-input' : 'text',
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      removeTypingIndicator()
      addMessage('assistant', "Let me help you get pricing. What's your address so I can look up your home?", {
        type: 'address-input',
      })
    }
  }, [messages, addMessage, addTypingIndicator, removeTypingIndicator, options, setUserIntent])

  // Start the pre-auth flow
  const startPreAuthFlow = useCallback((initialMessage: string) => {
    setUserIntent(initialMessage)

    // Add user message
    addMessage('user', initialMessage)

    // Move to intent step
    setPreAuthStep('intent')

    // Add assistant response after delay
    setTimeout(() => {
      addMessage('assistant', "I'd be happy to help with that. First, are you looking to replace your system, or do you need a pro to diagnose an issue?", {
        buttons: [
          { label: 'Replacement', value: 'replacement' },
          { label: 'Need diagnosis', value: 'repair' },
          { label: 'Not sure yet', value: 'unsure' },
        ],
      })
    }, 400)
  }, [addMessage, setUserIntent])

  // Handle intent selection
  const handleIntentSelect = useCallback((intent: IntentType, label: string) => {
    // Add user selection
    addMessage('user', label)
    setIntentType(intent)
    if (intent) setPreAuthIntent(intent)

    if (intent === 'replacement') {
      // Ask about scope
      setPreAuthStep('scope')
      setTimeout(() => {
        addMessage('assistant', 'Got it. Are you looking to replace the whole system (AC + heating) or just one part?', {
          buttons: [
            { label: 'Whole system', value: 'full' },
            { label: 'Just AC', value: 'ac_only' },
            { label: 'Just heating', value: 'heat_only' },
          ],
        })
      }, 400)
    } else {
      // For repair/unsure, show education then proceed
      setPreAuthStep('education')
      setTimeout(() => {
        const msg = intent === 'repair'
          ? "I understand. Right now we're focused on full system replacements, but we're expanding to repairs soon. If you'd like, I can still show you replacement options in case it makes sense."
          : "No worries - let me help you figure it out. I'll gather some info about your home and current system, and we'll find the best path forward."
        addMessage('assistant', msg)
        setTimeout(() => showEducationMessage(), 600)
      }, 400)
    }
  }, [addMessage, setPreAuthIntent])

  // Handle scope selection
  const handleScopeSelect = useCallback((scope: ScopeType, label: string) => {
    addMessage('user', label)
    setScopeType(scope)
    if (scope) setPreAuthScope(scope)
    setPreAuthStep('education')
    setTimeout(() => showEducationMessage(), 400)
  }, [addMessage, setPreAuthScope])

  // Show education message
  const showEducationMessage = useCallback(() => {
    const HVAC_FACTS = [
      "The average lifespan of an HVAC system in Texas is just 12-15 years due to the extreme heat.",
      "A new high-efficiency system can reduce your energy bills by up to 40%.",
      "HVAC systems work 2-3x harder in Texas summers than in moderate climates.",
    ]
    const randomFact = HVAC_FACTS[Math.floor(Math.random() * HVAC_FACTS.length)]

    addMessage('assistant', `Perfect! Here's how this works:\n\nI'll need your address and some info about your current system (don't worry, I'll guide you through it).\n\nThen you'll see real pricing from vetted local pros. You can compare options, add extras, schedule, and checkout - all right here.`, {
      buttons: [{ label: "Ready - let's go", value: 'ready' }],
      data: { kind: 'property-reveal', funFact: randomFact } as MessageData,
    })
  }, [addMessage])

  // Handle education acknowledgment
  const handleEducationAck = useCallback(() => {
    addMessage('user', "Ready - let's go")
    setPreAuthStep('address')
    setFlowPhase('address')

    setTimeout(() => {
      addMessage('assistant', "Great! Let's start with your address. This will help me pull up your home details and show you how many pros are available in your area.", {
        type: 'address-input',
      })
    }, 400)
  }, [addMessage, setFlowPhase])

  // Handle chip button selection
  const handleChipSelect = useCallback((button: ChipButton) => {
    if (preAuthStep === 'intent') {
      const intent = button.value === 'replacement' ? 'replacement' :
        button.value === 'repair' ? 'repair' : 'unsure'
      handleIntentSelect(intent as IntentType, button.label)
    } else if (preAuthStep === 'scope') {
      const scope = button.value === 'full' ? 'full' :
        button.value === 'ac_only' ? 'ac_only' : 'heat_only'
      handleScopeSelect(scope as ScopeType, button.label)
    } else if (preAuthStep === 'education' && button.value === 'ready') {
      handleEducationAck()
    } else {
      // Default: use as user message
      sendMessage(button.label)
    }
  }, [preAuthStep, handleIntentSelect, handleScopeSelect, handleEducationAck, sendMessage])

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([])
    setPreAuthStep('start')
    setIntentType(null)
    setScopeType(null)
  }, [])

  // Check if conversation has started
  const hasStarted = messages.length > 0

  return {
    // State
    messages,
    isTyping,
    preAuthStep,
    intentType,
    scopeType,
    hasStarted,

    // Actions
    addMessage,
    sendMessage,
    startPreAuthFlow,
    handleChipSelect,
    clearConversation,

    // Step handlers
    setPreAuthStep,
    handleIntentSelect,
    handleScopeSelect,
    handleEducationAck,

    // Utilities
    addTypingIndicator,
    removeTypingIndicator,
  }
}
