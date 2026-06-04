import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('po_orders')
    .select('*')
    .eq('job_id', params.jobId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = getServerSupabase();

  const allowedFields = [
    'owner', 'location', 'supplier', 'order_number', 'part_cost',
    'part_description', 'is_equipment', 'eta_date', 'scheduled_date',
    'notes_warehouse', 'notes_cxr', 'warranty', 'cancel_source',
    'bo_notified', 'bo_notified_date',
  ];

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data, error } = await supabase
    .from('po_orders')
    .update(updates)
    .eq('job_id', params.jobId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changedFields = Object.keys(body).filter(k => allowedFields.includes(k));
  await supabase.from('po_audit_log').insert({
    job_id: params.jobId,
    event_type: 'edit',
    action: `Updated: ${changedFields.join(', ')}`,
    detail: JSON.stringify(body),
    performed_by: session.user.name || session.user.email,
  });

  return NextResponse.json(data);
}
