import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/orders/[id]
 * Get order detail with items. Auth required - user can only access own orders.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        home:homes(id, address_line_1, address_line_2, city, state, zip_code),
        items:order_items(
          id, status, price_snapshot, contractor_payout, platform_fee,
          service:catalog_services(
            id, name, slug, short_description, image_url,
            category:catalog_categories(id, name, slug)
          ),
          contractor:contractors(
            id, business_name, logo_url, rating_overall, review_count
          )
        )
        `
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      console.error('Error fetching order:', error);
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('Unexpected error in GET /api/orders/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
