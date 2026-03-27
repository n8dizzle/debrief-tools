import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Tier metadata - maps market rate tiers to product attributes
const TIER_META: Record<string, {
  productLine: string
  brand: string
  seer: number
  stages: 'single' | 'two' | 'variable'
  features: string[]
  bestFor?: string[]
}> = {
  good: {
    productLine: 'Comfort Series',
    brand: 'Carrier',
    seer: 14,
    stages: 'single',
    features: [
      'Reliable, proven system',
      '10-year parts warranty',
      'Standard efficiency',
    ],
  },
  better: {
    productLine: 'Performance Series',
    brand: 'Carrier',
    seer: 17,
    stages: 'two',
    features: [
      'Quieter operation',
      'Better humidity control',
      '~15% energy savings vs. Good',
      'Two-stage comfort',
    ],
  },
  best: {
    productLine: 'Infinity Series',
    brand: 'Carrier',
    seer: 21,
    stages: 'variable',
    features: [
      'Whisper quiet',
      'Precise temp control',
      '~40% energy savings vs. Good',
      'Best for allergies',
      'Variable-speed technology',
    ],
    bestFor: ['allergies', 'efficiency'],
  },
}

// GET /api/catalog/services/[slug]/pricing — Pricing tiers from market rates or contractors
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const zip = searchParams.get('zip') || '75201'
    const tonnage = parseFloat(searchParams.get('tonnage') || '3')

    const supabase = getSupabase()

    // Fetch service ID
    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id, name')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Try to find real contractors first
    const { data: contractors } = await supabase.rpc('get_service_contractors', {
      p_service_id: service.id,
      p_zip_code: zip,
    })

    if (contractors && contractors.length > 0) {
      // TODO: Build tiers from contractor variable pricing when contractors are onboarded
      // For now, fall through to market rates
    }

    // Fallback: Build tiers from market rates
    const { data: rates, error: ratesError } = await supabase
      .from('catalog_service_market_rates')
      .select('low_price, median_price, high_price')
      .eq('service_id', service.id)
      .eq('market', 'dfw')
      .single()

    if (ratesError || !rates) {
      return NextResponse.json({ error: 'No pricing data available' }, { status: 404 })
    }

    // Tonnage multiplier: base rates are for ~3 ton, scale linearly
    const tonnageMultiplier = tonnage / 3

    // Build 3 tiers from market rates (cents -> dollars)
    const tiers = [
      { key: 'good', price: rates.low_price },
      { key: 'better', price: rates.median_price },
      { key: 'best', price: rates.high_price },
    ]

    const options = tiers.map(({ key, price }) => {
      const meta = TIER_META[key]
      const scaledPrice = Math.round(price * tonnageMultiplier)
      // Create a ±10% range around the scaled price
      const min = Math.round(scaledPrice * 0.9) / 100
      const max = Math.round(scaledPrice * 1.1) / 100

      return {
        id: `${key}-${tonnage}ton`,
        tier: key as 'good' | 'better' | 'best',
        productLine: meta.productLine,
        brand: meta.brand,
        seer: meta.seer,
        stages: meta.stages,
        priceRange: { min, max },
        features: meta.features,
        recommended: key === 'better',
        bestFor: meta.bestFor,
      }
    })

    return NextResponse.json({
      options,
      systemSize: { tonnage, source: 'calculated' },
    })
  } catch (error) {
    console.error('[Catalog Pricing Error]', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    )
  }
}
