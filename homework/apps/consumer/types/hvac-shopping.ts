/**
 * HVAC Shopping Experience Types
 * Types for system cards, product browsing, and pro comparison
 */

// =============================================================================
// HVAC SYSTEM TYPES (for displaying user's existing equipment)
// =============================================================================

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type WarrantyStatus = 'active' | 'expired' | 'unknown'
export type ComponentType = 'condenser' | 'coil' | 'furnace' | 'thermostat' | 'air_handler' | 'heat_strips'

export interface SystemComponent {
  id: string
  type: ComponentType
  name: string                    // "Outdoor Condenser", "Evaporator Coil"
  brand?: string
  model?: string
  age?: number                    // Years old
  warrantyStatus: WarrantyStatus
  warrantyExpires?: string        // ISO date
  photoUrl?: string
}

export interface HVACSystemCard {
  id: string
  name: string                    // "Downstairs", "Upstairs", "Main System"
  systemType: string              // "4-ton straight AC system with gas furnace"
  tonnage: number
  tags: string[]                  // ["HVAC", "attic", "Gas Heat"]
  healthGrade: HealthGrade
  healthMessage: string           // "Well past useful life - replacement recommended"
  estimatedAge: number            // Years old
  components: SystemComponent[]
}

// Health grade configuration
export const HEALTH_GRADE_CONFIG: Record<HealthGrade, { color: string; bgColor: string; label: string }> = {
  A: { color: 'text-green-600', bgColor: 'bg-green-50', label: 'Excellent' },
  B: { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Good' },
  C: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', label: 'Fair' },
  D: { color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'Poor' },
  F: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Replace' },
}

// Calculate health grade from age
export function calculateHealthGrade(ageYears: number): { grade: HealthGrade; message: string } {
  if (ageYears <= 5) {
    return { grade: 'A', message: 'System is relatively new and should have years of life remaining' }
  } else if (ageYears <= 10) {
    return { grade: 'B', message: 'System is in good condition with regular maintenance' }
  } else if (ageYears <= 15) {
    return { grade: 'C', message: 'System is aging - consider planning for replacement' }


    
  } else if (ageYears <= 18) {
    return { grade: 'D', message: 'System is past typical lifespan - replacement recommended soon' }
  } else {
    return { grade: 'F', message: 'Well past useful life - replacement recommended' }
  }
}

// =============================================================================
// HOMEFIT CONTEXT (persistent during shopping)
// =============================================================================

export type SystemScope = 'whole_home' | 'upstairs' | 'downstairs' | 'single_zone'
export type TierPreference = 'economy' | 'mid-range' | 'premium'

export interface HomeFitContext {
  scope: SystemScope
  tonnage: number
  systemType: string              // "Straight AC + Gas Furnace"
  tierPreference?: TierPreference
  heatSource: 'gas' | 'electric' | 'heat_pump'
}

// =============================================================================
// PRODUCT TYPES (for shopping/browsing)
// =============================================================================

export type ProductTier = 'economy' | 'mid-range' | 'premium'
export type ProAvailability = 'same_day' | 'next_day' | 'this_week' | 'next_week'

export interface ProPricing {
  id: string
  name: string
  tagline?: string                // "Excellence in Every Installation"
  logoUrl?: string
  rating: number                  // 4.6, 4.8, 4.9
  reviewCount: number
  price: number
  availability: ProAvailability
  availabilityDate?: string       // "Today", "Tomorrow"
  laborWarrantyYears: number
  includedExtras: string[]        // ["Free Smart Thermostat", "Free 1st Year Maintenance"]
  badges: string[]                // ["0% APR", "Same Day Available"]
  yearsInBusiness?: number
  isVeteranOwned?: boolean
  isFamilyOwned?: boolean
}

export interface ProductGroup {
  id: string
  tier: ProductTier
  brand: string                   // "American Standard"
  productLine: string             // "Gold", "Silver", "Platinum"
  seer: number                    // 14, 17, 22
  savingsPercent?: number         // 41 means "Save ~41%"
  priceRange: { min: number; max: number }
  specs: string                   // "4 Ton - Two Stage"
  stages: 'single' | 'two' | 'variable'
  prosCount: number
  pros: ProPricing[]
  isRecommended?: boolean
}

// Tier display configuration
export const TIER_CONFIG: Record<ProductTier, { label: string; color: string; bgColor: string; borderColor: string }> = {
  economy: { label: 'Economy', color: 'text-slate-700', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' },
  'mid-range': { label: 'Mid-Range', color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/20' },
  premium: { label: 'Premium', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
}

// =============================================================================
// PRODUCT DETAIL TYPES (for Sheet view)
// =============================================================================

export interface TonnageOption {
  tonnage: number
  price: number
  isFit: boolean                  // Matches home's calculated tonnage
  sqftRange?: string              // "2,100-2,400 sq ft"
}

export interface PaymentOption {
  type: 'cash' | 'financing'
  price: number
  monthlyPayment?: number
  apr?: number
  termMonths?: number
  provider?: string               // "Wells Fargo"
  totalWithInterest?: number
}

export interface WarrantyInfo {
  partsYears: number
  laborYears: number
  compressorYears: number
  registrationRequired?: boolean
}

export interface EnergySavings {
  annualDollars: number
  tenYearDollars: number
  percentMoreEfficient: number
}

export interface RecommendedUpgrade {
  id: string
  name: string
  description: string
  priceRange: { min: number; max: number }
}

export interface ProductDetail extends ProductGroup {
  description?: string
  features: string[]
  availableSizes: TonnageOption[]
  paymentOptions: PaymentOption[]
  warranties: WarrantyInfo
  scopeOfWork: string[]
  energySavings?: EnergySavings
  recommendedUpgrades: RecommendedUpgrade[]
  imageUrl?: string
}

// =============================================================================
// MESSAGE DATA TYPES (for conversation integration)
// =============================================================================

export interface SystemCardMessageData {
  kind: 'system-card'
  system: HVACSystemCard
}

export interface ProductBrowseMessageData {
  kind: 'product-browse'
  products: ProductGroup[]
  homeFit: HomeFitContext
  selectedId?: string
}

export interface ProComparisonMessageData {
  kind: 'pro-comparison'
  pros: ProPricing[]
  product: ProductGroup
  selectedId?: string
}
