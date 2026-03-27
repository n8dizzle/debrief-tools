/**
 * Flow Engine Types
 *
 * Structured flows rendered as conversations.
 * The user experiences a chat, but under the hood it's a defined flow.
 */

// =============================================================================
// Core Flow Types
// =============================================================================

export interface Flow {
  id: string
  name: string
  description?: string
  steps: FlowStep[]
  initialStep: string
}

export interface FlowStep {
  id: string

  /**
   * The AI message to display. Can be static or dynamic based on collected data.
   */
  prompt: string | ((ctx: FlowContext) => string)

  // ---------------------------------------------------------------------------
  // Input Patterns (can combine)
  // ---------------------------------------------------------------------------

  /** Quick tap options - lowest friction */
  chips?: Chip[]

  /** Pre-populated input - user just hits Enter */
  prefill?: Prefill | PrefillFn

  /** Input type for specialized inputs */
  inputType?: InputType

  /** Inline card component to render (e.g., 'PropertyCard', 'PricingOptionsCard') */
  card?: string

  /** Card props - data passed to the card component */
  cardProps?: Record<string, unknown> | ((ctx: FlowContext) => Record<string, unknown>)

  // ---------------------------------------------------------------------------
  // Data & Navigation
  // ---------------------------------------------------------------------------

  /** Key to store the user's response in collectedData */
  collects?: string

  /** Server action to run after this step (e.g., 'fetchPropertyData') */
  action?: string

  /** Skip this step if condition returns false */
  condition?: (ctx: FlowContext) => boolean

  /** Next step ID - can be static or dynamic based on response */
  next: string | null | ((response: StepResponse, ctx: FlowContext) => string | null)

  /** If true, this step doesn't wait for user input (auto-advances after action) */
  autoAdvance?: boolean

  /** Validation function for user input */
  validate?: (response: StepResponse, ctx: FlowContext) => ValidationResult
}

// =============================================================================
// Input Types
// =============================================================================

export type InputType =
  | 'text'
  | 'address_autocomplete'
  | 'camera'
  | 'calendar'
  | 'time_picker'
  | 'phone'
  | 'email'
  | 'number'

export interface Chip {
  label: string
  value: string
  /** Override next step when this chip is selected */
  next?: string
  /** Icon name (optional) */
  icon?: string
  /** Run an action instead of collecting a value */
  action?: string
}

export interface Prefill {
  /** Text that appears in the input */
  text: string
  /** Value to record if user doesn't change it */
  value?: string
  /** Source indicator (e.g., "location", "profile", "previous") */
  source?: string
  /** Source display text (e.g., "Based on your location") */
  sourceLabel?: string
  /** Allow user to dismiss the prefill */
  dismissible?: boolean
}

/** Dynamic prefill based on context */
export type PrefillFn = (ctx: FlowContext) => Prefill | null

// =============================================================================
// Flow Context & State
// =============================================================================

export interface FlowContext {
  /** All data collected during the flow */
  collectedData: Record<string, unknown>

  /** Current authenticated user (if any) */
  user: FlowUser | null
  isAuthenticated: boolean

  /** Browser-detected location (if available) */
  browserLocation?: BrowserLocation

  /** Property data fetched from address */
  property?: PropertyData

  /** Calculated values */
  calculatedTonnage?: number
  matchedPros?: ProData[]
  pricingOptions?: PricingOption[]

  /** Flow metadata */
  flowId: string
  currentStepId: string
  history: FlowHistoryEntry[]

  /** Timestamps */
  startedAt: Date
  lastActiveAt: Date
}

export interface FlowUser {
  id: string
  email: string
  name?: string
  avatarUrl?: string
}

export interface BrowserLocation {
  latitude: number
  longitude: number
  formatted?: string
  city?: string
  state?: string
}

export interface PropertyData {
  address: string
  formattedAddress: string
  placeId?: string
  latitude: number
  longitude: number
  street?: string
  city?: string
  state?: string
  postalCode?: string
  sqft?: number
  yearBuilt?: number
  beds?: number
  baths?: number
  stories?: number
  lotSizeSqft?: number
  propertyType?: string
}

export interface ProData {
  id: string
  name: string
  rating: number
  reviewCount: number
  laborWarrantyYears: number
  yearsInBusiness: number
  logoUrl?: string
  price?: number
}

export interface PricingOption {
  id: string
  tier: 'good' | 'better' | 'best'
  brand: string
  productLine: string
  seer: number
  stages: number
  price: number
  monthlyPayment?: number
  features: string[]
}

// =============================================================================
// Flow History
// =============================================================================

export interface FlowHistoryEntry {
  stepId: string
  prompt: string
  response: StepResponse
  timestamp: Date
  /** If user edited this step later */
  editedAt?: Date
}

export interface StepResponse {
  /** The display text (what user sees in their message bubble) */
  displayText: string
  /** The actual value stored */
  value: unknown
  /** If response came from a chip */
  fromChip?: boolean
  /** If response came from prefill (unmodified) */
  fromPrefill?: boolean
  /** If response came from a card selection */
  fromCard?: boolean
}

// =============================================================================
// Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean
  error?: string
  /** Message to show user when validation fails */
  message?: string
  /** If true, stay on the current step after showing the message */
  stayOnStep?: boolean
}

// =============================================================================
// Flow Actions
// =============================================================================

export interface FlowActionResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  /** Update context with this data */
  contextUpdates?: Partial<FlowContext>
}

export type FlowAction = (
  ctx: FlowContext,
  response?: StepResponse
) => Promise<FlowActionResult>

// =============================================================================
// Edit Intent Detection
// =============================================================================

export interface EditIntent {
  detected: boolean
  /** The step ID to edit (if detected) */
  targetStepId?: string
  /** The field/topic mentioned */
  topic?: string
}

/** Keywords that indicate edit intent */
export const EDIT_KEYWORDS = [
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
]

/** Map topics to step IDs - flow-specific */
export type EditTopicMap = Record<string, string>
