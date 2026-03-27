import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/catalog/services/[slug] — Service details + addons + market rates
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Fetch service
    const supabase = getSupabase()

    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id, name, slug, short_description, description, scope_includes, scope_excludes, pricing_type, estimated_duration_min, estimated_duration_max')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Fetch variables, addons, and market rates in parallel
    const [variablesRes, addonsRes, ratesRes] = await Promise.all([
      supabase
        .from('catalog_service_variables')
        .select('id, name, label, description, variable_type, options, is_required, affects_pricing, display_order')
        .eq('service_id', service.id)
        .order('display_order'),
      supabase
        .from('catalog_service_addons')
        .select('id, name, description, suggested_price, display_order')
        .eq('service_id', service.id)
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('catalog_service_market_rates')
        .select('low_price, median_price, high_price, labor_pct, materials_pct')
        .eq('service_id', service.id)
        .eq('market', 'dfw')
        .single(),
    ])

    // Convert addon prices from cents to dollars
    const addons = (addonsRes.data || []).map((addon) => ({
      id: addon.id,
      name: addon.name,
      description: addon.description,
      price: addon.suggested_price ? addon.suggested_price / 100 : 0,
      display_order: addon.display_order,
    }))

    // Convert market rates from cents to dollars
    const marketRates = ratesRes.data
      ? {
          low: ratesRes.data.low_price / 100,
          median: ratesRes.data.median_price / 100,
          high: ratesRes.data.high_price / 100,
          laborPct: ratesRes.data.labor_pct,
          materialsPct: ratesRes.data.materials_pct,
        }
      : null

    return NextResponse.json({
      service,
      variables: variablesRes.data || [],
      addons,
      marketRates,
    })
  } catch (error) {
    console.error('[Catalog Service Error]', error)
    return NextResponse.json(
      { error: 'Failed to fetch service details' },
      { status: 500 }
    )
  }
}
