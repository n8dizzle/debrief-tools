import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { broadcastChange } from '@/lib/realtime';
import { hasPEPermission, formatLocalDate } from '@/lib/pe-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  let query = supabase
    .from('pe_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (type) query = query.eq('order_type', type);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = getServerSupabase();
  const now = formatLocalDate(new Date());

  const newOrder = {
    date: body.date || now,
    job: body.job || '',
    tech: body.tech || '',
    customer: body.customer || '',
    order_type: body.order_type || 'service',
    subtype: body.subtype || '',
    warranty: body.warranty || 'No',
    warranty_type: body.warranty_type || '',
    part: body.part || '',
    supplier: body.supplier || '',
    order_num: body.order_num || '',
    cost: body.cost || '',
    estimate_cost: body.estimate_cost || '',
    location: body.location || 'Place Order',
    owner: body.owner || 'Unassigned',
    eta: body.eta || null,
    scheduled_date: body.scheduled_date || null,
    note_wh: body.note_wh || '',
    note_cxr: body.note_cxr || '',
    status: 'open',
    is_equipment: body.is_equipment || false,
    cancel_source: '',
    cancel_reason: '',
    bo_notified: false,
    bo_notified_date: null,
    completed_by: '',
    completed_at: null,
    linked_jobs: body.linked_jobs || [],
    st_url: body.st_url || '',
    install_team: body.install_team || '',
    sub_rate: body.sub_rate || '',
    equip_cost: body.equip_cost || '',
    sched_date: body.sched_date || null,
    call_booked: false,
    job_cost: body.job_cost || '',
    equip_avail: '',
    bo_ordered: false,
    bo_status: '',
    parts_ordered: false,
    part_bo: false,
    bo_informed: false,
    parts_at_shop: false,
    two_techs: false,
    qc_scheduled: false,
    qc_date: null,
    tracking: '',
    tech_type: body.tech_type || '',
    needs_order: body.needs_order || false,
    multiple_estimates: body.multiple_estimates || false,
    estimates: body.estimates || null,
  };

  const { data, error } = await supabase
    .from('pe_orders')
    .insert(newOrder)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log audit
  await supabase.from('pe_audit_log').insert({
    type: 'create',
    job_id: data.job,
    customer: data.customer,
    action: 'Created order',
    detail: `Type: ${data.order_type}, Part: ${data.part}`,
    changed_by: session.user.email || session.user.name || 'Unknown',
  });

  await broadcastChange({ source: 'order-create', id: data.id });
  return NextResponse.json({ order: data }, { status: 201 });
}
