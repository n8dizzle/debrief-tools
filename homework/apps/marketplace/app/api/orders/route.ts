import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/orders
 * List the authenticated user's orders. Auth required.
 *
 * Query params:
 *   status - filter by order status
 *   page   - page number (default 1)
 *   per_page - results per page (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)));

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('orders')
      .select(
        `
        *,
        home:homes(id, address_line_1, city, state, zip_code),
        items:order_items(
          id, status, price_snapshot, contractor_payout, platform_fee,
          service:catalog_services(id, name, slug, image_url),
          contractor:contractors(id, business_name, logo_url)
        )
        `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/orders:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/orders
 * Create an order from the user's cart (checkout). Auth required.
 *
 * Body: { home_id, scheduled_date? }
 *
 * This converts all cart items for the specified home into an order.
 * Price snapshots are captured from the current contractor_prices at time of order.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.home_id) {
      return NextResponse.json({ error: 'home_id is required' }, { status: 400 });
    }

    // Verify home ownership
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('id', body.home_id)
      .eq('user_id', user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Home not found' }, { status: 404 });
    }

    // Get cart items for this home
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(
        `
        *,
        contractor_price:contractor_prices!inner(
          base_price, variable_pricing, addon_pricing
        )
        `
      )
      .eq('user_id', user.id)
      .eq('home_id', body.home_id)
      .eq('contractor_price.is_active', true);

    if (cartError) {
      console.error('Error fetching cart items:', cartError);
      return NextResponse.json({ error: 'Failed to fetch cart items' }, { status: 500 });
    }

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty for this home' }, { status: 400 });
    }

    // Calculate prices for each item
    const PLATFORM_FEE_RATE = 0.15; // 15% platform fee (adjustable)

    const orderItems = cartItems.map((item) => {
      const cp = item.contractor_price as unknown as {
        base_price: number;
        variable_pricing: Record<string, unknown> | null;
        addon_pricing: Record<string, unknown> | null;
      };

      let itemPrice = cp.base_price;

      // Add variable pricing if variables were selected
      if (item.selected_variables && cp.variable_pricing) {
        const variablePricing = cp.variable_pricing as Record<string, number>;
        const selectedVars = item.selected_variables as Record<string, string>;
        for (const [varName, varValue] of Object.entries(selectedVars)) {
          const key = `${varName}:${varValue}`;
          if (variablePricing[key]) {
            itemPrice += variablePricing[key];
          }
        }
      }

      // Add addon pricing if addons were selected
      if (item.selected_addons && cp.addon_pricing) {
        const addonPricing = cp.addon_pricing as Record<string, number>;
        const selectedAddons = item.selected_addons as string[];
        for (const addonId of selectedAddons) {
          if (addonPricing[addonId]) {
            itemPrice += addonPricing[addonId];
          }
        }
      }

      // Multiply by quantity
      itemPrice *= item.quantity || 1;

      const platformFee = Math.round(itemPrice * PLATFORM_FEE_RATE);
      const contractorPayout = itemPrice - platformFee;

      return {
        service_id: item.service_id,
        contractor_id: item.contractor_id,
        status: 'pending',
        price_snapshot: itemPrice,
        contractor_payout: contractorPayout,
        platform_fee: platformFee,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.price_snapshot, 0);
    const platformFeeTotal = orderItems.reduce((sum, item) => sum + item.platform_fee, 0);
    const tax = 0; // Tax calculation would be implemented separately
    const total = subtotal + tax;

    // Generate order number: HW-YYYYMMDD-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const orderNumber = `HW-${year}${month}${day}-${random}`;

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        home_id: body.home_id,
        status: 'pending',
        subtotal,
        platform_fee: platformFeeTotal,
        tax,
        total,
        scheduled_date: body.scheduled_date || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Create order items
    const orderItemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Attempt to clean up the order
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    // Clear the cart items for this home
    const { error: clearCartError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('home_id', body.home_id);

    if (clearCartError) {
      console.error('Error clearing cart (non-fatal):', clearCartError);
      // Non-fatal: order was created successfully
    }

    // Fetch the complete order with items
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(
        `
        *,
        home:homes(id, address_line_1, city, state, zip_code),
        items:order_items(
          id, status, price_snapshot, contractor_payout, platform_fee,
          service:catalog_services(id, name, slug, image_url),
          contractor:contractors(id, business_name, logo_url)
        )
        `
      )
      .eq('id', order.id)
      .single();

    if (fetchError) {
      // Return the basic order if we can't fetch the complete one
      return NextResponse.json({ order }, { status: 201 });
    }

    return NextResponse.json({ order: completeOrder }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/orders:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
