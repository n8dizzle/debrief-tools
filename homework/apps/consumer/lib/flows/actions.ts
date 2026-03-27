/**
 * Flow Actions
 *
 * Server actions and client-side actions that flows can trigger.
 * These are called by step.action property.
 */

import type {
  FlowAction,
  FlowActionResult,
  FlowContext,
  StepResponse,
  PropertyData,
  ProData,
  PricingOption,
} from './types'
import { fetchPropertyData as fetchPropertyDataFromApi } from '@/lib/property-data-client'

// =============================================================================
// Action Registry
// =============================================================================

const actionRegistry: Record<string, FlowAction> = {}

export function registerAction(name: string, action: FlowAction) {
  actionRegistry[name] = action
}

export function getAction(name: string): FlowAction | undefined {
  return actionRegistry[name]
}

export async function executeAction(
  name: string,
  ctx: FlowContext,
  response?: StepResponse
): Promise<FlowActionResult> {
  const action = actionRegistry[name]
  if (!action) {
    return {
      success: false,
      error: `Action "${name}" not found`,
    }
  }

  try {
    return await action(ctx, response)
  } catch (error) {
    console.error(`Action "${name}" failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Action failed',
    }
  }
}

// =============================================================================
// Property Data Actions
// =============================================================================

/**
 * Fetch property data from address
 * Called after user confirms their address
 * Uses Rentcast.io API via property-data-client
 */
registerAction('fetchPropertyData', async (ctx, response) => {
  const address = response?.value as string
  if (!address) {
    return { success: false, error: 'No address provided' }
  }

  try {
    console.log('[FlowAction] Fetching property data for:', address)

    // Call the Rentcast API via our property data client
    const rentcastData = await fetchPropertyDataFromApi(address)

    console.log('[FlowAction] Property data received:', rentcastData.source)

    // Map Rentcast data to flow PropertyData type
    const propertyData: PropertyData = {
      address: rentcastData.addressLine1 || address,
      formattedAddress: rentcastData.formattedAddress || address,
      latitude: rentcastData.latitude || 0,
      longitude: rentcastData.longitude || 0,
      street: rentcastData.addressLine1,
      city: rentcastData.city,
      state: rentcastData.state,
      postalCode: rentcastData.zipCode,
      sqft: rentcastData.sqft,
      yearBuilt: rentcastData.yearBuilt,
      beds: rentcastData.beds,
      baths: rentcastData.baths,
      stories: rentcastData.stories,
      lotSizeSqft: rentcastData.lotSizeSqft,
      propertyType: rentcastData.propertyType,
    }

    // Also calculate tonnage while we have the sqft
    let calculatedTonnage: number | undefined
    if (propertyData.sqft) {
      // DFW climate calculation: ~745 sq ft per ton
      const tonnage = Math.ceil(propertyData.sqft / 745)
      calculatedTonnage = Math.max(2, Math.min(5, tonnage)) // 2-5 ton range
    }

    return {
      success: true,
      data: { property: propertyData, calculatedTonnage },
      contextUpdates: {
        property: propertyData,
        ...(calculatedTonnage && { calculatedTonnage }),
      },
    }
  } catch (error) {
    console.error('[FlowAction] Failed to fetch property data:', error)
    return {
      success: false,
      error: 'Failed to fetch property data',
    }
  }
})

// =============================================================================
// Sizing Actions
// =============================================================================

/**
 * Calculate system tonnage based on property data
 */
registerAction('calculateTonnage', async (ctx) => {
  const sqft = ctx.property?.sqft
  if (!sqft) {
    return { success: false, error: 'Property square footage not available' }
  }

  // DFW climate calculation: ~745 sq ft per ton
  const tonnage = Math.ceil(sqft / 745)
  const clampedTonnage = Math.max(2, Math.min(5, tonnage)) // 2-5 ton range

  return {
    success: true,
    data: { calculatedTonnage: clampedTonnage },
    contextUpdates: { calculatedTonnage: clampedTonnage },
  }
})

// =============================================================================
// Equipment Scan Actions
// =============================================================================

/**
 * Analyze equipment photo to extract system data
 */
registerAction('analyzeEquipmentPhoto', async (ctx, response) => {
  const photoData = response?.value
  if (!photoData) {
    return { success: false, error: 'No photo provided' }
  }

  // This would call your AI vision API to analyze the data plate
  // For now, returning success with placeholder
  return {
    success: true,
    data: {
      detectedBrand: null,
      detectedModel: null,
      detectedTonnage: null,
      detectedSeer: null,
      confidence: 0,
    },
  }
})

// =============================================================================
// Pro Matching Actions
// =============================================================================

/**
 * Match available pros based on location and system requirements
 */
registerAction('matchPros', async (ctx) => {
  const { property, calculatedTonnage, collectedData } = ctx

  if (!property) {
    return { success: false, error: 'Property data required' }
  }

  try {
    // Mock pro data for DFW area
    // TODO: Replace with actual API call to match pros based on location and availability
    const pros: ProData[] = [
      {
        id: 'pro-1',
        name: 'Comfort Solutions DFW',
        rating: 4.9,
        reviewCount: 247,
        laborWarrantyYears: 2,
        yearsInBusiness: 15,
        logoUrl: '/logos/comfort-solutions.png',
        price: 8500,
      },
      {
        id: 'pro-2',
        name: 'North Texas HVAC',
        rating: 4.7,
        reviewCount: 182,
        laborWarrantyYears: 1,
        yearsInBusiness: 12,
        logoUrl: '/logos/north-texas-hvac.png',
        price: 7800,
      },
      {
        id: 'pro-3',
        name: 'Elite Air Systems',
        rating: 4.8,
        reviewCount: 156,
        laborWarrantyYears: 3,
        yearsInBusiness: 8,
        logoUrl: '/logos/elite-air.png',
        price: 9200,
      },
    ]

    return {
      success: true,
      data: { matchedPros: pros },
      contextUpdates: { matchedPros: pros },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to match pros',
    }
  }
})

// =============================================================================
// Pricing Actions
// =============================================================================

/**
 * Fetch pricing options based on system type and tonnage
 */
registerAction('fetchPricingOptions', async (ctx) => {
  const { calculatedTonnage, collectedData } = ctx
  const systemType = collectedData.systemType as string

  if (!calculatedTonnage || !systemType) {
    return { success: false, error: 'System details required' }
  }

  try {
    // Mock pricing options based on tonnage
    // TODO: Replace with actual API call to fetch pricing from price_book_entries
    const basePrice = calculatedTonnage * 2000 // Base price per ton

    const options: PricingOption[] = [
      {
        id: 'opt-good',
        tier: 'good',
        brand: 'Goodman',
        productLine: 'GSX14',
        seer: 14,
        stages: 1,
        price: basePrice,
        monthlyPayment: Math.round(basePrice / 60),
        features: [
          '14 SEER efficiency',
          'Single-stage compressor',
          '10-year parts warranty',
          'Reliable performance',
        ],
      },
      {
        id: 'opt-better',
        tier: 'better',
        brand: 'Trane',
        productLine: 'XR15',
        seer: 16,
        stages: 1,
        price: Math.round(basePrice * 1.25),
        monthlyPayment: Math.round((basePrice * 1.25) / 60),
        features: [
          '16 SEER efficiency',
          'Single-stage compressor',
          '12-year parts warranty',
          'Quieter operation',
          'Better humidity control',
        ],
      },
      {
        id: 'opt-best',
        tier: 'best',
        brand: 'Carrier',
        productLine: 'Infinity',
        seer: 21,
        stages: 2,
        price: Math.round(basePrice * 1.75),
        monthlyPayment: Math.round((basePrice * 1.75) / 60),
        features: [
          '21 SEER efficiency',
          'Variable-speed compressor',
          'Lifetime compressor warranty',
          'Ultra-quiet operation',
          'Superior humidity control',
          'Wi-Fi enabled',
        ],
      },
    ]

    return {
      success: true,
      data: { pricingOptions: options },
      contextUpdates: { pricingOptions: options },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch pricing',
    }
  }
})

// =============================================================================
// Auth Actions
// =============================================================================

/**
 * Trigger Google OAuth flow
 */
registerAction('authGoogle', async () => {
  // This triggers client-side OAuth redirect
  // The actual implementation would be handled by the component
  return {
    success: true,
    data: { authMethod: 'google', requiresRedirect: true },
  }
})

/**
 * Trigger email auth flow
 */
registerAction('authEmail', async () => {
  return {
    success: true,
    data: { authMethod: 'email', requiresInput: true },
  }
})

// =============================================================================
// Scheduling Actions
// =============================================================================

/**
 * Fetch available time slots for a given date
 */
registerAction('fetchAvailableSlots', async (ctx, response) => {
  const date = response?.value as string
  const proId = ctx.collectedData.selectedProId as string

  if (!date || !proId) {
    return { success: false, error: 'Date and pro selection required' }
  }

  try {
    // This would call your scheduling API
    const slots: string[] = []

    return {
      success: true,
      data: { availableSlots: slots },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch available slots',
    }
  }
})

// =============================================================================
// Order Actions
// =============================================================================

/**
 * Create the order in the system
 */
registerAction('createOrder', async (ctx) => {
  try {
    // This would call your order creation API
    return {
      success: true,
      data: { orderId: null },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create order',
    }
  }
})

/**
 * Process payment
 */
registerAction('processPayment', async (ctx, response) => {
  const paymentMethod = response?.value

  try {
    // This would integrate with Stripe
    return {
      success: true,
      data: { paymentIntentId: null },
    }
  } catch (error) {
    return {
      success: false,
      error: 'Payment processing failed',
    }
  }
})

// =============================================================================
// Export for testing
// =============================================================================

export { actionRegistry }
