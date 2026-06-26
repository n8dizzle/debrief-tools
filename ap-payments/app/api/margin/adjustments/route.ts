import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission, formatCurrency } from '@/lib/ap-utils';

const BUCKETS = ['equipment', 'material', 'labor', 'soft_cost', 'overhead'];

/**
 * POST /api/margin/adjustments — add a manual per-invoice cost adjustment.
 * Body: { job_id, bucket, amount (signed), label?, note? }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { job_id, bucket, amount, label, note } = body;

  if (!job_id) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
  }
  if (!BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: `bucket must be one of ${BUCKETS.join(', ')}` }, { status: 400 });
  }
  const amt = Number(amount);
  if (!isFinite(amt) || amt === 0) {
    return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Confirm the job exists (FK would catch it, but a clean 404 is friendlier).
  const { data: job } = await supabase
    .from('ap_install_jobs')
    .select('id, contractor_id')
    .eq('id', job_id)
    .single();
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: created, error } = await supabase
    .from('ap_cost_adjustments')
    .insert({
      job_id,
      bucket,
      amount: amt,
      label: label || null,
      note: note || null,
      source: 'manual',
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Adjustment insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('ap_activity_log').insert({
    job_id,
    contractor_id: job.contractor_id,
    action: 'adjustment_added',
    description: `Cost adjustment added: ${bucket} ${formatCurrency(amt)}${label ? ` (${label})` : ''}`,
    old_value: null,
    new_value: JSON.stringify({ bucket, amount: amt, label: label || null, note: note || null }),
    performed_by: session.user.id,
  });

  return NextResponse.json(created, { status: 201 });
}
