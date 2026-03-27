/**
 * Demo HVAC Product Data
 * Mock data for testing the ProductBrowseCard and ProductDetailSheet components
 */

import type { ProductGroup, ProPricing, ProductDetail } from '@/types/hvac-shopping'

// =============================================================================
// Demo Pros
// =============================================================================

const DEMO_PRO_ACME: ProPricing = {
  id: 'pro-acme',
  name: 'Acme Air',
  tagline: 'Excellence in Every Installation',
  rating: 4.9,
  reviewCount: 247,
  price: 8750,
  availability: 'same_day',
  availabilityDate: 'Today',
  laborWarrantyYears: 2,
  includedExtras: ['Free Smart Thermostat', 'Free 1st Year Maintenance'],
  badges: ['0% APR Available', 'Same Day'],
  yearsInBusiness: 15,
  isFamilyOwned: true,
}

const DEMO_PRO_COMFORT: ProPricing = {
  id: 'pro-comfort',
  name: 'Comfort Masters',
  tagline: 'Your Comfort is Our Priority',
  rating: 4.8,
  reviewCount: 189,
  price: 8495,
  availability: 'next_day',
  availabilityDate: 'Tomorrow',
  laborWarrantyYears: 1,
  includedExtras: ['Free Filter Pack (1 Year)', 'System Registration'],
  badges: ['Lowest Price'],
  yearsInBusiness: 8,
}

const DEMO_PRO_PREMIER: ProPricing = {
  id: 'pro-premier',
  name: 'Premier HVAC',
  tagline: 'Premium Service, Fair Prices',
  rating: 4.7,
  reviewCount: 312,
  price: 8990,
  availability: 'this_week',
  availabilityDate: 'Thursday',
  laborWarrantyYears: 3,
  includedExtras: ['Extended Parts Warranty', 'Priority Service', 'Annual Tune-Up'],
  badges: ['Best Warranty', '0% APR Available'],
  yearsInBusiness: 22,
  isVeteranOwned: true,
}

const DEMO_PRO_QUICKCOOL: ProPricing = {
  id: 'pro-quickcool',
  name: 'QuickCool DFW',
  rating: 4.6,
  reviewCount: 98,
  price: 7995,
  availability: 'same_day',
  availabilityDate: 'Today',
  laborWarrantyYears: 1,
  includedExtras: ['Basic Thermostat'],
  badges: ['Same Day', 'Best Value'],
  yearsInBusiness: 5,
}

// Premium tier pros (higher prices, better service)
const DEMO_PRO_ELITE: ProPricing = {
  id: 'pro-elite',
  name: 'Elite Climate Solutions',
  tagline: 'The Best or Nothing',
  rating: 5.0,
  reviewCount: 156,
  price: 14500,
  availability: 'next_day',
  availabilityDate: 'Tomorrow',
  laborWarrantyYears: 5,
  includedExtras: ['Ecobee Premium Thermostat', '5 Years Maintenance', 'Priority 24/7 Support'],
  badges: ['Top Rated', '0% APR 60 Months'],
  yearsInBusiness: 18,
}

const DEMO_PRO_GREENLEAF: ProPricing = {
  id: 'pro-greenleaf',
  name: 'GreenLeaf HVAC',
  tagline: 'Sustainable Comfort',
  rating: 4.9,
  reviewCount: 87,
  price: 15200,
  availability: 'this_week',
  availabilityDate: 'Friday',
  laborWarrantyYears: 3,
  includedExtras: ['Nest Learning Thermostat', '3 Years Maintenance', 'Energy Audit'],
  badges: ['Eco Certified', 'Rebate Assistance'],
  yearsInBusiness: 7,
}

// =============================================================================
// Demo Products
// =============================================================================

export const DEMO_PRODUCT_ECONOMY: ProductGroup = {
  id: 'product-economy',
  tier: 'economy',
  brand: 'American Standard',
  productLine: 'Silver',
  seer: 14,
  priceRange: { min: 6995, max: 8495 },
  specs: '4 Ton - Single Stage',
  stages: 'single',
  prosCount: 4,
  pros: [DEMO_PRO_QUICKCOOL, DEMO_PRO_COMFORT, DEMO_PRO_ACME, DEMO_PRO_PREMIER],
}

export const DEMO_PRODUCT_MIDRANGE: ProductGroup = {
  id: 'product-midrange',
  tier: 'mid-range',
  brand: 'American Standard',
  productLine: 'Gold',
  seer: 17,
  savingsPercent: 28,
  priceRange: { min: 8495, max: 10500 },
  specs: '4 Ton - Two Stage',
  stages: 'two',
  prosCount: 3,
  pros: [DEMO_PRO_ACME, DEMO_PRO_COMFORT, DEMO_PRO_PREMIER],
  isRecommended: true,
}

export const DEMO_PRODUCT_PREMIUM: ProductGroup = {
  id: 'product-premium',
  tier: 'premium',
  brand: 'American Standard',
  productLine: 'Platinum',
  seer: 22,
  savingsPercent: 41,
  priceRange: { min: 12500, max: 15900 },
  specs: '4 Ton - Variable Speed',
  stages: 'variable',
  prosCount: 2,
  pros: [DEMO_PRO_ELITE, DEMO_PRO_GREENLEAF],
}

// All demo products
export const DEMO_PRODUCTS: ProductGroup[] = [
  DEMO_PRODUCT_ECONOMY,
  DEMO_PRODUCT_MIDRANGE,
  DEMO_PRODUCT_PREMIUM,
]

// =============================================================================
// Carrier Products (alternative brand)
// =============================================================================

export const DEMO_CARRIER_ECONOMY: ProductGroup = {
  id: 'carrier-economy',
  tier: 'economy',
  brand: 'Carrier',
  productLine: 'Comfort',
  seer: 14,
  priceRange: { min: 7295, max: 8795 },
  specs: '4 Ton - Single Stage',
  stages: 'single',
  prosCount: 3,
  pros: [DEMO_PRO_COMFORT, DEMO_PRO_PREMIER, DEMO_PRO_QUICKCOOL],
}

export const DEMO_CARRIER_MIDRANGE: ProductGroup = {
  id: 'carrier-midrange',
  tier: 'mid-range',
  brand: 'Carrier',
  productLine: 'Performance',
  seer: 17,
  savingsPercent: 26,
  priceRange: { min: 8995, max: 11200 },
  specs: '4 Ton - Two Stage',
  stages: 'two',
  prosCount: 2,
  pros: [DEMO_PRO_ACME, DEMO_PRO_PREMIER],
}

export const DEMO_CARRIER_PREMIUM: ProductGroup = {
  id: 'carrier-premium',
  tier: 'premium',
  brand: 'Carrier',
  productLine: 'Infinity',
  seer: 24,
  savingsPercent: 45,
  priceRange: { min: 14500, max: 18500 },
  specs: '4 Ton - Variable Speed',
  stages: 'variable',
  prosCount: 2,
  pros: [DEMO_PRO_ELITE, DEMO_PRO_GREENLEAF],
  isRecommended: true,
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getDemoProducts(): ProductGroup[] {
  return DEMO_PRODUCTS
}

export function getDemoProduct(id: string): ProductGroup | undefined {
  return [...DEMO_PRODUCTS, DEMO_CARRIER_ECONOMY, DEMO_CARRIER_MIDRANGE, DEMO_CARRIER_PREMIUM]
    .find(p => p.id === id)
}

export function getRecommendedProduct(): ProductGroup {
  return DEMO_PRODUCTS.find(p => p.isRecommended) || DEMO_PRODUCT_MIDRANGE
}

export function getProductsByTier(tier: 'economy' | 'mid-range' | 'premium'): ProductGroup[] {
  return DEMO_PRODUCTS.filter(p => p.tier === tier)
}

export function getCheapestPro(product: ProductGroup): ProPricing | undefined {
  return [...product.pros].sort((a, b) => a.price - b.price)[0]
}

export function getBestRatedPro(product: ProductGroup): ProPricing | undefined {
  return [...product.pros].sort((a, b) => b.rating - a.rating)[0]
}

// =============================================================================
// Full Product Details (for ProductDetailSheet)
// =============================================================================

export const DEMO_PRODUCT_DETAIL_MIDRANGE: ProductDetail = {
  ...DEMO_PRODUCT_MIDRANGE,
  description: 'The American Standard Gold series delivers excellent efficiency and comfort with two-stage operation that adjusts to your needs. Quieter operation and better humidity control than single-stage systems.',
  features: [
    'Two-stage compressor for optimal comfort',
    'Variable-speed indoor blower motor',
    'Duration™ compressor with sound blanket',
    'WeatherGuard™ top with built-in legs',
    'Spine Fin™ outdoor coil',
    'Factory-installed filter drier',
    'Copper tube/aluminum fin coil',
  ],
  availableSizes: [
    { tonnage: 2.5, price: 7495, isFit: false, sqftRange: '1,200-1,600 sq ft' },
    { tonnage: 3, price: 7995, isFit: false, sqftRange: '1,600-2,000 sq ft' },
    { tonnage: 3.5, price: 8495, isFit: false, sqftRange: '2,000-2,400 sq ft' },
    { tonnage: 4, price: 8995, isFit: true, sqftRange: '2,400-2,800 sq ft' },
    { tonnage: 5, price: 9995, isFit: false, sqftRange: '2,800-3,500 sq ft' },
  ],
  paymentOptions: [
    { type: 'cash', price: 8995 },
    {
      type: 'financing',
      price: 8995,
      monthlyPayment: 149,
      apr: 0,
      termMonths: 60,
      provider: 'Wells Fargo',
      totalWithInterest: 8940,
    },
  ],
  warranties: {
    partsYears: 10,
    laborYears: 2, // Base - pro adds more
    compressorYears: 12,
    registrationRequired: true,
  },
  scopeOfWork: [
    'Remove and dispose of existing outdoor unit',
    'Remove and dispose of existing indoor coil',
    'Install new outdoor condensing unit',
    'Install new indoor evaporator coil',
    'Install new refrigerant line set (if needed)',
    'Evacuate and charge system with R-410A refrigerant',
    'Install new condensate drain line',
    'Test and verify proper operation',
    'Program thermostat for optimal performance',
    'Provide homeowner orientation and documentation',
    'Clean up work area',
    'Register warranties online',
  ],
  energySavings: {
    annualDollars: 340,
    tenYearDollars: 3400,
    percentMoreEfficient: 28,
  },
  recommendedUpgrades: [
    {
      id: 'upgrade-smart-thermostat',
      name: 'Smart Thermostat Upgrade',
      description: 'Ecobee Premium with room sensors and voice control',
      priceRange: { min: 299, max: 399 },
    },
    {
      id: 'upgrade-uv-light',
      name: 'UV Air Purification',
      description: 'Kills mold, bacteria, and viruses in your ductwork',
      priceRange: { min: 495, max: 695 },
    },
    {
      id: 'upgrade-surge-protector',
      name: 'Surge Protector',
      description: 'Protects your investment from power surges',
      priceRange: { min: 149, max: 199 },
    },
    {
      id: 'upgrade-maintenance',
      name: '3-Year Maintenance Plan',
      description: 'Annual tune-ups and priority service',
      priceRange: { min: 399, max: 499 },
    },
  ],
}

export const DEMO_PRODUCT_DETAIL_PREMIUM: ProductDetail = {
  ...DEMO_PRODUCT_PREMIUM,
  description: 'The American Standard Platinum series represents the pinnacle of home comfort. Variable-speed technology provides precise temperature and humidity control with whisper-quiet operation.',
  features: [
    'Variable-speed compressor for precise comfort',
    'AccuComfort™ technology maintains temperature within 0.5°F',
    'Ultra-quiet operation (as low as 54dB)',
    'Humidity control without overcooling',
    'AccuLink™ Communicating System compatible',
    'Premium sound insulation package',
    'WeatherGuard™ III top design',
    'Spine Fin™ coil with enhanced corrosion protection',
  ],
  availableSizes: [
    { tonnage: 2.5, price: 11500, isFit: false, sqftRange: '1,200-1,600 sq ft' },
    { tonnage: 3, price: 12500, isFit: false, sqftRange: '1,600-2,000 sq ft' },
    { tonnage: 3.5, price: 13500, isFit: false, sqftRange: '2,000-2,400 sq ft' },
    { tonnage: 4, price: 14500, isFit: true, sqftRange: '2,400-2,800 sq ft' },
    { tonnage: 5, price: 15900, isFit: false, sqftRange: '2,800-3,500 sq ft' },
  ],
  paymentOptions: [
    { type: 'cash', price: 14500 },
    {
      type: 'financing',
      price: 14500,
      monthlyPayment: 241,
      apr: 0,
      termMonths: 60,
      provider: 'Wells Fargo',
      totalWithInterest: 14460,
    },
  ],
  warranties: {
    partsYears: 12,
    laborYears: 2,
    compressorYears: 12,
    registrationRequired: true,
  },
  scopeOfWork: [
    'Remove and dispose of existing outdoor unit',
    'Remove and dispose of existing indoor coil',
    'Remove and dispose of existing furnace (if applicable)',
    'Install new variable-speed outdoor unit',
    'Install new variable-speed indoor air handler',
    'Install new refrigerant line set with premium insulation',
    'Evacuate and charge system with R-410A refrigerant',
    'Install new condensate drain with safety switch',
    'Install AccuLink™ communicating thermostat',
    'Configure system for optimal performance',
    'Test and verify proper operation',
    'Provide comprehensive homeowner orientation',
    'Clean up work area',
    'Register all warranties online',
  ],
  energySavings: {
    annualDollars: 520,
    tenYearDollars: 5200,
    percentMoreEfficient: 41,
  },
  recommendedUpgrades: [
    {
      id: 'upgrade-whole-home-purifier',
      name: 'Whole-Home Air Purifier',
      description: 'AccuClean™ removes 99.98% of airborne particles',
      priceRange: { min: 1295, max: 1495 },
    },
    {
      id: 'upgrade-zoning',
      name: 'Zoning System',
      description: 'Control temperatures independently in different areas',
      priceRange: { min: 1995, max: 2995 },
    },
    {
      id: 'upgrade-maintenance-premium',
      name: '5-Year Premium Maintenance',
      description: 'Bi-annual tune-ups, priority service, parts discount',
      priceRange: { min: 799, max: 999 },
    },
  ],
}

export function getProductDetail(id: string): ProductDetail | undefined {
  if (id === 'product-midrange') return DEMO_PRODUCT_DETAIL_MIDRANGE
  if (id === 'product-premium') return DEMO_PRODUCT_DETAIL_PREMIUM
  return undefined
}
