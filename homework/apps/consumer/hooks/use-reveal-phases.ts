/**
 * Hook for managing the phased reveal animation on the /found page
 * Orchestrates map → facts → insight → CTA reveal sequence
 */

import { useCallback, useEffect, useReducer } from "react"

export type RevealPhase = "loading" | "map" | "facts" | "insight" | "cta" | "complete"

type RevealState = {
  currentPhase: RevealPhase
  mapRevealed: boolean
  factsRevealed: number // 0-15, increments as each fact animates in
  totalFacts: number
  insightRevealed: boolean
  ctaRevealed: boolean
}

type RevealAction =
  | { type: "SET_TOTAL_FACTS"; count: number }
  | { type: "START_MAP_REVEAL" }
  | { type: "MAP_REVEALED" }
  | { type: "START_FACTS_REVEAL" }
  | { type: "FACT_REVEALED" }
  | { type: "START_INSIGHT_REVEAL" }
  | { type: "INSIGHT_REVEALED" }
  | { type: "START_CTA_REVEAL" }
  | { type: "CTA_REVEALED" }
  | { type: "RESET" }

const initialState: RevealState = {
  currentPhase: "loading",
  mapRevealed: false,
  factsRevealed: 0,
  totalFacts: 0,
  insightRevealed: false,
  ctaRevealed: false,
}

function revealReducer(state: RevealState, action: RevealAction): RevealState {
  switch (action.type) {
    case "SET_TOTAL_FACTS":
      return { ...state, totalFacts: action.count }

    case "START_MAP_REVEAL":
      return { ...state, currentPhase: "map" }

    case "MAP_REVEALED":
      return { ...state, mapRevealed: true }

    case "START_FACTS_REVEAL":
      return { ...state, currentPhase: "facts" }

    case "FACT_REVEALED":
      const newFactsRevealed = state.factsRevealed + 1
      const allFactsRevealed = newFactsRevealed >= state.totalFacts
      return {
        ...state,
        factsRevealed: newFactsRevealed,
        // Automatically transition to insight phase when all facts are revealed
        currentPhase: allFactsRevealed ? "insight" : state.currentPhase,
      }

    case "START_INSIGHT_REVEAL":
      return { ...state, currentPhase: "insight" }

    case "INSIGHT_REVEALED":
      return { ...state, insightRevealed: true }

    case "START_CTA_REVEAL":
      return { ...state, currentPhase: "cta" }

    case "CTA_REVEALED":
      return { ...state, ctaRevealed: true, currentPhase: "complete" }

    case "RESET":
      return initialState

    default:
      return state
  }
}

// Timing constants (in ms)
const TIMING = {
  MAP_DURATION: 800,
  MAP_TO_FACTS_DELAY: 200,
  FACT_STAGGER: 150,
  FACTS_TO_INSIGHT_DELAY: 300,
  INSIGHT_DURATION: 500,
  INSIGHT_TO_CTA_DELAY: 200,
  CTA_DURATION: 400,
}

type UseRevealPhasesOptions = {
  totalFacts: number
  isDataReady: boolean
  respectReducedMotion?: boolean
}

export function useRevealPhases({
  totalFacts,
  isDataReady,
  respectReducedMotion = true,
}: UseRevealPhasesOptions) {
  const [state, dispatch] = useReducer(revealReducer, initialState)

  // Check for reduced motion preference
  const prefersReducedMotion =
    respectReducedMotion &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

  // Update total facts count
  useEffect(() => {
    dispatch({ type: "SET_TOTAL_FACTS", count: totalFacts })
  }, [totalFacts])

  // Start reveal when data is ready
  useEffect(() => {
    if (isDataReady && state.currentPhase === "loading") {
      // If reduced motion, skip to complete
      if (prefersReducedMotion) {
        dispatch({ type: "START_MAP_REVEAL" })
        dispatch({ type: "MAP_REVEALED" })
        dispatch({ type: "START_FACTS_REVEAL" })
        for (let i = 0; i < totalFacts; i++) {
          dispatch({ type: "FACT_REVEALED" })
        }
        dispatch({ type: "INSIGHT_REVEALED" })
        dispatch({ type: "CTA_REVEALED" })
        return
      }

      dispatch({ type: "START_MAP_REVEAL" })
    }
  }, [isDataReady, state.currentPhase, prefersReducedMotion, totalFacts])

  // Map phase timing
  useEffect(() => {
    if (state.currentPhase === "map" && !state.mapRevealed && !prefersReducedMotion) {
      const timer = setTimeout(() => {
        dispatch({ type: "MAP_REVEALED" })
      }, TIMING.MAP_DURATION)
      return () => clearTimeout(timer)
    }
  }, [state.currentPhase, state.mapRevealed, prefersReducedMotion])

  // Transition from map to facts
  useEffect(() => {
    if (state.mapRevealed && state.currentPhase === "map" && !prefersReducedMotion) {
      const timer = setTimeout(() => {
        dispatch({ type: "START_FACTS_REVEAL" })
      }, TIMING.MAP_TO_FACTS_DELAY)
      return () => clearTimeout(timer)
    }
  }, [state.mapRevealed, state.currentPhase, prefersReducedMotion])

  // Facts cascade timing
  useEffect(() => {
    if (
      state.currentPhase === "facts" &&
      state.factsRevealed < state.totalFacts &&
      !prefersReducedMotion
    ) {
      const timer = setTimeout(() => {
        dispatch({ type: "FACT_REVEALED" })
      }, TIMING.FACT_STAGGER)
      return () => clearTimeout(timer)
    }
  }, [state.currentPhase, state.factsRevealed, state.totalFacts, prefersReducedMotion])

  // Transition from facts to insight
  useEffect(() => {
    if (
      state.currentPhase === "insight" &&
      !state.insightRevealed &&
      !prefersReducedMotion
    ) {
      const timer = setTimeout(() => {
        dispatch({ type: "INSIGHT_REVEALED" })
      }, TIMING.INSIGHT_DURATION)
      return () => clearTimeout(timer)
    }
  }, [state.currentPhase, state.insightRevealed, prefersReducedMotion])

  // Transition from insight to CTA
  useEffect(() => {
    if (state.insightRevealed && state.currentPhase === "insight" && !prefersReducedMotion) {
      const timer = setTimeout(() => {
        dispatch({ type: "START_CTA_REVEAL" })
      }, TIMING.INSIGHT_TO_CTA_DELAY)
      return () => clearTimeout(timer)
    }
  }, [state.insightRevealed, state.currentPhase, prefersReducedMotion])

  // CTA reveal timing
  useEffect(() => {
    if (state.currentPhase === "cta" && !state.ctaRevealed && !prefersReducedMotion) {
      const timer = setTimeout(() => {
        dispatch({ type: "CTA_REVEALED" })
      }, TIMING.CTA_DURATION)
      return () => clearTimeout(timer)
    }
  }, [state.currentPhase, state.ctaRevealed, prefersReducedMotion])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  // Helper to check if a specific fact should be visible
  const isFactVisible = useCallback(
    (index: number) => {
      if (prefersReducedMotion) return true
      return index < state.factsRevealed
    },
    [state.factsRevealed, prefersReducedMotion]
  )

  // Get delay class for a fact (for staggered animation)
  const getFactDelayClass = useCallback(
    (index: number) => {
      if (prefersReducedMotion) return ""
      // Pre-defined delay classes for Tailwind JIT
      const delays = [
        "delay-0",
        "delay-[150ms]",
        "delay-[300ms]",
        "delay-[450ms]",
        "delay-[600ms]",
        "delay-[750ms]",
        "delay-[900ms]",
        "delay-[1050ms]",
        "delay-[1200ms]",
        "delay-[1350ms]",
        "delay-[1500ms]",
        "delay-[1650ms]",
        "delay-[1800ms]",
        "delay-[1950ms]",
        "delay-[2100ms]",
      ]
      return delays[index] || delays[delays.length - 1]
    },
    [prefersReducedMotion]
  )

  return {
    ...state,
    isFactVisible,
    getFactDelayClass,
    reset,
    isComplete: state.currentPhase === "complete",
    prefersReducedMotion,
  }
}

export { TIMING as REVEAL_TIMING }
