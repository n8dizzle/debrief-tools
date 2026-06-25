import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission, formatCurrency } from '@/lib/ap-utils';

const BUCKETS = ['equipment', 'material', 'labor', 'soft_cost', 'overhead'];

async function loadActive(supabase: ReturnType<typeof getServerSupabase>, id: string) {
  const { data } = await supabase
    .from('ap_cost_adjustments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  return data;
}

/**
 * PATCH /api/margin/adjustments/[id] — edit amount/label/note/bucket of a manual adjustment.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  const current = await loadActive(supabase, id);
  if (!current) return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });

  const updates: Record<string, unknown> = { updated_by: session.user.id, updated_at: new Date().toISOString() };

  if (body.bucket !== undefined) {
    if (!BUCKETS.includes(body.bucket)) {
      return NextResponse.json({ error: `bucket must be one of ${BUCKETS.join(', ')}` }, { status: 400 });
    }
    updates.bucket = body.bucket;
  }
  if (body.amount !== undefined) {
    const amt = Number(body.amount);
    if (!isFinite(amt) || amt === 0) {
      return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
    }
    updates.amount = amt;
  }
  if (body.label !== undefined) updates.label = body.label || null;
  if (body.note !== undefined) updates.note = body.note || null;

  const { data: updated, error } = await supabase
    .from('ap_cost_adjustments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Adjustment update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('ap_activity_log').insert({
    job_id: current.job_id,
    action: 'adjustment_edited',
    description: `Cost adjustment edited: ${updated.bucket} ${formatCurrency(Number(updated.amount))}${updated.label ? ` (${updated.label})` : ''}`,
    old_value: JSON.stringify({ bucket: current.bucket, amount: Number(current.amount), label: current.label, note: current.note }),
    new_value: JSON.stringify({ bucket: updated.bucket, amount: Number(updated.amount), label: updated.label, note: updated.note }),
    performed_by: session.user.id,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/margin/adjustments/[id] — soft-delete (preserve audit trail).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const current = await loadActive(supabase, id);
  if (!current) return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });

  const { error } = await supabase
    .from('ap_cost_adjustments')
    .update({ deleted_at: new Date().toISOString(), updated_by: session.user.id, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Adjustment delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('ap_activity_log').insert({
    job_id: current.job_id,
    action: 'adjustment_deleted',
    description: `Cost adjustment removed: ${current.bucket} ${formatCurrency(Number(current.amount))}${current.label ? ` (${current.label})` : ''}`,
    old_value: JSON.stringify({ bucket: current.bucket, amount: Number(current.amount), label: current.label, note: current.note }),
    new_value: null,
    performed_by: session.user.id,
  });

  return NextResponse.json({ success: true });
}
