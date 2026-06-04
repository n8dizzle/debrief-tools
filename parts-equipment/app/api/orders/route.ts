import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();
  const { data: orders, error } = await supabase
    .from('po_orders')
    .select('*')
    .order('date_added', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: syncLog } = await supabase
    .from('po_audit_log')
    .select('created_at')
    .eq('event_type', 'sync')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ orders: orders || [], lastSync: syncLog?.created_at || null });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  if (!body.job_id) return NextResponse.json({ error: 'job_id is required' }, { status: 400 });

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('po_orders')
    .insert({
      job_id: body.job_id,
      st_url: body.st_url || null,
      customer_name: body.customer_name || null,
      technician: body.technician || null,
      job_type: body.job_type || null,
      date_added: body.date_added || null,
      owner: body.owner || null,
      location: body.location || null,
      supplier: body.supplier || null,
      order_number: body.order_number || null,
      part_description: body.part_description || null,
      part_cost: body.part_cost || null,
      is_equipment: body.is_equipment || false,
      warranty: body.warranty || 'No',
      notes_warehouse: body.notes_warehouse || null,
      notes_cxr: body.notes_cxr || null,
      status: 'open',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('po_audit_log').insert({
    job_id: body.job_id,
    event_type: 'created',
    action: `Order created manually`,
    performed_by: session.user.name || session.user.email,
  });

  return NextResponse.json(data);
}
