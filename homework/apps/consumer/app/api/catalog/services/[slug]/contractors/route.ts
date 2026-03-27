import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/catalog/services/[slug]/contractors — Available pros for a service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const zip = searchParams.get('zip') || '75201'
    const tier = searchParams.get('tier') || 'better'

    const supabase = getSupabase()

    // Fetch service
    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id, name')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Try to find real contractors
    const { data: contractors } = await supabase.rpc('get_service_contractors', {
      p_service_id: service.id,
      p_zip_code: zip,
    })

    if (contractors && contractors.length > 0) {
      // Map real contractors to ProOption shape
      const pros = contractors.map((c: {
        contractor_id: string
        business_name: string
        logo_url: string | null
        rating_overall: number
        review_count: number
        jobs_completed: number
        base_price: number
        member_since: string
      }) => ({
        id: c.contractor_id,
        name: c.business_name,
        logo: c.logo_url,
        rating: Number(c.rating_overall) || 4.5,
        reviewCount: c.review_count || 0,
        established: new Date(c.member_since).getFullYear(),
        installCount: c.jobs_completed || 0,
        price: c.base_price / 100, // cents to dollars
        laborWarrantyYears: 5,
        includedExtras: [],
        nextAvailable: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        badges: ['Licensed & insured', 'Background checked'],
      }))

      return NextResponse.json({ pros })
    }

    // Fallback: Return "Homework Pro" placeholder with market rate pricing
    const { data: rates } = await supabase
      .from('catalog_service_market_rates')
      .select('low_price, median_price, high_price')
      .eq('service_id', service.id)
      .eq('market', 'dfw')
      .single()

    // Pick price based on tier
    const priceMap: Record<string, number> = {
      good: rates?.low_price || 0,
      better: rates?.median_price || 0,
      best: rates?.high_price || 0,
    }
    const priceCents = priceMap[tier] || priceMap.better

    const placeholderPro = {
      id: 'homework-platform',
      name: 'Homework Pro',
      logo: null,
      rating: 4.8,
      reviewCount: 0,
      established: 2025,
      installCount: 0,
      price: priceCents / 100, // cents to dollars
      laborWarrantyYears: 10,
      includedExtras: ['Licensed & insured pros', 'Quality guarantee'],
      nextAvailable: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      badges: ['Licensed & insured', 'Background checked', 'Quality guarantee'],
    }

    return NextResponse.json({ pros: [placeholderPro] })
  } catch (error) {
    console.error('[Catalog Contractors Error]', error)
    return NextResponse.json(
      { error: 'Failed to fetch contractors' },
      { status: 500 }
    )
  }
}
