/**
 * HVAC Replacement Flow
 *
 * The complete flow for a homeowner getting a new HVAC system.
 * From initial intent through checkout.
 */

import type { Flow, FlowContext } from '../types'
import { DEMO_HVAC_SYSTEM_DOWNSTAIRS, DEMO_HOMEFIT_CONTEXT } from '@/lib/demo-data/hvac-systems'
import { DEMO_PRODUCTS, getProductDetail } from '@/lib/demo-data/hvac-products'

export const hvacReplacementFlow: Flow = {
  id: 'hvac_replacement',
  name: 'HVAC Replacement',
  description: 'Get pricing for a new HVAC system',
  initialStep: 'situation',

  steps: [
    // =========================================================================
    // STEP 1: Situation / Qualification
    // =========================================================================
    {
      id: 'situation',
      prompt: "What's going on with your current system?",
      chips: [
        { label: "It's struggling to keep up", value: 'struggling' },
        { label: "It's old and I want to upgrade", value: 'upgrade' },
        { label: 'A contractor said I need a new one', value: 'contractor_said' },
        { label: 'Just exploring options', value: 'exploring' },
      ],
      collects: 'situation',
      next: 'system_scope',
    },

    // =========================================================================
    // STEP 2: System Scope
    // =========================================================================
    {
      id: 'system_scope',
      prompt: (ctx: FlowContext) => {
        const situation = ctx.collectedData.situation
        if (situation === 'struggling') {
          return "Got it. Is it the cooling, heating, or both that's giving you trouble?"
        }
        if (situation === 'contractor_said') {
          return "Did they mention if it's the AC, furnace, or the whole system?"
        }
        return "Are you looking at cooling, heating, or both?"
      },
      chips: [
        { label: 'Both (whole system)', value: 'both' },
        { label: 'Cooling only', value: 'cooling' },
        { label: 'Heating only', value: 'heating' },
      ],
      prefill: {
        text: "Both. I need a whole new system",
        value: 'both',
      },
      collects: 'systemScope',
      next: 'address_intro',
    },

    // =========================================================================
    // STEP 3: Address Introduction (build trust before asking)
    // =========================================================================
    {
      id: 'address_intro',
      prompt: "To show you pricing, I need your address. I'll pull up your home's basic info and check which pros serve your area. No sales calls, no spam.",
      chips: [
        { label: 'Sounds good', value: 'ready' },
        { label: 'Why do you need my address?', value: 'why' },
      ],
      prefill: {
        text: "Sounds good",
        value: 'ready',
      },
      validate: (response) => {
        if (response.value === 'why') {
          return {
            valid: false,
            message: "Your address helps me find pros who serve your area and pull basic home info like square footage. I'll ask a few more questions to figure out the right system size. Ready?",
            stayOnStep: true,
          }
        }
        return { valid: true }
      },
      next: 'address',
    },

    // =========================================================================
    // STEP 4: Address
    // =========================================================================
    {
      id: 'address',
      prompt: "What's your address?",
      inputType: 'address_autocomplete',
      prefill: (ctx: FlowContext) =>
        ctx.browserLocation?.formatted
          ? {
              text: ctx.browserLocation.formatted,
              value: ctx.browserLocation.formatted,
              source: 'location',
              sourceLabel: 'Based on your location',
              dismissible: true,
            }
          : null,
      collects: 'address',
      action: 'fetchPropertyData',
      validate: (response, ctx) => {
        const text = response.displayText.toLowerCase()

        // Check if user is asking a question
        const questionIndicators = [
          'why', 'what', 'how', 'do you', 'can you', 'will you',
          '?', 'need that', 'need my', 'need it', 'necessary',
          'have to', 'required', 'private', 'safe', 'secure'
        ]

        const isQuestion = questionIndicators.some(q => text.includes(q))

        if (isQuestion) {
          return {
            valid: false,
            message: "Your address helps me find contractors who serve your area and look up basic home info. Your info stays private.",
            stayOnStep: true,
          }
        }

        // Check if it looks like an address (has numbers and letters)
        const hasNumbers = /\d/.test(text)
        const hasStreetIndicators = /(st|street|ave|avenue|dr|drive|rd|road|ln|lane|ct|court|blvd|way|pl|place)/i.test(text)

        if (!hasNumbers && !hasStreetIndicators && text.length < 10) {
          return {
            valid: false,
            message: "That doesn't look like an address. Try including your street number and name.",
            stayOnStep: true,
          }
        }

        return { valid: true }
      },
      next: 'property_confirm',
    },

    // =========================================================================
    // STEP 5: Property Confirmation
    // =========================================================================
    {
      id: 'property_confirm',
      prompt: (ctx: FlowContext) => {
        const p = ctx.property
        if (!p) return "Let me look up your home details..."
        const details = [
          p.sqft ? `${p.sqft.toLocaleString()} sq ft` : null,
          p.yearBuilt ? `built ${p.yearBuilt}` : null,
        ].filter(Boolean).join(', ')
        return details ? `Found it. ${details}. Is this your home?` : "Found it. Is this your home?"
      },
      card: 'PropertyCard',
      cardProps: (ctx: FlowContext) => ({
        property: ctx.property,
        showMap: true,
      }),
      chips: [
        { label: "That's not my home", value: 'wrong', next: 'address' },
      ],
      prefill: {
        text: "Yes, that's my home",
        value: 'confirmed',
      },
      collects: 'propertyConfirmed',
      next: 'existing_system',
    },

    // =========================================================================
    // STEP 6: Existing System (detected equipment)
    // =========================================================================
    {
      id: 'existing_system',
      prompt: (ctx: FlowContext) => {
        // In production, this would come from warranty lookup or prior scans
        const systemAge = DEMO_HVAC_SYSTEM_DOWNSTAIRS.estimatedAge
        return `I found some info about your current system. Looks like it's about ${systemAge} years old.`
      },
      card: 'SystemCard',
      cardProps: () => ({
        system: DEMO_HVAC_SYSTEM_DOWNSTAIRS,
      }),
      chips: [
        { label: "That's not right", value: 'wrong', next: 'current_system' },
      ],
      prefill: {
        text: "Looks about right",
        value: 'confirmed',
      },
      collects: 'existingSystemConfirmed',
      next: 'system_type',
    },

    // =========================================================================
    // STEP 4: Current System Detection
    // =========================================================================
    {
      id: 'current_system',
      prompt: "To size your new system accurately, I need info about your current one. Want to snap a photo of your outdoor unit?",
      chips: [
        { label: 'Scan my unit', value: 'scan', next: 'scan_unit' },
        { label: "I don't know my system", value: 'unknown', next: 'guided_sizing' },
      ],
      prefill: {
        text: "I'll scan it",
        value: 'scan',
      },
      collects: 'systemDetectionMethod',
      next: 'scan_unit',
    },

    // =========================================================================
    // STEP 5a: Scan Unit (photo flow)
    // =========================================================================
    {
      id: 'scan_unit',
      prompt: "Take a photo of the data plate—it's usually on the side of the outdoor unit.",
      inputType: 'camera',
      action: 'analyzeEquipmentPhoto',
      collects: 'equipmentPhoto',
      next: 'system_detected',
    },

    // =========================================================================
    // STEP 5b: System Detected (after scan)
    // =========================================================================
    {
      id: 'system_detected',
      prompt: (ctx: FlowContext) => {
        // This would use data from the photo analysis
        const tonnage = ctx.calculatedTonnage || 3
        const sqft = ctx.property?.sqft?.toLocaleString() || 'your home'
        return `I found a ${tonnage}-ton system. Based on ${sqft} sq ft, that's the right size for your replacement.`
      },
      card: 'SizingCard',
      autoAdvance: false,
      chips: [
        { label: "That's wrong", value: 'wrong', next: 'guided_sizing' },
      ],
      prefill: {
        text: "Looks right",
        value: 'confirmed',
      },
      collects: 'sizingConfirmed',
      next: 'auth_gate',
    },

    // =========================================================================
    // STEP 5c: Guided Sizing (manual flow)
    // =========================================================================
    {
      id: 'guided_sizing',
      prompt: "No problem. How many stories is your home?",
      chips: [
        { label: '1 story', value: '1' },
        { label: '2 stories', value: '2' },
        { label: '3+ stories', value: '3' },
      ],
      prefill: (ctx: FlowContext) => {
        const stories = ctx.property?.stories
        if (stories) {
          return {
            text: `${stories} ${stories === 1 ? 'story' : 'stories'}`,
            value: String(stories),
            source: 'property',
            sourceLabel: 'From your home data',
            dismissible: true,
          }
        }
        return null
      },
      collects: 'stories',
      next: 'system_age',
    },

    // =========================================================================
    // STEP 6: System Age
    // =========================================================================
    {
      id: 'system_age',
      prompt: "About how old is your current system?",
      chips: [
        { label: 'Under 10 years', value: '<10' },
        { label: '10-15 years', value: '10-15' },
        { label: '15-20 years', value: '15-20' },
        { label: 'Over 20 years', value: '20+' },
        { label: 'No idea', value: 'unknown' },
      ],
      collects: 'systemAge',
      next: 'calculate_sizing',
    },

    // =========================================================================
    // STEP 7: Calculate Sizing (auto-advance)
    // =========================================================================
    {
      id: 'calculate_sizing',
      prompt: (ctx: FlowContext) => {
        const sqft = ctx.property?.sqft || 2000
        const tonnage = ctx.calculatedTonnage || Math.ceil(sqft / 745)
        return `Based on your ${sqft.toLocaleString()} sq ft home in DFW, you need a ${tonnage}-ton system.`
      },
      card: 'SizingCard',
      cardProps: (ctx: FlowContext) => ({
        sqft: ctx.property?.sqft,
        tonnage: ctx.calculatedTonnage,
        climate: 'DFW',
      }),
      action: 'calculateTonnage',
      autoAdvance: false,
      prefill: {
        text: "Got it",
        value: 'acknowledged',
      },
      next: 'auth_gate',
    },

    // =========================================================================
    // STEP 8: Auth Gate
    // =========================================================================
    {
      id: 'auth_gate',
      condition: (ctx: FlowContext) => !ctx.isAuthenticated,
      prompt: "To see real pricing from vetted local pros, let's save your progress.",
      chips: [
        { label: 'Continue with Google', value: 'google', action: 'authGoogle' },
        { label: 'Continue with email', value: 'email', action: 'authEmail' },
      ],
      next: 'system_type',
    },

    // =========================================================================
    // STEP 9: System Type
    // =========================================================================
    {
      id: 'system_type',
      prompt: (ctx: FlowContext) => {
        const scope = ctx.collectedData.systemScope
        if (scope === 'cooling') {
          return "What type of cooling system do you want?"
        }
        if (scope === 'heating') {
          return "What type of heating system do you want?"
        }
        return "What type of system do you want?"
      },
      card: 'SystemTypeCard',
      chips: [
        { label: 'AC + Gas Furnace', value: 'split_gas' },
        { label: 'Heat Pump (all-electric)', value: 'heat_pump' },
        { label: 'AC only', value: 'ac_only' },
      ],
      prefill: {
        text: "AC + Gas Furnace (most common in DFW)",
        value: 'split_gas',
      },
      collects: 'systemType',
      next: 'pricing_options',
    },

    // =========================================================================
    // STEP 10: Pricing Options (Product Browse)
    // =========================================================================
    {
      id: 'pricing_options',
      prompt: (ctx: FlowContext) => {
        const tonnage = DEMO_HOMEFIT_CONTEXT.tonnage
        return `Here are your options for a ${tonnage}-ton ${DEMO_HOMEFIT_CONTEXT.systemType}. Tap any tier to compare pros.`
      },
      card: 'ProductBrowseCard',
      cardProps: () => ({
        products: DEMO_PRODUCTS,
        homeFit: DEMO_HOMEFIT_CONTEXT,
      }),
      collects: 'selectedTier',
      next: 'pro_selection',
    },

    // =========================================================================
    // STEP 11: Pro Selection
    // =========================================================================
    {
      id: 'pro_selection',
      prompt: (ctx: FlowContext) => {
        const tier = ctx.collectedData.selectedTier as any
        const tierName = tier?.name || 'your system'
        return `Great choice. Here are the pros who can install ${tierName}:`
      },
      card: 'ProSelectionCard',
      cardProps: (ctx: FlowContext) => ({
        pros: ctx.matchedPros,
        selectedTier: ctx.collectedData.selectedTier,
      }),
      action: 'matchPros',
      collects: 'selectedPro',
      next: 'addons',
    },

    // =========================================================================
    // STEP 12: Add-ons
    // =========================================================================
    {
      id: 'addons',
      prompt: "Any extras? These are popular additions:",
      card: 'AddonsCard',
      chips: [
        { label: 'Skip extras', value: 'none', next: 'schedule_date' },
      ],
      prefill: {
        text: "No extras needed",
        value: 'none',
      },
      collects: 'selectedAddons',
      next: 'schedule_date',
    },

    // =========================================================================
    // STEP 13: Schedule Date
    // =========================================================================
    {
      id: 'schedule_date',
      prompt: (ctx: FlowContext) => {
        const pro = ctx.collectedData.selectedPro as any
        const proName = pro?.name || 'Your pro'
        return `${proName} has openings this week. What day works?`
      },
      inputType: 'calendar',
      card: 'CalendarCard',
      collects: 'scheduledDate',
      next: 'schedule_time',
    },

    // =========================================================================
    // STEP 14: Schedule Time
    // =========================================================================
    {
      id: 'schedule_time',
      prompt: "What time works best?",
      inputType: 'time_picker',
      action: 'fetchAvailableSlots',
      card: 'TimeSlotCard',
      collects: 'scheduledTime',
      next: 'contact_info',
    },

    // =========================================================================
    // STEP 15: Contact Info
    // =========================================================================
    {
      id: 'contact_info',
      prompt: "Where should we send confirmation?",
      card: 'ContactCard',
      prefill: (ctx: FlowContext) => {
        const user = ctx.user
        if (user?.email) {
          return {
            text: user.email,
            value: user.email,
            source: 'profile',
            sourceLabel: 'From your account',
            dismissible: true,
          }
        }
        return null
      },
      inputType: 'email',
      collects: 'contactEmail',
      next: 'contact_phone',
    },

    // =========================================================================
    // STEP 16: Contact Phone
    // =========================================================================
    {
      id: 'contact_phone',
      prompt: "And a phone number for the installer to reach you?",
      inputType: 'phone',
      collects: 'contactPhone',
      next: 'review',
    },

    // =========================================================================
    // STEP 17: Review
    // =========================================================================
    {
      id: 'review',
      prompt: "Here's your order summary:",
      card: 'OrderSummaryCard',
      cardProps: (ctx: FlowContext) => ({
        property: ctx.property,
        selectedTier: ctx.collectedData.selectedTier,
        selectedPro: ctx.collectedData.selectedPro,
        selectedAddons: ctx.collectedData.selectedAddons,
        scheduledDate: ctx.collectedData.scheduledDate,
        scheduledTime: ctx.collectedData.scheduledTime,
      }),
      action: 'createOrder',
      chips: [
        { label: 'Edit something', value: 'edit', next: 'edit_prompt' },
      ],
      prefill: {
        text: "Looks good. Let's pay",
        value: 'confirmed',
      },
      collects: 'orderConfirmed',
      next: 'payment',
    },

    // =========================================================================
    // STEP 18: Payment
    // =========================================================================
    {
      id: 'payment',
      prompt: "Just the deposit today. $500 locks in your price and date. The rest is due after installation.",
      card: 'PaymentCard',
      cardProps: {
        depositAmount: 500,
        showStripe: true,
      },
      action: 'processPayment',
      collects: 'paymentComplete',
      next: 'confirmation',
    },

    // =========================================================================
    // STEP 19: Confirmation
    // =========================================================================
    {
      id: 'confirmation',
      prompt: (ctx: FlowContext) => {
        const date = ctx.collectedData.scheduledDate as string
        const pro = ctx.collectedData.selectedPro as any
        return `You're all set. ${pro?.name || 'Your pro'} will see you on ${date}. Check your email for confirmation details.`
      },
      card: 'ConfirmationCard',
      cardProps: (ctx: FlowContext) => ({
        property: ctx.property,
        scheduledDate: ctx.collectedData.scheduledDate,
        scheduledTime: ctx.collectedData.scheduledTime,
        pro: ctx.collectedData.selectedPro,
        orderId: ctx.collectedData.orderId,
      }),
      next: null, // End of flow
    },

    // =========================================================================
    // EDIT PROMPT (helper step)
    // =========================================================================
    {
      id: 'edit_prompt',
      prompt: "What would you like to change?",
      chips: [
        { label: 'System choice', value: 'system', next: 'pricing_options' },
        { label: 'Pro', value: 'pro', next: 'pro_selection' },
        { label: 'Add-ons', value: 'addons', next: 'addons' },
        { label: 'Date/time', value: 'schedule', next: 'schedule_date' },
      ],
      next: 'review',
    },
  ],
}

// =============================================================================
// Edit Topic Mapping
// =============================================================================

/**
 * Map natural language topics to step IDs for edit detection
 */
export const hvacEditTopicMap: Record<string, string> = {
  // Situation/qualification
  situation: 'situation',
  problem: 'situation',
  issue: 'situation',
  'whats wrong': 'situation',
  struggling: 'situation',
  // Scope
  scope: 'system_scope',
  cooling: 'system_scope',
  heating: 'system_scope',
  both: 'system_scope',
  ac: 'system_scope',
  furnace: 'system_scope',
  // Address
  address: 'address',
  home: 'address',
  location: 'address',
  house: 'address',
  // Sizing
  stories: 'guided_sizing',
  story: 'guided_sizing',
  floors: 'guided_sizing',
  age: 'system_age',
  old: 'system_age',
  years: 'system_age',
  // System type
  type: 'system_type',
  'system type': 'system_type',
  'heat pump': 'system_type',
  'gas furnace': 'system_type',
  // Pricing
  pricing: 'pricing_options',
  price: 'pricing_options',
  tier: 'pricing_options',
  options: 'pricing_options',
  // Pro selection
  pro: 'pro_selection',
  contractor: 'pro_selection',
  installer: 'pro_selection',
  // Add-ons
  addons: 'addons',
  extras: 'addons',
  // Scheduling
  date: 'schedule_date',
  time: 'schedule_time',
  schedule: 'schedule_date',
  // Contact
  email: 'contact_info',
  phone: 'contact_phone',
  contact: 'contact_info',
}
