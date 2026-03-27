import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/cart
 * Get the authenticated user's cart items with service and contractor details.
 * Auth required.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: items, error } = await supabase
      .from('cart_items')
      .select(
        `
        *,
        service:catalog_services(
          id, name, slug, short_description, image_url, pricing_type,
          category:catalog_categories(
            id, name, slug,
            department:catalog_departments(id, name, slug)
          )
        ),
        contractor:contractors(
          id, business_name, logo_url, rating_overall, review_count
        ),
        home:homes(
          id, address_line_1, city, state, zip_code
        )
        `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching cart:', error);
      return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
    }

    return NextResponse.json({ items: items || [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/cart:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/cart
 * Add an item to the cart. Auth required.
 *
 * Body: { home_id, service_id, contractor_id, selected_variables?, selected_addons?,
 *         preferred_date?, preferred_time_slot?, quantity?, notes? }
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
    if (!body.home_id) {
      return NextResponse.json({ error: 'home_id is required' }, { status: 400 });
    }
    if (!body.service_id) {
      return NextResponse.json({ error: 'service_id is required' }, { status: 400 });
    }
    if (!body.contractor_id) {
      return NextResponse.json({ error: 'contractor_id is required' }, { status: 400 });
    }

    // Verify home ownership
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('id', body.home_id)
      .eq('user_id', user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Home not found or not owned by user' }, { status: 404 });
    }

    // Verify the contractor has an active price for this service
    const { data: price, error: priceError } = await supabase
      .from('contractor_prices')
      .select('id')
      .eq('contractor_id', body.contractor_id)
      .eq('service_id', body.service_id)
      .eq('is_active', true)
      .single();

    if (priceError || !price) {
      return NextResponse.json(
        { error: 'Contractor does not offer this service or pricing is unavailable' },
        { status: 400 }
      );
    }

    const { data: item, error } = await supabase
      .from('cart_items')
      .insert({
        user_id: user.id,
        home_id: body.home_id,
        service_id: body.service_id,
        contractor_id: body.contractor_id,
        selected_variables: body.selected_variables || null,
        selected_addons: body.selected_addons || null,
        preferred_date: body.preferred_date || null,
        preferred_time_slot: body.preferred_time_slot || null,
        quantity: body.quantity || 1,
        notes: body.notes || null,
      })
      .select(
        `
        *,
        service:catalog_services(id, name, slug, short_description, image_url),
        contractor:contractors(id, business_name, logo_url),
        home:homes(id, address_line_1, city, state, zip_code)
        `
      )
      .single();

    if (error) {
      console.error('Error adding to cart:', error);
      return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/cart:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
