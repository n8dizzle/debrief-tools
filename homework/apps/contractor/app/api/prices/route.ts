import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

async function getContractorId(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

// GET /api/prices - Get all contractor prices
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { data: prices, error } = await supabase
      .from('contractor_prices')
      .select(`
        id,
        service_id,
        base_price,
        variable_pricing,
        addon_pricing,
        is_active,
        created_at,
        updated_at,
        catalog_services (
          id,
          name,
          description,
          pricing_type,
          estimated_duration_min,
          estimated_duration_max,
          category_id,
          catalog_categories (
            id,
            name,
            department_id,
            catalog_departments (id, name)
          )
        )
      `)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ prices });
  } catch (err) {
    console.error('GET /api/prices error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/prices - Set price for a service
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { service_id, base_price, variable_pricing, addon_pricing } = body;

    if (!service_id || base_price === undefined) {
      return NextResponse.json({ error: 'service_id and base_price are required' }, { status: 400 });
    }

    // Check if price already exists for this service
    const { data: existing } = await supabase
      .from('contractor_prices')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('service_id', service_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Price already exists for this service. Use PUT to update.' }, { status: 409 });
    }

    const { data: price, error } = await supabase
      .from('contractor_prices')
      .insert({
        contractor_id: contractorId,
        service_id,
        base_price: Math.round(base_price),
        variable_pricing: variable_pricing || null,
        addon_pricing: addon_pricing || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ price }, { status: 201 });
  } catch (err) {
    console.error('POST /api/prices error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
