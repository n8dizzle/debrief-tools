/**
 * Flow State Management
 * Zustand store for the AC replacement purchase flow
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  FlowState,
  FlowActions,
  FlowStep,
  FlowPhase,
  HomeData,
  EquipmentData,
  DiscoveryData,
  PricingOption,
  ProOption,
  Addon,
  ChatMessage,
  ChatButton,
  OrderTotals,
  ChatPhase,
  IntroState,
  HVACFlowData,
  IntentReason,
  SystemUrgency,
  EstimatedAge,
  SystemScope,
  SizingMethod,
  ThermostatCount,
  TargetZone,
  ZoneSqft,
  IndoorUnitLocation,
  HeatSource,
  PreAuthIntentType,
  PreAuthScopeType,
} from "@/types/flow"
import type {
  HomeFitContext,
  HVACSystemCard,
  ProductGroup,
  ProductDetail,
  ProPricing,
  RecommendedUpgrade,
} from "@/types/hvac-shopping"

// =============================================================================
// HVAC Shopping State Types
// =============================================================================

export type SheetType = 'product-detail' | 'system-detail' | null

export interface HVACShoppingState {
  // HomeFit context (what we're pricing for)
  homeFitContext: HomeFitContext | null
  // Current system(s) detected
  currentSystems: HVACSystemCard[]
  // Available products
  productGroups: ProductGroup[]
  // Selected product for detail view
  selectedShoppingProduct: ProductDetail | null
  // Selected pro within product (renamed to avoid conflict with flow's selectedPro)
  selectedShoppingPro: ProPricing | null
  // Selected tonnage
  selectedTonnage: number | null
  // Selected upgrades
  selectedUpgrades: string[]
  // Payment type preference
  paymentType: 'cash' | 'financing'
  // Active sheet
  activeSheet: SheetType
}

export interface HVACShoppingActions {
  // HomeFit context
  setHomeFitContext: (ctx: HomeFitContext | null) => void
  // Current systems
  setCurrentSystems: (systems: HVACSystemCard[]) => void
  // Products
  setProductGroups: (products: ProductGroup[]) => void
  // Selection
  selectShoppingProduct: (product: ProductDetail | null) => void
  selectShoppingPro: (pro: ProPricing | null) => void
  selectTonnage: (tonnage: number | null) => void
  toggleUpgrade: (upgradeId: string) => void
  setPaymentType: (type: 'cash' | 'financing') => void
  // Sheet management
  openSheet: (type: SheetType) => void
  closeSheet: () => void
  // Reset shopping state
  resetShopping: () => void
}

const initialShoppingState: HVACShoppingState = {
  homeFitContext: null,
  currentSystems: [],
  productGroups: [],
  selectedShoppingProduct: null,
  selectedShoppingPro: null,
  selectedTonnage: null,
  selectedUpgrades: [],
  paymentType: 'cash',
  activeSheet: null,
}

const STEP_ORDER: FlowStep[] = [
  "home",
  "address",
  "loading",
  "agent",
  "pricing",
  "pros",
  "addons",
  "scheduling",
  "checkout",
  "confirmation",
]

// Initial HVAC flow data (from spec)
const initialHVACFlowData: HVACFlowData = {
  // Phase 1: Intent
  intentReason: null,
  systemUrgency: null,
  estimatedAge: null,
  scope: null,

  // Phase 2: Sizing
  sizingMethod: null,
  photoData: null,
  questionsData: null,

  // Heat source
  heatSource: null,

  // Property data
  propertyData: null,

  // Calculated
  finalTonnage: null,
  tonnageSource: null,
}

const initialDiscoveryData: DiscoveryData = {
  // Homepage triage fields
  intent: null,
  urgency: null,
  problemSummary: null,
  needsAddress: true,
  nextAction: null,

  // AC-specific fields
  equipment: null,
  sizing: {
    confirmed: false,
    tonnage: 0,
    source: "calculated",
  },
  comfort: {
    tempBalance: null,
    allergies: null,
  },

  // HVAC Pricing Flow data
  hvacFlow: initialHVACFlowData,
}

const initialTotals: OrderTotals = {
  base: 0,
  addons: 0,
  recurringAddons: 0,
  rushFee: 0,
  total: 0,
  deposit: 0,
  balance: 0,
}

const initialIntroState: IntroState = {
  showTags: true,
  showAddressInput: false,
  addressQuery: "",
}

const initialState: FlowState & HVACShoppingState = {
  step: "home",
  flowPhase: "intro",
  userIntent: "",
  preAuthIntent: null,
  preAuthScope: null,
  homeData: null,
  cachedPropertyData: null,
  discoveryData: initialDiscoveryData,
  selectedTier: null,
  selectedPro: null,
  selectedAddons: [],
  scheduledDate: null,
  scheduledTime: null,
  customerName: null,
  customerPhone: null,
  totals: initialTotals,
  orderId: null,
  chatHistory: [],
  chatPhase: "intro",
  introState: initialIntroState,
  isLoading: false,
  loadingMessage: undefined,
  _hasHydrated: false, // Track localStorage hydration
  // HVAC Shopping state
  ...initialShoppingState,
}

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Calculate tonnage from square footage
export function calculateTonnageFromSqft(sqft: number): number {
  // Rule of thumb: 1 ton per 400-500 sqft in Texas climate
  // Using 450 as middle ground for DFW
  const rawTonnage = sqft / 450
  // Round to nearest 0.5 ton
  const roundedTonnage = Math.round(rawTonnage * 2) / 2
  // Clamp between 1.5 and 5 tons
  return Math.max(1.5, Math.min(5, roundedTonnage))
}

export const useFlowStore = create<FlowState & FlowActions & HVACShoppingState & HVACShoppingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Navigation
      setStep: (step) => set({ step }),

      nextStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().step)
        if (currentIndex < STEP_ORDER.length - 1) {
          set({ step: STEP_ORDER[currentIndex + 1] })
        }
      },

      previousStep: () => {
        const currentIndex = STEP_ORDER.indexOf(get().step)
        if (currentIndex > 0) {
          set({ step: STEP_ORDER[currentIndex - 1] })
        }
      },

      reset: () => set(initialState),

      // Intent
      setUserIntent: (intent) => set({ userIntent: intent }),

      // Pre-auth validation
      setPreAuthIntent: (intent) => set({ preAuthIntent: intent }),
      setPreAuthScope: (scope) => set({ preAuthScope: scope }),

      // Home data
      setHomeData: (data) => {
        if (data === null) {
          // Clear home data
          set({ homeData: null })
          return
        }
        // Also calculate initial sizing if we have sqft
        const discoveryData = { ...get().discoveryData }
        if (data.sqft && !discoveryData.sizing.confirmed) {
          discoveryData.sizing = {
            confirmed: false,
            tonnage: calculateTonnageFromSqft(data.sqft),
            source: "calculated",
          }
        }
        set({ homeData: data, discoveryData })
      },

      // Cached property data (prevents duplicate API calls)
      setCachedPropertyData: (data) => set({ cachedPropertyData: data }),

      // Discovery
      setEquipment: (equipment) => {
        const discoveryData = { ...get().discoveryData }
        discoveryData.equipment = equipment
        // If equipment has tonnage, update sizing
        if (equipment.tonnage) {
          discoveryData.sizing = {
            confirmed: true,
            tonnage: equipment.tonnage,
            source: equipment.method === "photo" ? "photo" : "manual",
          }
        }
        set({ discoveryData })
      },

      setSizing: (tonnage, source) => {
        const discoveryData = { ...get().discoveryData }
        discoveryData.sizing = {
          confirmed: true,
          tonnage,
          source,
        }
        set({ discoveryData })
      },

      setComfort: (field, value) => {
        const discoveryData = { ...get().discoveryData }
        if (field === "tempBalance") {
          discoveryData.comfort.tempBalance = value as DiscoveryData["comfort"]["tempBalance"]
        } else if (field === "allergies") {
          discoveryData.comfort.allergies = value as boolean | null
        }
        set({ discoveryData })
      },

      // HVAC Flow setters (from spec)
      setHVACFlowField: (field, value) => {
        const discoveryData = { ...get().discoveryData }
        if (!discoveryData.hvacFlow) {
          discoveryData.hvacFlow = { ...initialHVACFlowData }
        }
        discoveryData.hvacFlow = {
          ...discoveryData.hvacFlow,
          [field]: value,
        }
        set({ discoveryData })
      },

      setHVACPhotoData: (data) => {
        const discoveryData = { ...get().discoveryData }
        if (!discoveryData.hvacFlow) {
          discoveryData.hvacFlow = { ...initialHVACFlowData }
        }
        discoveryData.hvacFlow = {
          ...discoveryData.hvacFlow,
          sizingMethod: "photo",
          photoData: data,
          finalTonnage: data.tonnage,
          tonnageSource: data.tonnage ? "photo" : null,
        }
        // Also update legacy sizing if tonnage was extracted
        if (data.tonnage) {
          discoveryData.sizing = {
            confirmed: true,
            tonnage: data.tonnage,
            source: "photo",
          }
        }
        set({ discoveryData })
      },

      setHVACQuestionsData: (field, value) => {
        const discoveryData = { ...get().discoveryData }
        if (!discoveryData.hvacFlow) {
          discoveryData.hvacFlow = { ...initialHVACFlowData }
        }
        discoveryData.hvacFlow.sizingMethod = "questions"
        if (!discoveryData.hvacFlow.questionsData) {
          discoveryData.hvacFlow.questionsData = {
            thermostatCount: null,
            targetZone: null,
            zoneSqft: null,
            comfortIssues: null,
            indoorUnitLocation: null,
            estimatedTonnage: null,
          }
        }
        discoveryData.hvacFlow.questionsData = {
          ...discoveryData.hvacFlow.questionsData,
          [field]: value,
        }

        // Calculate tonnage from sqft if we have it
        if (field === "zoneSqft" && value) {
          const sqftMap: Record<string, number> = {
            "<1000": 800,
            "1000-1500": 1250,
            "1500-2000": 1750,
            "2000+": 2500,
          }
          const sqft = sqftMap[value as string]
          if (sqft) {
            const tonnage = calculateTonnageFromSqft(sqft)
            discoveryData.hvacFlow.questionsData.estimatedTonnage = tonnage
            discoveryData.hvacFlow.finalTonnage = tonnage
            discoveryData.hvacFlow.tonnageSource = "questions"
            // Also update legacy sizing
            discoveryData.sizing = {
              confirmed: false,
              tonnage,
              source: "calculated",
            }
          }
        }

        set({ discoveryData })
      },

      resetHVACFlow: () => {
        const discoveryData = { ...get().discoveryData }
        discoveryData.hvacFlow = { ...initialHVACFlowData }
        set({ discoveryData })
      },

      // Pricing
      setSelectedTier: (tier) => {
        set({ selectedTier: tier })
        get().calculateTotals()
      },

      // Pro
      setSelectedPro: (pro) => {
        set({ selectedPro: pro })
        get().calculateTotals()
      },

      // Add-ons
      toggleAddon: (addon) => {
        const currentAddons = get().selectedAddons
        const exists = currentAddons.find((a) => a.id === addon.id)
        if (exists) {
          set({ selectedAddons: currentAddons.filter((a) => a.id !== addon.id) })
        } else {
          set({ selectedAddons: [...currentAddons, addon] })
        }
        get().calculateTotals()
      },

      setAddons: (addons) => {
        set({ selectedAddons: addons })
        get().calculateTotals()
      },

      // Scheduling
      setSchedule: (date, time) => {
        set({ scheduledDate: date, scheduledTime: time })
        get().calculateTotals()
      },

      // Contact info
      setContactInfo: (name, phone) => {
        set({ customerName: name, customerPhone: phone })
      },

      // Order
      setOrderId: (id) => set({ orderId: id }),

      calculateTotals: () => {
        const { selectedPro, selectedAddons, scheduledDate } = get()

        // Base price from selected pro
        const base = selectedPro?.price ?? 0

        // One-time add-on costs
        const oneTimeAddons = selectedAddons
          .filter((a) => !a.recurring && !a.includedFree)
          .reduce((sum, a) => sum + a.price, 0)

        // Recurring add-on costs (first year)
        const recurringAddons = selectedAddons
          .filter((a) => a.recurring && !a.includedFree)
          .reduce((sum, a) => sum + a.price, 0)

        // Rush fee if scheduling tomorrow (simplified logic)
        const RUSH_FEE_DOLLARS = 150
        let rushFee = 0
        if (scheduledDate) {
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          // Parse date string as local time to avoid UTC conversion issues
          const scheduled = new Date(scheduledDate + "T12:00:00")
          if (scheduled.toDateString() === tomorrow.toDateString()) {
            rushFee = RUSH_FEE_DOLLARS
          }
        }

        const total = base + oneTimeAddons + rushFee
        const deposit = Math.round(total * 0.1 * 100) / 100 // 10% deposit
        const balance = Math.round((total - deposit) * 100) / 100

        set({
          totals: {
            base,
            addons: oneTimeAddons,
            recurringAddons,
            rushFee,
            total,
            deposit,
            balance,
          },
        })
      },

      // Chat
      addChatMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: generateId(),
          timestamp: new Date(),
        }
        set({ chatHistory: [...get().chatHistory, newMessage] })
      },

      updateLastMessage: (content, buttons) => {
        const history = [...get().chatHistory]
        if (history.length > 0) {
          const lastMessage = history[history.length - 1]
          history[history.length - 1] = {
            ...lastMessage,
            content,
            buttons,
            isLoading: false,
          }
          set({ chatHistory: history })
        }
      },

      clearChat: () => set({ chatHistory: [] }),

      // Chat phase
      setChatPhase: (chatPhase) => set({ chatPhase }),

      // Flow phase (SPA)
      setFlowPhase: (flowPhase) => set({ flowPhase }),

      // Intro state
      setIntroState: (state) =>
        set((prev) => ({
          introState: { ...prev.introState, ...state },
        })),

      // Loading
      setLoading: (isLoading, message) =>
        set({ isLoading, loadingMessage: message }),

      // Database sync - convert DB record to flow HomeData
      syncHomeFromDatabase: (dbHome) => {
        const homeData = {
          address: dbHome.formatted_address || dbHome.street_address,
          formattedAddress: dbHome.formatted_address || `${dbHome.street_address}, ${dbHome.city}, ${dbHome.state} ${dbHome.zip_code}`,
          placeId: "", // Not stored in DB, but not needed for display
          latitude: dbHome.lat ?? 0,
          longitude: dbHome.lng ?? 0,
          street: dbHome.street_address,
          city: dbHome.city,
          state: dbHome.state,
          postalCode: dbHome.zip_code,
          sqft: dbHome.sqft,
          yearBuilt: dbHome.year_built,
          beds: dbHome.beds,
          baths: dbHome.baths,
          lotSizeSqft: dbHome.lot_size_sqft,
          stories: dbHome.stories,
        }
        console.log("[FlowState] Synced home from database:", homeData.formattedAddress)
        set({ homeData })
      },

      // Hydration tracking (called by persist middleware)
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // =========================================================================
      // HVAC Shopping Actions
      // =========================================================================

      setHomeFitContext: (ctx) => set({ homeFitContext: ctx }),

      setCurrentSystems: (systems) => set({ currentSystems: systems }),

      setProductGroups: (products) => set({ productGroups: products }),

      selectShoppingProduct: (product) => {
        set({ selectedShoppingProduct: product })
        // Auto-select the recommended tonnage if available
        if (product?.availableSizes) {
          const fitSize = product.availableSizes.find((s) => s.isFit)
          if (fitSize) {
            set({ selectedTonnage: fitSize.tonnage })
          }
        }
        // Auto-select the first pro if none selected
        if (product?.pros.length && !get().selectedShoppingPro) {
          set({ selectedShoppingPro: product.pros[0] })
        }
      },

      selectShoppingPro: (pro) => set({ selectedShoppingPro: pro }),

      selectTonnage: (tonnage) => set({ selectedTonnage: tonnage }),

      toggleUpgrade: (upgradeId) => {
        const current = get().selectedUpgrades
        if (current.includes(upgradeId)) {
          set({ selectedUpgrades: current.filter((id) => id !== upgradeId) })
        } else {
          set({ selectedUpgrades: [...current, upgradeId] })
        }
      },

      setPaymentType: (type) => set({ paymentType: type }),

      openSheet: (type) => set({ activeSheet: type }),

      closeSheet: () => set({ activeSheet: null }),

      resetShopping: () => set(initialShoppingState),
    }),
    {
      name: "homework-flow-state",
      version: 3, // Bumped: Phase 2 wired to catalog APIs, clears stale hardcoded data
      migrate: (persistedState: unknown, version: number) => {
        // Handle migrations from older versions
        if (version < 3) {
          // Return fresh state — old versions had hardcoded pricing data
          return {}
        }
        return persistedState
      },
      partialize: (state) => ({
        // Persist these fields across page reloads
        userIntent: state.userIntent,
        preAuthIntent: state.preAuthIntent,
        preAuthScope: state.preAuthScope,
        homeData: state.homeData,
        cachedPropertyData: state.cachedPropertyData,
        discoveryData: state.discoveryData,
        selectedTier: state.selectedTier,
        selectedPro: state.selectedPro,
        selectedAddons: state.selectedAddons,
        scheduledDate: state.scheduledDate,
        scheduledTime: state.scheduledTime,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        totals: state.totals,
        // Persist chat history so conversation continues after OAuth redirect
        chatHistory: state.chatHistory,
        chatPhase: state.chatPhase,
        // DON'T persist flowPhase - it causes loops when returning to the site
        // flowPhase: state.flowPhase,
        // Don't persist step - let routing handle it
        // Don't persist introState - it's UI state that should reset
      }),
      onRehydrateStorage: () => (state) => {
        // Called when localStorage hydration completes
        if (state) {
          console.log("[FlowState] Hydration complete, homeData:", state.homeData?.formattedAddress || "none")
          state.setHasHydrated(true)
        }
      },
    }
  )
)

// Selector hooks for common patterns
export const useFlowStep = () => useFlowStore((s) => s.step)
export const useHomeData = () => useFlowStore((s) => s.homeData)
export const useDiscoveryData = () => useFlowStore((s) => s.discoveryData)
export const useSelectedTier = () => useFlowStore((s) => s.selectedTier)
export const useSelectedPro = () => useFlowStore((s) => s.selectedPro)
export const useSelectedAddons = () => useFlowStore((s) => s.selectedAddons)
export const useTotals = () => useFlowStore((s) => s.totals)
export const useChatHistory = () => useFlowStore((s) => s.chatHistory)
export const useChatPhase = () => useFlowStore((s) => s.chatPhase)
export const useIntroState = () => useFlowStore((s) => s.introState)
export const useFlowPhase = () => useFlowStore((s) => s.flowPhase)
export const useHasHydrated = () => useFlowStore((s) => s._hasHydrated ?? false)

// HVAC Shopping selectors
export const useHomeFitContext = () => useFlowStore((s) => s.homeFitContext)
export const useCurrentSystems = () => useFlowStore((s) => s.currentSystems)
export const useProductGroups = () => useFlowStore((s) => s.productGroups)
export const useSelectedShoppingProduct = () => useFlowStore((s) => s.selectedShoppingProduct)
export const useSelectedShoppingPro = () => useFlowStore((s) => s.selectedShoppingPro)
export const useSelectedTonnage = () => useFlowStore((s) => s.selectedTonnage)
export const useSelectedUpgrades = () => useFlowStore((s) => s.selectedUpgrades)
export const usePaymentType = () => useFlowStore((s) => s.paymentType)
export const useActiveSheet = () => useFlowStore((s) => s.activeSheet)

/**
 * HVAC Flow Step Types
 * Determines what question to ask next in the HVAC flow
 */
export type HVACFlowStep =
  | "sizing_method"     // Photo or questions?
  | "thermostat_count"  // How many thermostats?
  | "target_zone"       // Which zone are we sizing for?
  | "zone_sqft"         // What's the approximate sqft?
  | "comfort_issues"    // Hot/cold rooms?
  | "indoor_location"   // Where's the indoor unit?
  | "heat_source"       // Gas, electric, or heat pump?
  | "ready"             // All questions answered

/**
 * Determine the next step in the HVAC flow based on collected data
 * Returns null if we can't determine (shouldn't happen)
 */
export function getNextHVACStep(hvacFlow: HVACFlowData | null): HVACFlowStep {
  // No flow data yet - start with sizing
  if (!hvacFlow) {
    return "sizing_method"
  }

  // Step 1: Sizing method
  if (!hvacFlow.sizingMethod) {
    return "sizing_method"
  }

  // If using questions path, need to answer questions
  if (hvacFlow.sizingMethod === "questions") {
    const q = hvacFlow.questionsData
    if (!q?.thermostatCount) return "thermostat_count"
    if (!q?.targetZone) return "target_zone"
    if (!q?.zoneSqft) return "zone_sqft"
    if (q?.comfortIssues === null || q?.comfortIssues === undefined) return "comfort_issues"
    if (!q?.indoorUnitLocation) return "indoor_location"
  }

  // Photo path - check if we have valid data
  if (hvacFlow.sizingMethod === "photo") {
    // If photo was taken but no tonnage extracted, might need questions fallback
    if (!hvacFlow.photoData?.tonnage && !hvacFlow.finalTonnage) {
      return "sizing_method" // Restart sizing
    }
  }

  // Heat source (both paths need this)
  if (!hvacFlow.heatSource) {
    return "heat_source"
  }

  // All done
  return "ready"
}

/**
 * Get a user-friendly description of the next step
 */
export function getHVACStepQuestion(step: HVACFlowStep): {
  question: string
  options?: Array<{ label: string; value: string }>
} {
  switch (step) {
    case "sizing_method":
      return {
        question: "To get accurate pricing, I need to figure out your system size. The easiest way is a photo of your outdoor unit's data plate.",
        options: [
          { label: "Take a photo", value: "sizing_photo" },
          { label: "Answer questions instead", value: "sizing_questions" },
        ],
      }
    case "thermostat_count":
      return {
        question: "How many thermostats does your home have?",
        options: [
          { label: "1", value: "thermostat_1" },
          { label: "2", value: "thermostat_2" },
          { label: "3 or more", value: "thermostat_3" },
        ],
      }
    case "target_zone":
      return {
        question: "Which area are we focusing on?",
        options: [
          { label: "Upstairs only", value: "zone_upstairs" },
          { label: "Downstairs only", value: "zone_downstairs" },
          { label: "Whole house", value: "zone_both" },
        ],
      }
    case "zone_sqft":
      return {
        question: "Roughly how large is that area?",
        options: [
          { label: "Under 1,000 sqft", value: "sqft_under_1000" },
          { label: "1,000-1,500 sqft", value: "sqft_1000_1500" },
          { label: "1,500-2,000 sqft", value: "sqft_1500_2000" },
          { label: "Over 2,000 sqft", value: "sqft_over_2000" },
        ],
      }
    case "comfort_issues":
      return {
        question: "Does your home have any rooms that are hard to keep comfortable?",
        options: [
          { label: "No, runs fine", value: "comfort_no_issues" },
          { label: "Some hot/cold spots", value: "comfort_some_issues" },
          { label: "Significant issues", value: "comfort_major_issues" },
        ],
      }
    case "indoor_location":
      return {
        question: "Where is your indoor unit located?",
        options: [
          { label: "Attic", value: "location_attic" },
          { label: "Closet", value: "location_closet" },
          { label: "Garage", value: "location_garage" },
          { label: "Not sure", value: "location_unknown" },
        ],
      }
    case "heat_source":
      return {
        question: "What type of heating does your current system use?",
        options: [
          { label: "Gas furnace", value: "heat_gas" },
          { label: "Electric heat", value: "heat_electric" },
          { label: "Heat pump", value: "heat_pump" },
        ],
      }
    case "ready":
      return {
        question: "I have everything I need. Let me put together your pricing options.",
      }
  }
}
