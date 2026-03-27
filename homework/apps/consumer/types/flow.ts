/**
 * AC Replacement Flow Types
 * Complete type definitions for the vertical slice demo
 */

import type { PropertyData } from "@/lib/property-data-client"

// Flow step identifiers
export type FlowStep =
  | "home"
  | "address"
  | "loading"
  | "agent"
  | "pricing"
  | "pros"
  | "addons"
  | "scheduling"
  | "checkout"
  | "confirmation"

// Home data from property lookup
export interface HomeData {
  address: string
  formattedAddress: string
  placeId: string
  latitude: number
  longitude: number
  street?: string
  city?: string
  state?: string
  postalCode?: string
  sqft: number | null
  yearBuilt: number | null
  beds: number | null
  baths: number | null
  lotSizeSqft: number | null
  stories: number | null
  satelliteUrl?: string
}

// Equipment data from photo scan or manual entry
export interface EquipmentData {
  method: "photo" | "manual" | "skipped"
  brand?: string
  model?: string
  serial?: string
  tonnage?: number
  estimatedAge?: number
  seer?: number
  warrantyStatus?: WarrantyInfo
  photoUrl?: string
}

export interface WarrantyInfo {
  hasWarranty: boolean
  compressorExpires?: string
  partsExpires?: string
  laborExpires?: string
  message?: string
}

// Triage intent types for homepage routing
export type TriageIntent =
  | "ac_replacement"
  | "ac_repair"
  | "heating"
  | "plumbing"
  | "electrical"
  | "general_maintenance"
  | "emergency"
  | "unknown"

export type UrgencyLevel = "low" | "medium" | "high" | "emergency"

export type NextAction =
  | "ADDRESS"
  | "PHOTO"
  | "OPTIONS"
  | "SCHEDULE"
  | "HANDOFF"

// =============================================================================
// PRE-AUTH VALIDATION TYPES (simplified triage before auth)
// =============================================================================

// User's initial intent (replacement vs repair)
export type PreAuthIntentType = "replacement" | "repair" | "unsure"

// System scope for replacement
export type PreAuthScopeType = "full" | "ac_only" | "heat_only"

// =============================================================================
// HVAC PRICING FLOW TYPES (from spec)
// =============================================================================

// Phase 1: Intent
export type IntentReason = "not_working" | "old_inefficient" | "exploring"
export type SystemUrgency = "emergency" | "struggling" // if not_working
export type EstimatedAge = "5-10" | "10-15" | "15+" | "unknown" // if old_inefficient
export type SystemScope = "whole_system" | "ac_only" | "heating_only" | "unsure"

// Phase 2: Sizing
export type SizingMethod = "photo" | "questions"
export type ThermostatCount = 1 | 2 | 3
export type TargetZone = "upstairs" | "downstairs" | "both"
export type ZoneSqft = "<1000" | "1000-1500" | "1500-2000" | "2000+" | "unknown"
export type IndoorUnitLocation = "attic" | "closet" | "garage" | "basement" | "unknown"

// Phase 2/3: Heat source
export type HeatSource = "gas" | "electric" | "heat_pump"

// HVAC Flow Data - collected during the flow (pre-auth)
export interface HVACFlowData {
  // Phase 1: Intent
  intentReason: IntentReason | null
  systemUrgency: SystemUrgency | null // only if intentReason === 'not_working'
  estimatedAge: EstimatedAge | null // only if intentReason === 'old_inefficient'
  scope: SystemScope | null

  // Phase 2: Sizing
  sizingMethod: SizingMethod | null

  // Photo path data (if sizingMethod === 'photo')
  photoData: {
    brand: string | null
    modelNumber: string | null
    serialNumber: string | null
    tonnage: number | null
    seerRating: number | null
    manufactureYear: number | null
  } | null

  // Questions path data (if sizingMethod === 'questions')
  questionsData: {
    thermostatCount: ThermostatCount | null
    targetZone: TargetZone | null
    zoneSqft: ZoneSqft | null
    comfortIssues: boolean | null
    indoorUnitLocation: IndoorUnitLocation | null
    estimatedTonnage: number | null // calculated from sqft
  } | null

  // Heat source (both paths)
  heatSource: HeatSource | null

  // Phase 3: Property (from API after address)
  propertyData: {
    sqft: number | null
    yearBuilt: number | null
    beds: number | null
    baths: number | null
  } | null

  // Calculated/derived
  finalTonnage: number | null // from photo, questions, or property sqft
  tonnageSource: "photo" | "questions" | "property" | null
}

// Discovery data from agent conversation
export interface DiscoveryData {
  // Homepage triage fields
  intent: TriageIntent | null
  urgency: UrgencyLevel | null
  problemSummary: string | null
  needsAddress: boolean
  nextAction: NextAction | null

  // AC-specific fields (populated when intent is ac_replacement)
  equipment: EquipmentData | null
  sizing: {
    confirmed: boolean
    tonnage: number // calculated from sqft or from data plate
    source: "photo" | "calculated" | "manual"
  }
  comfort: {
    tempBalance: "even" | "some_issues" | "significant" | null
    allergies: boolean | null
  }

  // NEW: HVAC Pricing Flow data (from spec)
  hvacFlow: HVACFlowData | null
}

// Pricing tier options
export type TierLevel = "good" | "better" | "best"

export interface PricingOption {
  id: string
  tier: TierLevel
  productLine: string
  brand: string
  seer: number
  stages: "single" | "two" | "variable"
  priceRange: {
    min: number
    max: number
  }
  features: string[]
  recommended?: boolean
  bestFor?: string[]
}

// Contractor/Pro data
export interface ProOption {
  id: string
  name: string
  logo?: string
  rating: number
  reviewCount: number
  established: number
  installCount: number
  price: number // their specific price for this config
  laborWarrantyYears: number
  includedExtras: string[]
  nextAvailable: Date
  badges: string[]
}

// Add-on options
export interface Addon {
  id: string
  name: string
  description: string
  shortDescription?: string
  price: number
  recurring?: boolean
  recurringInterval?: "monthly" | "yearly"
  recommended?: boolean
  includedFree?: boolean
  category: "thermostat" | "maintenance" | "iaq" | "warranty" | "other"
}

// Time slot for scheduling
export interface TimeSlot {
  date: string // ISO date string
  time: string
  available: boolean
  rushFee?: number
}

// Order totals
export interface OrderTotals {
  base: number
  addons: number
  recurringAddons: number
  rushFee: number
  total: number
  deposit: number
  balance: number
}

// Chat phase for persistent chat
export type ChatPhase = "intro" | "agent" | "complete"

// Flow phase for SPA experience (drives which sections are visible)
export type FlowPhase =
  | "intro"        // Hero visible, chat with prompt tags
  | "address"      // Address input in chat, hero pushed down
  | "loading"      // Loading checklist in chat messages
  | "auth"         // Auth prompt appears below chat
  | "discovery"    // AI agent conversation
  | "pricing"      // Pricing cards section visible
  | "pros"         // Pro selection cards visible
  | "addons"       // Add-on selection visible
  | "schedule"     // Calendar/time picker visible
  | "contact"      // Contact info collection (name/phone)
  | "checkout"     // Order summary + payment
  | "confirmation" // Success state

// Chat mode based on route
export type ChatMode = "interactive" | "guidance" | "hidden"

// Chat message for agent conversation
export interface ChatMessage {
  id: string
  role: "agent" | "user" | "assistant" // assistant for intro, agent for flow
  content: string
  timestamp: Date
  buttons?: ChatButton[]
  isLoading?: boolean
  source?: "intro" | "agent" // track origin for unified history
  showAddressInput?: boolean // from intro chat
}

export interface ChatButton {
  label: string
  value: string
  emoji?: string
}

// Intro chat state (homepage-specific UI state)
export interface IntroState {
  showTags: boolean
  showAddressInput: boolean
  addressQuery: string
}

// Complete flow state
export interface FlowState {
  // Current step (legacy - for route-based flow)
  step: FlowStep

  // SPA flow phase (drives which sections are visible)
  flowPhase: FlowPhase

  // User's initial intent
  userIntent: string

  // Pre-auth validation (simplified triage)
  preAuthIntent: PreAuthIntentType | null
  preAuthScope: PreAuthScopeType | null

  // Property data
  homeData: HomeData | null

  // Cached full property data from Rentcast API (prevents duplicate API calls)
  cachedPropertyData: PropertyData | null

  // Discovery from agent
  discoveryData: DiscoveryData

  // Selected pricing tier
  selectedTier: PricingOption | null

  // Selected contractor
  selectedPro: ProOption | null

  // Selected add-ons
  selectedAddons: Addon[]

  // Scheduled installation
  scheduledDate: string | null // ISO date string
  scheduledTime: string | null

  // Customer contact info
  customerName: string | null
  customerPhone: string | null

  // Order totals
  totals: OrderTotals

  // Order confirmation
  orderId: string | null

  // Chat history (unified across intro and agent)
  chatHistory: ChatMessage[]

  // Chat phase tracking
  chatPhase: ChatPhase

  // Intro chat UI state
  introState: IntroState

  // Loading states
  isLoading: boolean
  loadingMessage?: string

  // Hydration tracking (internal - tracks when localStorage has been loaded)
  _hasHydrated: boolean
}

// Actions for the store
export interface FlowActions {
  // Navigation
  setStep: (step: FlowStep) => void
  nextStep: () => void
  previousStep: () => void
  reset: () => void

  // Intent
  setUserIntent: (intent: string) => void

  // Pre-auth validation
  setPreAuthIntent: (intent: PreAuthIntentType | null) => void
  setPreAuthScope: (scope: PreAuthScopeType | null) => void

  // Home data
  setHomeData: (data: HomeData | null) => void

  // Cached property data
  setCachedPropertyData: (data: PropertyData | null) => void

  // Discovery
  setEquipment: (equipment: EquipmentData) => void
  setSizing: (tonnage: number, source: "photo" | "calculated" | "manual") => void
  setComfort: (field: "tempBalance" | "allergies", value: unknown) => void

  // HVAC Flow (from spec)
  setHVACFlowField: <K extends keyof HVACFlowData>(field: K, value: HVACFlowData[K]) => void
  setHVACPhotoData: (data: NonNullable<HVACFlowData["photoData"]>) => void
  setHVACQuestionsData: <K extends keyof NonNullable<HVACFlowData["questionsData"]>>(
    field: K,
    value: NonNullable<HVACFlowData["questionsData"]>[K]
  ) => void
  resetHVACFlow: () => void

  // Pricing
  setSelectedTier: (tier: PricingOption) => void

  // Pro
  setSelectedPro: (pro: ProOption) => void

  // Add-ons
  toggleAddon: (addon: Addon) => void
  setAddons: (addons: Addon[]) => void

  // Scheduling
  setSchedule: (date: string, time: string) => void

  // Contact info
  setContactInfo: (name: string, phone: string) => void

  // Order
  setOrderId: (id: string) => void
  calculateTotals: () => void

  // Chat
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
  updateLastMessage: (content: string, buttons?: ChatButton[]) => void
  clearChat: () => void

  // Chat phase
  setChatPhase: (phase: ChatPhase) => void

  // Flow phase (SPA)
  setFlowPhase: (phase: FlowPhase) => void

  // Intro state
  setIntroState: (state: Partial<IntroState>) => void

  // Loading
  setLoading: (isLoading: boolean, message?: string) => void

  // Database sync
  syncHomeFromDatabase: (dbHome: {
    formatted_address: string | null
    street_address: string
    city: string
    state: string
    zip_code: string
    sqft: number | null
    year_built: number | null
    beds: number | null
    baths: number | null
    lot_size_sqft: number | null
    stories: number | null
    lat: number | null
    lng: number | null
  }) => void

  // Hydration (internal)
  setHasHydrated: (value: boolean) => void
}

// API Response types
export interface AddressLookupResponse {
  suggestions: Array<{
    placeId: string
    description: string
    mainText: string
    secondaryText: string
  }>
}

export interface AddressValidateResponse {
  valid: boolean
  inServiceArea: boolean
  address: {
    formatted: string
    street: string
    city: string
    state: string
    postalCode: string
    placeId: string
    latitude: number
    longitude: number
  }
}

export interface PropertyDataResponse {
  success: boolean
  data: Omit<HomeData, "address" | "formattedAddress" | "placeId" | "latitude" | "longitude">
  source: "api" | "mock"
}

export interface EquipmentScanResponse {
  success: boolean
  equipment: EquipmentData
  confidence: number
  rawText?: string
}

export interface AgentChatResponse {
  message: string
  buttons?: ChatButton[]
  nextAction?: NextAction | null
  readyForPricing?: boolean // backwards compatibility
  discoveryUpdate?: Partial<DiscoveryData>
}

export interface PricingOptionsResponse {
  options: PricingOption[]
  systemSize: {
    tonnage: number
    source: string
  }
}

export interface ProsAvailableResponse {
  pros: ProOption[]
}

export interface AddonsResponse {
  addons: Addon[]
}

export interface SchedulingSlotsResponse {
  slots: TimeSlot[]
  rushFeeAmount?: number
}

export interface CreateOrderResponse {
  success: boolean
  orderId: string
  orderNumber: string
}

// DFW service area zip codes (partial - will expand)
export const DFW_ZIP_CODES = [
  // Dallas
  "75201", "75202", "75203", "75204", "75205", "75206", "75207", "75208", "75209", "75210",
  "75211", "75212", "75214", "75215", "75216", "75217", "75218", "75219", "75220", "75221",
  "75223", "75224", "75225", "75226", "75227", "75228", "75229", "75230", "75231", "75232",
  "75233", "75234", "75235", "75236", "75237", "75238", "75240", "75241", "75243", "75244",
  "75246", "75247", "75248", "75249", "75250", "75251", "75252", "75253", "75254",
  // Fort Worth
  "76101", "76102", "76103", "76104", "76105", "76106", "76107", "76108", "76109", "76110",
  "76111", "76112", "76114", "76115", "76116", "76117", "76118", "76119", "76120", "76121",
  "76122", "76123", "76124", "76126", "76127", "76129", "76130", "76131", "76132", "76133",
  "76134", "76135", "76136", "76137", "76140", "76148", "76155", "76164", "76177", "76179",
  // Arlington
  "76001", "76002", "76006", "76010", "76011", "76012", "76013", "76014", "76015", "76016",
  "76017", "76018", "76019",
  // Plano
  "75023", "75024", "75025", "75026", "75074", "75075", "75086", "75093", "75094",
  // Irving
  "75014", "75015", "75016", "75017", "75038", "75039", "75060", "75061", "75062", "75063",
  // Garland
  "75040", "75041", "75042", "75043", "75044", "75045", "75046", "75047", "75048", "75049",
  // More suburbs
  "75019", "75034", "75035", "75056", "75057", "75065", "75067", "75068", "75069", "75070",
  "75071", "75077", "75078", "75080", "75081", "75082", "75083", "75088", "75089", "75098",
  "75104", "75115", "75116", "75134", "75137", "75141", "75146", "75149", "75150", "75154",
  "75159", "75166", "75180", "75181", "75182", "75287",
] as const

export function isInServiceArea(zipCode: string): boolean {
  return DFW_ZIP_CODES.includes(zipCode as typeof DFW_ZIP_CODES[number])
}
