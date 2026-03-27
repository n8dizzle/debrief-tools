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

// GET /api/orders/[id] - Get order detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Get the order item assigned to this contractor
    const { data: orderItem, error } = await supabase
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
        notes,
        catalog_services (
          id,
          name,
          description,
          scope_of_work,
          pricing_type,
          unit_label
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
          special_instructions,
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
            address_line2,
            city,
            state,
            zip_code,
            property_type,
            sqft,
            year_built
          )
        )
      `)
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order_item: orderItem });
  } catch (err) {
    console.error('GET /api/orders/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/orders/[id] - Update order item status (confirm, start, complete, decline)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: contractor } = await supabase
      .from('contractors')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, notes, decline_reason } = body;

    // Verify this order item belongs to the contractor and get order info
    const { data: existing, error: findError } = await supabase
      .from('order_items')
      .select(`
        id, status, order_id, service_id, contractor_payout,
        orders!inner(id, order_number, user_id, status),
        catalog_services(name)
      `)
      .eq('id', id)
      .eq('contractor_id', contractor.id)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    }

    const order = existing.orders as unknown as { id: string; order_number: string; user_id: string; status: string };
    const service = existing.catalog_services as unknown as { name: string } | null;
    const serviceName = service?.name || 'Service';

    const updateData: Record<string, unknown> = {};
    let notificationType = '';
    let notificationTitle = '';
    let notificationBody = '';

    switch (action) {
      case 'confirm':
        if (!['pending', 'assigned'].includes(existing.status)) {
          return NextResponse.json({ error: 'Order can only be confirmed from pending/assigned status' }, { status: 400 });
        }
        updateData.status = 'confirmed';
        notificationType = 'order_confirmed';
        notificationTitle = 'Order Confirmed';
        notificationBody = `${contractor.business_name} confirmed your ${serviceName} order (#${order.order_number}).`;
        break;

      case 'start':
        if (existing.status !== 'confirmed' && existing.status !== 'scheduled') {
          return NextResponse.json({ error: 'Order can only be started from confirmed/scheduled status' }, { status: 400 });
        }
        updateData.status = 'in_progress';
        notificationType = 'order_scheduled';
        notificationTitle = 'Work Started';
        notificationBody = `${contractor.business_name} has started work on your ${serviceName} order (#${order.order_number}).`;
        break;

      case 'complete':
        if (existing.status !== 'in_progress' && existing.status !== 'confirmed') {
          return NextResponse.json({ error: 'Order can only be completed from in_progress/confirmed status' }, { status: 400 });
        }
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        notificationType = 'order_completed';
        notificationTitle = 'Work Completed';
        notificationBody = `${contractor.business_name} has completed your ${serviceName} order (#${order.order_number}). Please review and leave feedback!`;
        break;

      case 'decline':
        if (!['pending', 'assigned'].includes(existing.status)) {
          return NextResponse.json({ error: 'Order can only be declined from pending/assigned status' }, { status: 400 });
        }
        updateData.status = 'cancelled';
        updateData.notes = decline_reason || 'Declined by contractor';
        notificationType = 'order_cancelled';
        notificationTitle = 'Contractor Unavailable';
        notificationBody = `${contractor.business_name} is unable to fulfill your ${serviceName} order (#${order.order_number}). We'll help you find another pro.`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action. Use: confirm, start, complete, decline' }, { status: 400 });
    }

    if (notes && action !== 'decline') {
      updateData.notes = notes;
    }

    const { data: updated, error: updateError } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notify the homeowner
    if (notificationType) {
      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: notificationType,
        channel: 'in_app',
        title: notificationTitle,
        body: notificationBody,
        action_url: `/orders/${order.id}`,
        reference_id: order.id,
        reference_type: 'order',
        sent_at: new Date().toISOString(),
      });
    }

    // Log activity
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: `order_item.${action}`,
      entity_type: 'order_item',
      entity_id: id,
      changes: { status: { old: existing.status, new: updateData.status } },
      metadata: { order_id: order.id, order_number: order.order_number },
    });

    // Update parent order status based on all items
    await syncOrderStatus(supabase, existing.order_id);

    return NextResponse.json({ order_item: updated });
  } catch (err) {
    console.error('PUT /api/orders/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Sync parent order status based on the statuses of all its order_items.
 * Rules:
 *  - All items completed → order 'completed'
 *  - Any item in_progress → order 'in_progress'
 *  - Any item confirmed/scheduled → order 'confirmed'
 *  - All items cancelled → order 'cancelled'
 *  - Otherwise → order stays as-is
 */
async function syncOrderStatus(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  orderId: string
) {
  const { data: items } = await supabase
    .from('order_items')
    .select('status')
    .eq('order_id', orderId);

  if (!items || items.length === 0) return;

  const statuses = items.map(i => i.status);

  let newOrderStatus: string | null = null;

  if (statuses.every(s => s === 'completed')) {
    newOrderStatus = 'completed';
  } else if (statuses.every(s => s === 'cancelled')) {
    newOrderStatus = 'cancelled';
  } else if (statuses.some(s => s === 'in_progress')) {
    newOrderStatus = 'in_progress';
  } else if (statuses.some(s => s === 'confirmed' || s === 'scheduled')) {
    newOrderStatus = 'confirmed';
  }

  if (newOrderStatus) {
    await supabase
      .from('orders')
      .update({ status: newOrderStatus })
      .eq('id', orderId);
  }
}
