import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/services/[slug]/contractors
 * Contractors offering this service in a given zip code.
 * Public - no auth required.
 *
 * Query params:
 *   zip_code - required, 5-digit zip code to match contractor service areas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const zipCode = searchParams.get('zip_code');

    if (!zipCode) {
      return NextResponse.json({ error: 'zip_code query parameter is required' }, { status: 400 });
    }

    if (!/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'zip_code must be a valid 5-digit zip code' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // First, get the service by slug to get its ID
    const { data: service, error: serviceError } = await supabase
      .from('catalog_services')
      .select('id, name, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (serviceError) {
      if (serviceError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      console.error('Error fetching service:', serviceError);
      return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
    }

    // Get contractors who:
    // 1. Have an active price for this service
    // 2. Service the given zip code
    // 3. Are verified and active
    // 4. Have Stripe charges enabled
    const { data: contractorPrices, error: pricesError } = await supabase
      .from('contractor_prices')
      .select(
        `
        id,
        base_price,
        variable_pricing,
        addon_pricing,
        contractor:contractors!inner(
          id, business_name, logo_url, verification_status, rating_overall, review_count, jobs_completed, member_since,
          service_areas:contractor_service_areas(zip_code)
        )
        `
      )
      .eq('service_id', service.id)
      .eq('is_active', true)
      .eq('contractor.is_active', true)
      .eq('contractor.verification_status', 'verified')
      .eq('contractor.stripe_charges_enabled', true)
      .eq('contractor.service_areas.zip_code', zipCode)
      .eq('contractor.service_areas.is_active', true);

    if (pricesError) {
      console.error('Error fetching contractor prices:', pricesError);
      return NextResponse.json({ error: 'Failed to fetch contractors' }, { status: 500 });
    }

    // Shape the response: flatten contractor info with their pricing
    const contractors = (contractorPrices || []).map((cp) => {
      const c = cp.contractor as unknown as Record<string, unknown>;
      return {
        contractor_id: c.id,
        business_name: c.business_name,
        logo_url: c.logo_url,
        rating_overall: c.rating_overall,
        review_count: c.review_count,
        jobs_completed: c.jobs_completed,
        member_since: c.member_since,
        pricing: {
          base_price: cp.base_price,
          variable_pricing: cp.variable_pricing,
          addon_pricing: cp.addon_pricing,
        },
      };
    });

    // Sort by rating descending, then by review count descending
    contractors.sort((a, b) => {
      const ratingDiff = (Number(b.rating_overall) || 0) - (Number(a.rating_overall) || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (Number(b.review_count) || 0) - (Number(a.review_count) || 0);
    });

    return NextResponse.json({
      service: { id: service.id, name: service.name, slug: service.slug },
      zip_code: zipCode,
      contractors,
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/services/[slug]/contractors:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
