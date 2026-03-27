/**
 * Deterministic Chat Responses - HVAC Pricing Flow
 *
 * This module provides consistent, predefined responses for the HVAC pricing flow.
 * Based on the spec: hvac-pricing-flow-spec.md
 *
 * Flow Overview:
 * PHASE 1: Understand Intent (why looking?, urgency/age, scope)
 * PHASE 2: Sizing (photo path OR questions path)
 * PHASE 3: Address + Property Data
 * PHASE 4: The Tease (pre-auth summary)
 * AUTH GATE
 * PHASE 5: The Reveal (pricing)
 */

import type { ChatButton, NextAction, HomeData, DiscoveryData } from "@/types/flow"

export interface DeterministicResponse {
  message: string
  buttons?: ChatButton[]
  nextAction?: NextAction | null
  readyForPricing?: boolean
  readyForAddress?: boolean
  // New: track which flow field to update
  updateField?: {
    path: string // e.g., "hvacFlow.intentReason"
    value: string | number | boolean
  }
}

interface ResponseEntry {
  triggers: string[]
  patterns?: RegExp[]
  response: DeterministicResponse
  conditions?: {
    hasHomeData?: boolean
    hasEquipment?: boolean
    intent?: string
  }
}

// =============================================================================
// PHASE 1: UNDERSTAND INTENT
// =============================================================================

const PHASE1_RESPONSES: ResponseEntry[] = [
  // ---------------------------------------------------------------------------
  // Step 1A: Initial HVAC pricing request → Why are you looking?
  // ---------------------------------------------------------------------------
  {
    triggers: [
      "new_hvac_pricing",
      "hvac_pricing",
      "new_ac_pricing",
      "ac_pricing",
      "replace_ac",
      "replace_my_ac",
      "ac_replacement",
      "new_ac",
      "new_hvac",
      "get_ac_pricing",
      "get_hvac_pricing",
      "i_want_to_see_pricing_for_a_new_hvac_system",
    ],
    patterns: [
      /^(i )?(want|need) (new |to replace |to see pricing )?(my )?(hvac|ac|air conditioning)/i,
      /^(get|show|see) (me )?(hvac|ac) pric(e|ing)/i,
      /^replace (my )?(hvac|ac|air conditioning)/i,
      /^new (hvac|ac) system/i,
    ],
    response: {
      message: "Got it - I can help with HVAC pricing.\n\nWhat's prompting you to look?",
      buttons: [
        { label: "It's not working right", value: "intent_not_working", emoji: "🔧" },
        { label: "It's getting old/inefficient", value: "intent_old_inefficient", emoji: "📅" },
        { label: "Just exploring", value: "intent_exploring", emoji: "🔍" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Step 1B: Urgency check (if "not working")
  // ---------------------------------------------------------------------------
  {
    triggers: ["intent_not_working", "its_not_working_right", "not_working"],
    response: {
      message: "Is it completely down, or just not keeping up?",
      buttons: [
        { label: "Not cooling/heating at all", value: "urgency_emergency", emoji: "❄️" },
        { label: "Running but not keeping up", value: "urgency_struggling", emoji: "😓" },
      ],
      updateField: { path: "hvacFlow.intentReason", value: "not_working" },
    },
  },

  // After urgency selection → go to scope
  {
    triggers: ["urgency_emergency", "not_cooling/heating_at_all", "not_coolingheating_at_all"],
    response: {
      message:
        "I'll flag this as urgent so we can prioritize contractors with immediate availability.\n\nAre you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.systemUrgency", value: "emergency" },
    },
  },
  {
    triggers: ["urgency_struggling", "running_but_not_keeping_up"],
    response: {
      message:
        "Got it. Are you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.systemUrgency", value: "struggling" },
    },
  },

  // ---------------------------------------------------------------------------
  // Step 1C: Age check (if "old/inefficient")
  // ---------------------------------------------------------------------------
  {
    triggers: ["intent_old_inefficient", "its_getting_old/inefficient", "its_getting_oldinefficient", "old_inefficient"],
    response: {
      message: "Makes sense. Do you know roughly how old your system is?",
      buttons: [
        { label: "5-10 years", value: "age_5_10" },
        { label: "10-15 years", value: "age_10_15" },
        { label: "15+ years", value: "age_15_plus" },
        { label: "Not sure", value: "age_unknown" },
      ],
      updateField: { path: "hvacFlow.intentReason", value: "old_inefficient" },
    },
  },

  // After age selection → go to scope
  {
    triggers: ["age_5_10", "5-10_years", "510_years"],
    response: {
      message:
        "That's still relatively young - might be worth repairing depending on the issue. But let's see what replacement would cost.\n\nAre you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.estimatedAge", value: "5-10" },
    },
  },
  {
    triggers: ["age_10_15", "10-15_years", "1015_years"],
    response: {
      message:
        "That's getting to the age where replacement often makes more sense than major repairs.\n\nAre you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.estimatedAge", value: "10-15" },
    },
  },
  {
    triggers: ["age_15_plus", "15+_years", "15_years"],
    response: {
      message:
        "15+ years is a good run. Newer systems are significantly more efficient - you'll likely see lower energy bills.\n\nAre you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.estimatedAge", value: "15+" },
    },
  },
  {
    triggers: ["age_unknown", "not_sure"],
    response: {
      message:
        "No problem - we can figure that out from your equipment.\n\nAre you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.estimatedAge", value: "unknown" },
    },
  },

  // ---------------------------------------------------------------------------
  // "Just exploring" → Skip to scope directly
  // ---------------------------------------------------------------------------
  {
    triggers: ["intent_exploring", "just_exploring", "exploring"],
    response: {
      message:
        "Smart to plan ahead. Are you looking to replace the whole system, or just part of it?",
      buttons: [
        { label: "Whole system (AC + heating)", value: "scope_whole_system", emoji: "🏠" },
        { label: "Just the AC (cooling)", value: "scope_ac_only", emoji: "❄️" },
        { label: "Just the heating", value: "scope_heating_only", emoji: "🔥" },
        { label: "Not sure yet", value: "scope_unsure", emoji: "❓" },
      ],
      updateField: { path: "hvacFlow.intentReason", value: "exploring" },
    },
  },

  // ---------------------------------------------------------------------------
  // Step 1D: Scope selection → Go to Phase 2 (Sizing Fork)
  // ---------------------------------------------------------------------------
  {
    triggers: ["scope_whole_system", "whole_system_ac_+_heating", "whole_system_ac__heating", "whole_system"],
    response: {
      message:
        "To give you accurate pricing, I need to know what size system you have now.\n\nThe fastest way? Snap a photo of your outdoor unit's data plate - it tells me exactly what you have.",
      buttons: [
        { label: "Take a photo", value: "sizing_photo", emoji: "📸" },
        { label: "I'd rather answer some questions", value: "sizing_questions", emoji: "💬" },
      ],
      updateField: { path: "hvacFlow.scope", value: "whole_system" },
    },
  },
  {
    triggers: ["scope_ac_only", "just_the_ac_cooling", "just_the_ac", "ac_only"],
    response: {
      message:
        "Just the AC, got it. To give you accurate pricing, I need to know what size system you have.\n\nThe fastest way? Snap a photo of your outdoor unit's data plate.",
      buttons: [
        { label: "Take a photo", value: "sizing_photo", emoji: "📸" },
        { label: "I'd rather answer some questions", value: "sizing_questions", emoji: "💬" },
      ],
      updateField: { path: "hvacFlow.scope", value: "ac_only" },
    },
  },
  {
    triggers: ["scope_heating_only", "just_the_heating", "heating_only"],
    response: {
      message:
        "Just the heating - I can help with that. To size it correctly, the fastest way is to snap a photo of your current equipment's data plate.",
      buttons: [
        { label: "Take a photo", value: "sizing_photo", emoji: "📸" },
        { label: "I'd rather answer some questions", value: "sizing_questions", emoji: "💬" },
      ],
      updateField: { path: "hvacFlow.scope", value: "heating_only" },
    },
  },
  {
    triggers: ["scope_unsure", "not_sure_yet"],
    response: {
      message:
        "No problem - we can figure that out together.\n\nFirst, let me understand what you have. Can you snap a photo of your outdoor unit's data plate?",
      buttons: [
        { label: "Take a photo", value: "sizing_photo", emoji: "📸" },
        { label: "I'd rather answer some questions", value: "sizing_questions", emoji: "💬" },
      ],
      updateField: { path: "hvacFlow.scope", value: "unsure" },
    },
  },
]

// =============================================================================
// PHASE 2: SIZING - QUESTIONS PATH
// =============================================================================

const PHASE2_QUESTIONS_RESPONSES: ResponseEntry[] = [
  // ---------------------------------------------------------------------------
  // Step 2A: User chooses questions path
  // ---------------------------------------------------------------------------
  {
    triggers: ["sizing_questions", "id_rather_answer_some_questions", "answer_questions"],
    response: {
      message: "No problem. A few quick questions will help me size this correctly.\n\nHow many thermostats do you have?",
      buttons: [
        { label: "1 thermostat (whole home)", value: "thermostats_1" },
        { label: "2 thermostats (2 zones)", value: "thermostats_2" },
        { label: "3 or more", value: "thermostats_3" },
      ],
      updateField: { path: "hvacFlow.sizingMethod", value: "questions" },
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2B-Q1: Thermostat count
  // ---------------------------------------------------------------------------
  {
    triggers: ["thermostats_1", "1_thermostat_whole_home", "1_thermostat"],
    response: {
      message: "Roughly how much square footage does your home have?\n\nDon't worry about being exact - a rough estimate works.",
      buttons: [
        { label: "Under 1,000 sq ft", value: "sqft_under_1000" },
        { label: "1,000 - 1,500 sq ft", value: "sqft_1000_1500" },
        { label: "1,500 - 2,000 sq ft", value: "sqft_1500_2000" },
        { label: "2,000+ sq ft", value: "sqft_2000_plus" },
        { label: "Not sure", value: "sqft_unknown" },
      ],
    },
  },
  {
    triggers: ["thermostats_2", "2_thermostats_2_zones", "2_thermostats"],
    response: {
      message: "Which system are you looking to replace?",
      buttons: [
        { label: "Upstairs / 2nd floor", value: "zone_upstairs" },
        { label: "Downstairs / Main floor", value: "zone_downstairs" },
        { label: "Both systems", value: "zone_both" },
      ],
    },
  },
  {
    triggers: ["thermostats_3", "3_or_more"],
    response: {
      message: "Multiple zones - which one are you looking to replace?",
      buttons: [
        { label: "Upstairs / 2nd floor", value: "zone_upstairs" },
        { label: "Downstairs / Main floor", value: "zone_downstairs" },
        { label: "Both systems", value: "zone_both" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2B-Q2: Zone identification (if 2+ thermostats)
  // ---------------------------------------------------------------------------
  {
    triggers: ["zone_upstairs", "upstairs_/_2nd_floor", "upstairs_2nd_floor"],
    response: {
      message: "Roughly how much square footage does the upstairs cover?",
      buttons: [
        { label: "Under 1,000 sq ft", value: "sqft_under_1000" },
        { label: "1,000 - 1,500 sq ft", value: "sqft_1000_1500" },
        { label: "1,500 - 2,000 sq ft", value: "sqft_1500_2000" },
        { label: "2,000+ sq ft", value: "sqft_2000_plus" },
        { label: "Not sure", value: "sqft_unknown" },
      ],
    },
  },
  {
    triggers: ["zone_downstairs", "downstairs_/_main_floor", "downstairs_main_floor"],
    response: {
      message: "Roughly how much square footage does the main floor cover?",
      buttons: [
        { label: "Under 1,000 sq ft", value: "sqft_under_1000" },
        { label: "1,000 - 1,500 sq ft", value: "sqft_1000_1500" },
        { label: "1,500 - 2,000 sq ft", value: "sqft_1500_2000" },
        { label: "2,000+ sq ft", value: "sqft_2000_plus" },
        { label: "Not sure", value: "sqft_unknown" },
      ],
    },
  },
  {
    triggers: ["zone_both", "both_systems"],
    response: {
      message: "Let's start with the larger zone. What's the rough square footage of your whole home?",
      buttons: [
        { label: "Under 2,000 sq ft", value: "sqft_under_1000" },
        { label: "2,000 - 3,000 sq ft", value: "sqft_1500_2000" },
        { label: "3,000+ sq ft", value: "sqft_2000_plus" },
        { label: "Not sure", value: "sqft_unknown" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2B-Q3: Square footage → Comfort check
  // ---------------------------------------------------------------------------
  {
    triggers: ["sqft_under_1000", "under_1000_sq_ft", "under_1,000_sq_ft"],
    response: {
      message: "Does your current system keep the space comfortable, or does it struggle?",
      buttons: [
        { label: "Keeps up fine", value: "comfort_fine", emoji: "✓" },
        { label: "Has hot/cold spots or struggles on extreme days", value: "comfort_issues", emoji: "😓" },
      ],
    },
  },
  {
    triggers: ["sqft_1000_1500", "1000_-_1500_sq_ft", "1,000_-_1,500_sq_ft", "1000_1500_sq_ft"],
    response: {
      message: "Does your current system keep the space comfortable, or does it struggle?",
      buttons: [
        { label: "Keeps up fine", value: "comfort_fine", emoji: "✓" },
        { label: "Has hot/cold spots or struggles on extreme days", value: "comfort_issues", emoji: "😓" },
      ],
    },
  },
  {
    triggers: ["sqft_1500_2000", "1500_-_2000_sq_ft", "1,500_-_2,000_sq_ft", "1500_2000_sq_ft"],
    response: {
      message: "Does your current system keep the space comfortable, or does it struggle?",
      buttons: [
        { label: "Keeps up fine", value: "comfort_fine", emoji: "✓" },
        { label: "Has hot/cold spots or struggles on extreme days", value: "comfort_issues", emoji: "😓" },
      ],
    },
  },
  {
    triggers: ["sqft_2000_plus", "2000+_sq_ft", "2,000+_sq_ft", "2000_sq_ft"],
    response: {
      message: "Does your current system keep the space comfortable, or does it struggle?",
      buttons: [
        { label: "Keeps up fine", value: "comfort_fine", emoji: "✓" },
        { label: "Has hot/cold spots or struggles on extreme days", value: "comfort_issues", emoji: "😓" },
      ],
    },
  },
  {
    triggers: ["sqft_unknown"],
    response: {
      message: "No problem - we'll verify from property records later.\n\nDoes your current system keep the space comfortable?",
      buttons: [
        { label: "Keeps up fine", value: "comfort_fine", emoji: "✓" },
        { label: "Has hot/cold spots or struggles on extreme days", value: "comfort_issues", emoji: "😓" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2B-Q4: Comfort check → Indoor unit location
  // ---------------------------------------------------------------------------
  {
    triggers: ["comfort_fine", "keeps_up_fine"],
    response: {
      message: "Good to know - current sizing is probably right.\n\nWhere is your indoor unit (furnace or air handler) located?",
      buttons: [
        { label: "Attic", value: "location_attic", emoji: "🏠" },
        { label: "Closet", value: "location_closet", emoji: "🚪" },
        { label: "Garage", value: "location_garage", emoji: "🚗" },
        { label: "Basement", value: "location_basement", emoji: "🏚️" },
        { label: "Not sure", value: "location_unknown", emoji: "❓" },
      ],
    },
  },
  {
    triggers: ["comfort_issues", "has_hotcold_spots_or_struggles_on_extreme_days", "has_hot/cold_spots"],
    response: {
      message: "That's helpful - we may want to consider sizing up.\n\nWhere is your indoor unit (furnace or air handler) located?",
      buttons: [
        { label: "Attic", value: "location_attic", emoji: "🏠" },
        { label: "Closet", value: "location_closet", emoji: "🚪" },
        { label: "Garage", value: "location_garage", emoji: "🚗" },
        { label: "Basement", value: "location_basement", emoji: "🏚️" },
        { label: "Not sure", value: "location_unknown", emoji: "❓" },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Step 2B-Q5: Indoor unit location → Heat source
  // ---------------------------------------------------------------------------
  {
    triggers: ["location_attic", "attic"],
    response: {
      message: "Attic install - noted.\n\nWhat type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },
  {
    triggers: ["location_closet", "closet"],
    response: {
      message: "Closet install - noted.\n\nWhat type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },
  {
    triggers: ["location_garage", "garage"],
    response: {
      message: "Garage install - noted.\n\nWhat type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },
  {
    triggers: ["location_basement", "basement"],
    response: {
      message: "Basement install - that's usually the easiest to work with.\n\nWhat type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },
  {
    triggers: ["location_unknown"],
    response: {
      message: "No worries - we'll figure that out.\n\nWhat type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },
]

// =============================================================================
// PHASE 2: SIZING - PHOTO PATH
// =============================================================================

const PHASE2_PHOTO_RESPONSES: ResponseEntry[] = [
  // User chooses photo path - this triggers the camera/upload UI
  {
    triggers: ["sizing_photo", "take_a_photo"],
    response: {
      message:
        "Look for a metal plate on the side of your outdoor unit - usually near the electrical connection.\n\nCenter the data plate in the frame and make sure the text is readable.",
      buttons: [
        { label: "Open camera", value: "open_camera", emoji: "📷" },
        { label: "Upload a photo", value: "upload_photo", emoji: "📤" },
        { label: "Skip - answer questions instead", value: "sizing_questions", emoji: "💬" },
      ],
      nextAction: "PHOTO",
      updateField: { path: "hvacFlow.sizingMethod", value: "photo" },
    },
  },

  // After successful photo scan → Heat source
  {
    triggers: ["photo_confirmed", "looks_right", "✓_looks_right"],
    response: {
      message: "Great. What type of heating do you have?",
      buttons: [
        { label: "Gas furnace (natural gas)", value: "heat_gas", emoji: "🔥" },
        { label: "Electric heat (heat strips or electric furnace)", value: "heat_electric", emoji: "⚡" },
        { label: "Heat pump (heats and cools)", value: "heat_pump", emoji: "🌡️" },
        { label: "Not sure", value: "heat_unknown", emoji: "❓" },
      ],
    },
  },

  // Photo issues → Fall back to questions
  {
    triggers: ["photo_retry", "somethings_not_right", "✏️_somethings_not_right"],
    response: {
      message: "No problem. Would you like to try another photo, or answer a few questions instead?",
      buttons: [
        { label: "Try another photo", value: "sizing_photo", emoji: "📸" },
        { label: "Answer questions instead", value: "sizing_questions", emoji: "💬" },
      ],
    },
  },
]

// =============================================================================
// STEP 3: HEAT SOURCE (Both paths converge)
// =============================================================================

const HEAT_SOURCE_RESPONSES: ResponseEntry[] = [
  {
    triggers: ["heat_gas", "gas_furnace_natural_gas", "gas_furnace"],
    response: {
      message: "Gas furnace - got it.\n\nTo show you contractors in your area, what's your address?",
      buttons: [],
      nextAction: "ADDRESS",
      readyForAddress: true,
      updateField: { path: "hvacFlow.heatSource", value: "gas" },
    },
  },
  {
    triggers: ["heat_electric", "electric_heat_heat_strips_or_electric_furnace", "electric_heat"],
    response: {
      message: "Electric heat - noted.\n\nTo show you contractors in your area, what's your address?",
      buttons: [],
      nextAction: "ADDRESS",
      readyForAddress: true,
      updateField: { path: "hvacFlow.heatSource", value: "electric" },
    },
  },
  {
    triggers: ["heat_pump", "heat_pump_heats_and_cools"],
    response: {
      message: "Heat pump - great choice for efficiency.\n\nTo show you contractors in your area, what's your address?",
      buttons: [],
      nextAction: "ADDRESS",
      readyForAddress: true,
      updateField: { path: "hvacFlow.heatSource", value: "heat_pump" },
    },
  },
  {
    triggers: ["heat_unknown"],
    response: {
      message: "Quick way to tell: Do you have a gas bill, or is your home all-electric?",
      buttons: [
        { label: "Have gas bill", value: "heat_has_gas" },
        { label: "All electric", value: "heat_all_electric" },
      ],
    },
  },
  {
    triggers: ["heat_has_gas", "have_gas_bill"],
    response: {
      message: "Likely a gas furnace then.\n\nTo show you contractors in your area, what's your address?",
      buttons: [],
      nextAction: "ADDRESS",
      readyForAddress: true,
      updateField: { path: "hvacFlow.heatSource", value: "gas" },
    },
  },
  {
    triggers: ["heat_all_electric", "all_electric"],
    response: {
      message: "All electric - probably a heat pump or electric heat strips.\n\nTo show you contractors in your area, what's your address?",
      buttons: [],
      nextAction: "ADDRESS",
      readyForAddress: true,
      updateField: { path: "hvacFlow.heatSource", value: "electric" },
    },
  },
]

// =============================================================================
// PHASE 3: ADDRESS + PROPERTY DATA (handled by address component)
// =============================================================================

const PHASE3_RESPONSES: ResponseEntry[] = [
  // Property data confirmed → Show tease / auth gate
  {
    triggers: ["property_confirmed", "thats_right", "✓_thats_right"],
    response: {
      message: "I have everything I need to show you pricing. Let me pull up your options.",
      buttons: [{ label: "Show me what you found", value: "show_tease" }],
      nextAction: "OPTIONS",
    },
  },

  // Property data needs update
  {
    triggers: ["property_update", "update_something", "✏️_update_something"],
    response: {
      message: "What would you like to update?",
      buttons: [
        { label: "Square footage", value: "update_sqft" },
        { label: "Year built", value: "update_year" },
        { label: "Something else", value: "update_other" },
      ],
    },
  },
]

// =============================================================================
// POST-ADDRESS FLOW (Legacy support)
// =============================================================================

const POST_ADDRESS_RESPONSES: ResponseEntry[] = [
  // Already have address - proceed to equipment/discovery
  {
    triggers: ["continue", "proceed", "next", "show_pricing", "show_tease", "show_me_what_you_found"],
    conditions: { hasHomeData: true },
    response: {
      message: "Based on your home details and preferences, I'm ready to show you your pricing options.",
      buttons: [{ label: "View pricing", value: "view_pricing" }],
      nextAction: "OPTIONS",
      readyForPricing: true,
    },
  },

  // View pricing button
  {
    triggers: ["view_pricing"],
    response: {
      message: "Loading your personalized pricing...",
      nextAction: "OPTIONS",
      readyForPricing: true,
    },
  },
]

// =============================================================================
// AC REPAIR RESPONSES (keeping for other flows)
// =============================================================================

const AC_REPAIR_RESPONSES: ResponseEntry[] = [
  {
    triggers: ["ac_not_cooling", "ac_repair", "fix_ac", "ac_broken"],
    patterns: [
      /^(my )?ac (is|isn'?t) (not )?cooling/i,
      /^(my )?air (conditioning|conditioner) (is )?(not working|broken)/i,
    ],
    response: {
      message:
        "Sorry to hear your AC isn't cooling properly. Let me ask a couple questions to understand what's happening. Is the system running at all, or is it completely off?",
      buttons: [
        { label: "Running but not cooling", value: "running_not_cooling" },
        { label: "Completely off", value: "system_off" },
        { label: "Making strange noises", value: "strange_noises" },
      ],
    },
  },
]

// =============================================================================
// GENERAL RESPONSES
// =============================================================================

const GENERAL_RESPONSES: ResponseEntry[] = [
  {
    triggers: ["something_else", "other", "general"],
    response: {
      message:
        "No problem, I can help with lots of home service needs. Can you tell me a bit more about what's going on?",
      buttons: [],
    },
  },
]

// =============================================================================
// RESPONSE LOOKUP LOGIC
// =============================================================================

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
}

function checkConditions(
  entry: ResponseEntry,
  homeData: HomeData | null,
  discoveryData?: DiscoveryData
): boolean {
  if (!entry.conditions) return true

  const { hasHomeData, hasEquipment, intent } = entry.conditions

  if (hasHomeData !== undefined && !!homeData !== hasHomeData) {
    return false
  }

  if (hasEquipment !== undefined && discoveryData) {
    const hasEquip = !!discoveryData.equipment
    if (hasEquip !== hasEquipment) return false
  }

  if (intent !== undefined && discoveryData?.intent !== intent) {
    return false
  }

  return true
}

// All responses combined - order matters (more specific first)
const ALL_RESPONSES: ResponseEntry[] = [
  ...PHASE1_RESPONSES,
  ...PHASE2_QUESTIONS_RESPONSES,
  ...PHASE2_PHOTO_RESPONSES,
  ...HEAT_SOURCE_RESPONSES,
  ...PHASE3_RESPONSES,
  ...POST_ADDRESS_RESPONSES,
  ...AC_REPAIR_RESPONSES,
  ...GENERAL_RESPONSES,
]

/**
 * Look up a deterministic response for a given user input.
 */
export function getDeterministicResponse(
  userInput: string,
  homeData: HomeData | null = null,
  discoveryData?: DiscoveryData
): DeterministicResponse | null {
  const normalized = normalizeInput(userInput)

  for (const entry of ALL_RESPONSES) {
    if (!checkConditions(entry, homeData, discoveryData)) {
      continue
    }

    if (entry.triggers.includes(normalized)) {
      return entry.response
    }

    if (entry.patterns) {
      for (const pattern of entry.patterns) {
        if (pattern.test(userInput)) {
          return entry.response
        }
      }
    }
  }

  return null
}

/**
 * Check if an input matches any known deterministic response.
 */
export function hasDeterministicResponse(
  userInput: string,
  homeData: HomeData | null = null,
  discoveryData?: DiscoveryData
): boolean {
  return getDeterministicResponse(userInput, homeData, discoveryData) !== null
}

/**
 * Get all valid button values for debugging/validation.
 */
export function getValidButtonValues(): string[] {
  const values = new Set<string>()

  for (const entry of ALL_RESPONSES) {
    for (const trigger of entry.triggers) {
      values.add(trigger)
    }
    if (entry.response.buttons) {
      for (const button of entry.response.buttons) {
        values.add(button.value)
      }
    }
  }

  return Array.from(values)
}




