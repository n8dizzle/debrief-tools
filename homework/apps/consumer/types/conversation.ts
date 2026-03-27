/**
 * Conversation Types
 * Unified message types for the conversational UI
 */

export type MessageType =
  | 'text'
  | 'chips'
  | 'address-input'
  | 'property-reveal'
  | 'auth-prompt'
  | 'pricing-options'
  | 'pro-options'
  | 'addon-options'
  | 'schedule-picker'
  | 'checkout-summary'
  | 'loading'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChipButton {
  label: string
  value: string
  icon?: string
}

export interface ConversationMessage {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  buttons?: ChipButton[]
  data?: MessageData
  timestamp: Date
  isLoading?: boolean
}

// Union type for card-specific data
export type MessageData =
  | PropertyRevealData
  | AuthPromptData
  | PricingOptionsData
  | ProOptionsData
  | AddonOptionsData
  | SchedulePickerData
  | CheckoutSummaryData
  | null

export interface PropertyRevealData {
  kind: 'property-reveal'
  address: string
  latitude: number
  longitude: number
  sqft?: number | null
  yearBuilt?: number | null
  beds?: number | null
  baths?: number | null
  stories?: number | null
  lotSizeSqft?: number | null
  funFact?: string
  isConfirmed?: boolean
}

export interface AuthPromptData {
  kind: 'auth-prompt'
  prosCount?: number
  earliestDate?: string
}

export interface PricingTier {
  id: string
  name: string
  price: number
  description: string
  features: string[]
  recommended?: boolean
}

export interface PricingOptionsData {
  kind: 'pricing-options'
  tiers: PricingTier[]
  selectedId?: string
}

export interface ProOption {
  id: string
  name: string
  rating: number
  reviewCount: number
  price: number
  availability: string
  badges?: string[]
  avatarUrl?: string
}

export interface ProOptionsData {
  kind: 'pro-options'
  pros: ProOption[]
  selectedId?: string
}

export interface AddonOption {
  id: string
  name: string
  description: string
  price: number
  recurring?: boolean
  recommended?: boolean
}

export interface AddonOptionsData {
  kind: 'addon-options'
  addons: AddonOption[]
  selectedIds?: string[]
}

export interface TimeSlot {
  date: string
  time: string
  available: boolean
}

export interface SchedulePickerData {
  kind: 'schedule-picker'
  slots: TimeSlot[]
  selectedSlot?: { date: string; time: string }
}

export interface CheckoutSummaryData {
  kind: 'checkout-summary'
  items: Array<{ label: string; amount: number }>
  total: number
  deposit: number
}

// Helper to create messages
export function createMessage(
  role: MessageRole,
  content: string,
  options?: {
    type?: MessageType
    buttons?: ChipButton[]
    data?: MessageData
    isLoading?: boolean
  }
): ConversationMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role,
    type: options?.type || 'text',
    content,
    buttons: options?.buttons,
    data: options?.data,
    timestamp: new Date(),
    isLoading: options?.isLoading,
  }
}

// Helper to create a loading message
export function createLoadingMessage(): ConversationMessage {
  return createMessage('assistant', '', { type: 'loading', isLoading: true })
}
