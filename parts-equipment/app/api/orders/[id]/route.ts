import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_orders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ order: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = getServerSupabase();

  // Fetch existing order for audit diff
  const { data: existing } = await supabase
    .from('pe_orders')
    .select('*')
    .eq('id', params.id)
    .single();

  const updates: Record<string, any> = { ...body };
  if (body.status === 'completed' && !existing?.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('pe_orders')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build audit detail from changed fields
  const changedFields = Object.keys(body).filter(
    k => JSON.stringify(body[k]) !== JSON.stringify(existing?.[k])
  );

  if (changedFields.length > 0) {
    const detail = changedFields.slice(0, 5).map(f => {
      const oldVal = existing?.[f] ?? '(empty)';
      const newVal = body[f] ?? '(empty)';
      return `${f}: "${oldVal}" → "${newVal}"`;
    }).join('; ');

    await supabase.from('pe_audit_log').insert({
      type: body.status === 'completed' ? 'complete' : body.status === 'cancelled' ? 'cancel' : 'edit',
      job_id: data.job,
      customer: data.customer,
      action: body.status === 'completed' ? 'Closed out order' : body.status === 'cancelled' ? 'Cancelled order' : 'Edited order',
      detail,
      changed_by: session.user.email || session.user.name || 'Unknown',
    });
  }

  return NextResponse.json({ order: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from('pe_orders')
    .select('job, customer')
    .eq('id', params.id)
    .single();

  const { error } = await supabase
    .from('pe_orders')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existing) {
    await supabase.from('pe_audit_log').insert({
      type: 'delete',
      job_id: existing.job,
      customer: existing.customer,
      action: 'Deleted order',
      detail: `Job #${existing.job}`,
      changed_by: session.user.email || session.user.name || 'Unknown',
    });
  }

  return NextResponse.json({ ok: true });
}
