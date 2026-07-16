import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { broadcastChange } from '@/lib/realtime';
import { hasPEPermission } from '@/lib/pe-utils';
import { maybePostOrderNumberNote } from '@/lib/pe-st-note';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ order: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const raw = await request.json();
  // `_commit_order_num` is a control flag (order # finished + blurred), not a
  // DB column — strip it before it touches the table or the audit diff.
  const { _commit_order_num, ...body } = raw;
  const orderNumCommitted = _commit_order_num === true;
  const supabase = getServerSupabase();

  // Fetch existing order for audit diff
  const { data: existing } = await supabase
    .from('pe_orders')
    .select('*')
    .eq('id', id)
    .single();

  const updates: Record<string, unknown> = { ...body };
  if (body.status === 'completed' && !existing?.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('pe_orders')
    .update(updates)
    .eq('id', id)
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

  // Write-back to ServiceTitan when the order number is first entered.
  // Self-gating + non-throwing; only a committed (finished + blurred) order #
  // posts a note, so the whole value is sent — never a mid-typing partial.
  const actor = session.user.email || session.user.name || 'Unknown';
  await maybePostOrderNumberNote({ updated: data, actor, committed: orderNumCommitted });

  await broadcastChange({ source: 'order-edit', id });
  return NextResponse.json({ order: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from('pe_orders')
    .select('job, customer')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('pe_orders')
    .delete()
    .eq('id', id);

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
