/**
 * Flow State Management
 *
 * Zustand store for managing flow execution state.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Flow,
  FlowStep,
  FlowContext,
  FlowHistoryEntry,
  StepResponse,
  FlowUser,
  PropertyData,
  ProData,
  PricingOption,
  BrowserLocation,
  EditIntent,
  EDIT_KEYWORDS,
} from './types'

// =============================================================================
// Store State
// =============================================================================

interface FlowState {
  // Current flow
  activeFlow: Flow | null
  currentStepId: string | null

  // Collected data
  collectedData: Record<string, unknown>

  // History
  history: FlowHistoryEntry[]

  // Context data
  user: FlowUser | null
  isAuthenticated: boolean
  browserLocation: BrowserLocation | null
  property: PropertyData | null
  calculatedTonnage: number | null
  matchedPros: ProData[]
  pricingOptions: PricingOption[]

  // UI State
  isProcessing: boolean
  error: string | null

  // Timestamps
  startedAt: Date | null
  lastActiveAt: Date | null
}

interface FlowActions {
  // Flow lifecycle
  startFlow: (flow: Flow) => void
  resetFlow: () => void

  // Step navigation
  advanceToStep: (stepId: string) => void
  completeStep: (stepId: string, response: StepResponse) => void
  goBackToStep: (stepId: string) => void

  // Data updates
  setCollectedData: (key: string, value: unknown) => void
  updateCollectedData: (data: Record<string, unknown>) => void

  // Context updates
  setUser: (user: FlowUser | null) => void
  setProperty: (property: PropertyData | null) => void
  setCalculatedTonnage: (tonnage: number) => void
  setMatchedPros: (pros: ProData[]) => void
  setPricingOptions: (options: PricingOption[]) => void
  setBrowserLocation: (location: BrowserLocation | null) => void

  // UI state
  setProcessing: (isProcessing: boolean) => void
  setError: (error: string | null) => void

  // Utilities
  getContext: () => FlowContext
  getCurrentStep: () => FlowStep | null
  detectEditIntent: (message: string) => EditIntent
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: FlowState = {
  activeFlow: null,
  currentStepId: null,
  collectedData: {},
  history: [],
  user: null,
  isAuthenticated: false,
  browserLocation: null,
  property: null,
  calculatedTonnage: null,
  matchedPros: [],
  pricingOptions: [],
  isProcessing: false,
  error: null,
  startedAt: null,
  lastActiveAt: null,
}

// =============================================================================
// Store
// =============================================================================

export const useFlowEngine = create<FlowState & FlowActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // Flow Lifecycle
      // -----------------------------------------------------------------------

      startFlow: (flow: Flow) => {
        set({
          activeFlow: flow,
          currentStepId: flow.initialStep,
          collectedData: {},
          history: [],
          error: null,
          startedAt: new Date(),
          lastActiveAt: new Date(),
        })
      },

      resetFlow: () => {
        set({
          ...initialState,
          // Preserve user/auth state
          user: get().user,
          isAuthenticated: get().isAuthenticated,
          browserLocation: get().browserLocation,
        })
      },

      // -----------------------------------------------------------------------
      // Step Navigation
      // -----------------------------------------------------------------------

      advanceToStep: (stepId: string) => {
        set({
          currentStepId: stepId,
          lastActiveAt: new Date(),
          error: null,
        })
      },

      completeStep: (stepId: string, response: StepResponse) => {
        const { activeFlow, history, collectedData } = get()
        if (!activeFlow) return

        const step = activeFlow.steps.find((s) => s.id === stepId)
        if (!step) return

        // Get the prompt text
        const prompt =
          typeof step.prompt === 'function'
            ? step.prompt(get().getContext())
            : step.prompt

        // Add to history
        const historyEntry: FlowHistoryEntry = {
          stepId,
          prompt,
          response,
          timestamp: new Date(),
        }

        // Update collected data if step collects something
        const newCollectedData = step.collects
          ? { ...collectedData, [step.collects]: response.value }
          : collectedData

        // Determine next step
        let nextStepId: string | null = null

        // Check if chip has override next
        if (response.fromChip && step.chips) {
          const selectedChip = step.chips.find(
            (c) => c.value === response.value || c.label === response.displayText
          )
          if (selectedChip?.next) {
            nextStepId = selectedChip.next
          }
        }

        // Otherwise use step's next
        if (!nextStepId) {
          if (typeof step.next === 'function') {
            nextStepId = step.next(response, get().getContext())
          } else {
            nextStepId = step.next
          }
        }

        set({
          history: [...history, historyEntry],
          collectedData: newCollectedData,
          currentStepId: nextStepId,
          lastActiveAt: new Date(),
        })
      },

      goBackToStep: (stepId: string) => {
        const { history } = get()

        // Find the index of the step to go back to
        const stepIndex = history.findIndex((h) => h.stepId === stepId)
        if (stepIndex === -1) return

        // Remove all history after this step
        const newHistory = history.slice(0, stepIndex)

        // Remove collected data from removed steps
        const removedSteps = history.slice(stepIndex)
        const { activeFlow, collectedData } = get()
        const newCollectedData = { ...collectedData }

        removedSteps.forEach((entry) => {
          const step = activeFlow?.steps.find((s) => s.id === entry.stepId)
          if (step?.collects) {
            delete newCollectedData[step.collects]
          }
        })

        set({
          history: newHistory,
          collectedData: newCollectedData,
          currentStepId: stepId,
          lastActiveAt: new Date(),
        })
      },

      // -----------------------------------------------------------------------
      // Data Updates
      // -----------------------------------------------------------------------

      setCollectedData: (key: string, value: unknown) => {
        set((state) => ({
          collectedData: { ...state.collectedData, [key]: value },
          lastActiveAt: new Date(),
        }))
      },

      updateCollectedData: (data: Record<string, unknown>) => {
        set((state) => ({
          collectedData: { ...state.collectedData, ...data },
          lastActiveAt: new Date(),
        }))
      },

      // -----------------------------------------------------------------------
      // Context Updates
      // -----------------------------------------------------------------------

      setUser: (user: FlowUser | null) => {
        set({
          user,
          isAuthenticated: !!user,
        })
      },

      setProperty: (property: PropertyData | null) => {
        set({ property })
      },

      setCalculatedTonnage: (tonnage: number) => {
        set({ calculatedTonnage: tonnage })
      },

      setMatchedPros: (pros: ProData[]) => {
        set({ matchedPros: pros })
      },

      setPricingOptions: (options: PricingOption[]) => {
        set({ pricingOptions: options })
      },

      setBrowserLocation: (location: BrowserLocation | null) => {
        set({ browserLocation: location })
      },

      // -----------------------------------------------------------------------
      // UI State
      // -----------------------------------------------------------------------

      setProcessing: (isProcessing: boolean) => {
        set({ isProcessing })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      // -----------------------------------------------------------------------
      // Utilities
      // -----------------------------------------------------------------------

      getContext: (): FlowContext => {
        const state = get()
        return {
          collectedData: state.collectedData,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          browserLocation: state.browserLocation ?? undefined,
          property: state.property ?? undefined,
          calculatedTonnage: state.calculatedTonnage ?? undefined,
          matchedPros: state.matchedPros.length > 0 ? state.matchedPros : undefined,
          pricingOptions: state.pricingOptions.length > 0 ? state.pricingOptions : undefined,
          flowId: state.activeFlow?.id ?? '',
          currentStepId: state.currentStepId ?? '',
          history: state.history,
          startedAt: state.startedAt ?? new Date(),
          lastActiveAt: state.lastActiveAt ?? new Date(),
        }
      },

      getCurrentStep: (): FlowStep | null => {
        const { activeFlow, currentStepId } = get()
        if (!activeFlow || !currentStepId) return null
        return activeFlow.steps.find((s) => s.id === currentStepId) ?? null
      },

      detectEditIntent: (message: string): EditIntent => {
        const lowerMessage = message.toLowerCase()

        // Check for edit keywords
        const hasEditKeyword = [
          'change',
          'edit',
          'update',
          'go back',
          'actually',
          'wait',
          'wrong',
          'not right',
          'different',
          'redo',
        ].some((keyword) => lowerMessage.includes(keyword))

        if (!hasEditKeyword) {
          return { detected: false }
        }

        // Try to detect what they want to edit
        const topicMatches: Record<string, string[]> = {
          address: ['address', 'home', 'location', 'house'],
          system_scope: ['scope', 'cooling', 'heating', 'both', 'system type'],
          stories: ['stories', 'story', 'floors'],
          system_age: ['age', 'old', 'years'],
        }

        for (const [stepId, keywords] of Object.entries(topicMatches)) {
          if (keywords.some((k) => lowerMessage.includes(k))) {
            return {
              detected: true,
              targetStepId: stepId,
              topic: keywords[0],
            }
          }
        }

        // Edit intent detected but couldn't determine target
        return {
          detected: true,
          topic: undefined,
        }
      },
    }),
    {
      name: 'homework-flow-engine',
      version: 1,
      // Only persist certain fields
      partialize: (state) => ({
        collectedData: state.collectedData,
        history: state.history,
        property: state.property,
        calculatedTonnage: state.calculatedTonnage,
        currentStepId: state.currentStepId,
        // Don't persist: activeFlow (rehydrate from registry), user (rehydrate from auth)
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Handle any future migrations here
        return persistedState as FlowState
      },
    }
  )
)

// =============================================================================
// Selectors
// =============================================================================

export const useCurrentStep = () => useFlowEngine((state) => state.getCurrentStep())
export const useFlowHistory = () => useFlowEngine((state) => state.history)
export const useCollectedData = () => useFlowEngine((state) => state.collectedData)
export const useIsProcessing = () => useFlowEngine((state) => state.isProcessing)
export const useFlowError = () => useFlowEngine((state) => state.error)
