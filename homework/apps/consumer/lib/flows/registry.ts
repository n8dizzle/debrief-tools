/**
 * Flow Registry
 *
 * Central registry for all flow definitions.
 * Flows are registered here and can be looked up by ID.
 */

import type { Flow } from './types'

// =============================================================================
// Registry
// =============================================================================

const flowRegistry: Map<string, Flow> = new Map()

/**
 * Register a flow definition
 */
export function registerFlow(flow: Flow): void {
  if (flowRegistry.has(flow.id)) {
    console.warn(`Flow "${flow.id}" is already registered. Overwriting.`)
  }
  flowRegistry.set(flow.id, flow)
}

/**
 * Get a flow by ID
 */
export function getFlow(id: string): Flow | undefined {
  return flowRegistry.get(id)
}

/**
 * Get all registered flows
 */
export function getAllFlows(): Flow[] {
  return Array.from(flowRegistry.values())
}

/**
 * Check if a flow exists
 */
export function hasFlow(id: string): boolean {
  return flowRegistry.has(id)
}

// =============================================================================
// Flow Discovery
// =============================================================================

/**
 * Intent patterns that map to flows
 * Used to detect which flow to start based on user's initial message
 */
interface IntentPattern {
  flowId: string
  patterns: RegExp[]
  keywords: string[]
}

const intentPatterns: IntentPattern[] = [
  {
    flowId: 'hvac_replacement',
    patterns: [
      /\b(new|replace|replacement|upgrade)\b.*\b(hvac|ac|air\s*condition|heat|furnace|system)\b/i,
      /\b(hvac|ac|air\s*condition|heat|furnace|system)\b.*\b(new|replace|replacement|upgrade|pricing|price|cost|quote)\b/i,
    ],
    keywords: [
      'new hvac',
      'replace hvac',
      'new ac',
      'replace ac',
      'hvac replacement',
      'ac replacement',
      'new system',
      'hvac pricing',
      'ac pricing',
      'new air conditioner',
      'replace furnace',
      'new furnace',
    ],
  },
  // Future flows can be added here:
  // {
  //   flowId: 'hvac_repair',
  //   patterns: [...],
  //   keywords: ['ac not working', 'hvac repair', 'ac repair', ...],
  // },
  // {
  //   flowId: 'water_heater',
  //   patterns: [...],
  //   keywords: ['water heater', 'hot water', ...],
  // },
]

/**
 * Detect which flow to start based on user intent
 * Returns flow ID or null if no match
 */
export function detectFlowFromIntent(message: string): string | null {
  const lowerMessage = message.toLowerCase()

  for (const intent of intentPatterns) {
    // Check keyword matches first (faster)
    for (const keyword of intent.keywords) {
      if (lowerMessage.includes(keyword)) {
        return intent.flowId
      }
    }

    // Check regex patterns
    for (const pattern of intent.patterns) {
      if (pattern.test(message)) {
        return intent.flowId
      }
    }
  }

  return null
}

/**
 * Get the default flow (for when intent detection fails but user wants to proceed)
 */
export function getDefaultFlow(): Flow | undefined {
  return flowRegistry.get('hvac_replacement')
}

// =============================================================================
// Index Export
// =============================================================================

export { flowRegistry }
