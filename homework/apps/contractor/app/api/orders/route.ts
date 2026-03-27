import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

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

// GET /api/orders - Get orders assigned to this contractor
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get order_item IDs assigned to this contractor, then join to orders
    let query = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        service_id,
        status,
        price_snapshot,
        contractor_payout,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        completed_at,
        catalog_services (
          id,
          name,
          description,
          pricing_type
        ),
        orders (
          id,
          order_number,
          homeowner_id,
          home_id,
          status,
          subtotal,
          platform_fee,
          tax,
          total,
          scheduled_date,
          created_at,
          user_profiles (
            id,
            full_name,
            phone,
            email
          ),
          homes (
            id,
            address_line1,
            city,
            state,
            zip_code
          )
        )
      `)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      // Map tab filters to order_item statuses
      const statusMap: Record<string, string[]> = {
        pending: ['pending', 'assigned'],
        active: ['confirmed', 'scheduled', 'in_progress'],
        completed: ['completed'],
        cancelled: ['cancelled'],
      };
      const statuses = statusMap[status] || [status];
      query = query.in('status', statuses);
    }

    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('scheduled_date', dateTo);
    }

    const { data: orderItems, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order_items: orderItems, total: count });
  } catch (err) {
    console.error('GET /api/orders error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
