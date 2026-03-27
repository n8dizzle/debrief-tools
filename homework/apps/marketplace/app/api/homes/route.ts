import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/homes
 * List the authenticated user's homes.
 * Auth required.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: homes, error } = await supabase
      .from('homes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching homes:', error);
      return NextResponse.json({ error: 'Failed to fetch homes' }, { status: 500 });
    }

    return NextResponse.json({ homes: homes || [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/homes:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/homes
 * Create a new home profile for the authenticated user.
 * Auth required.
 *
 * Body: { address_line_1, address_line_2?, city, state, zip_code,
 *         lat?, lng?, sqft?, year_built?, stories?, lot_sqft?,
 *         property_type?, foundation_type?, exterior_type?, bedrooms?, bathrooms? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['address_line_1', 'city', 'state', 'zip_code'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (!/^\d{5}$/.test(body.zip_code)) {
      return NextResponse.json({ error: 'zip_code must be a valid 5-digit zip code' }, { status: 400 });
    }

    const { data: home, error } = await supabase
      .from('homes')
      .insert({
        user_id: user.id,
        address_line_1: body.address_line_1,
        address_line_2: body.address_line_2 || null,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
        lat: body.lat || null,
        lng: body.lng || null,
        sqft: body.sqft || null,
        year_built: body.year_built || null,
        stories: body.stories || null,
        lot_sqft: body.lot_sqft || null,
        property_type: body.property_type || null,
        foundation_type: body.foundation_type || null,
        exterior_type: body.exterior_type || null,
        bedrooms: body.bedrooms || null,
        bathrooms: body.bathrooms || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating home:', error);
      return NextResponse.json({ error: 'Failed to create home' }, { status: 500 });
    }

    return NextResponse.json({ home }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/homes:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
