/**
 * Flow Engine
 *
 * Export all flow-related modules from a single entry point.
 */

// Register all flows (side-effect import)
import './hvac'

// Types
export type {
  Flow,
  FlowStep,
  FlowContext,
  FlowHistoryEntry,
  StepResponse,
  Chip,
  Prefill,
  PrefillFn,
  InputType,
  FlowUser,
  BrowserLocation,
  PropertyData,
  ProData,
  PricingOption,
  ValidationResult,
  FlowAction,
  FlowActionResult,
  EditIntent,
  EditTopicMap,
} from './types'

export { EDIT_KEYWORDS } from './types'

// State management
export {
  useFlowEngine,
  useCurrentStep,
  useFlowHistory,
  useCollectedData,
  useIsProcessing,
  useFlowError,
} from './context'

// Actions
export {
  registerAction,
  getAction,
  executeAction,
} from './actions'

// Registry
export {
  registerFlow,
  getFlow,
  getAllFlows,
  hasFlow,
  detectFlowFromIntent,
  getDefaultFlow,
} from './registry'

// Flows
export { hvacReplacementFlow, hvacEditTopicMap } from './hvac'
