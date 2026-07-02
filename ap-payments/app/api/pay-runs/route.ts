import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission, formatLocalDate } from '@/lib/ap-utils';

function hasPermission(session: any, perm: string): boolean {
  if (session.user.role === 'owner') return true;
  return !!session.user.permissions?.ap_payments?.[perm];
}

/**
 * POST /api/pay-runs — record a lump payment (Pay Run) across several of one
 * contractor's approved jobs. Creates an ap_contractor_payments record and marks
 * every selected job Paid, linked to the run, stamped with the confirmation code.
 * Body: { contractor_id, job_ids[], confirmation_code, payment_method, paid_on, total_amount, notes }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Paying out is the "issue payments" gate (same as marking a single job paid).
  if (!hasPermission(session, 'can_issue_payments')) {
    return NextResponse.json({ error: 'You do not have permission to issue payments. Contact a manager.' }, { status: 403 });
  }

  const body = await request.json();
  const { contractor_id, job_ids, confirmation_code, payment_method, paid_on, total_amount, notes } = body;

  if (!contractor_id || !Array.isArray(job_ids) || job_ids.length === 0) {
    return NextResponse.json({ error: 'contractor_id and at least one job are required' }, { status: 400 });
  }
  if (!confirmation_code || !String(confirmation_code).trim()) {
    return NextResponse.json({ error: 'A confirmation code is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const userId = session.user.id;

  // Validate the jobs: they must all belong to this contractor and be ready_to_pay.
  const { data: jobs, error: jobsErr } = await supabase
    .from('ap_install_jobs')
    .select('id, contractor_id, payment_status, payment_amount, job_number')
    .in('id', job_ids);
  if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });

  const bad = (jobs || []).filter((j: any) => j.contractor_id !== contractor_id || j.payment_status !== 'ready_to_pay');
  if ((jobs || []).length !== job_ids.length || bad.length > 0) {
    return NextResponse.json({ error: 'All jobs must belong to this contractor and be approved (ready to pay).' }, { status: 400 });
  }

  const summedAmount = (jobs || []).reduce((s: number, j: any) => s + (j.payment_amount != null ? Number(j.payment_amount) : 0), 0);
  const total = total_amount != null && total_amount !== '' ? Number(total_amount) : summedAmount;
  const paidOn = paid_on || formatLocalDate(new Date());
  const code = String(confirmation_code).trim();

  // Create the Pay Run.
  const { data: run, error: runErr } = await supabase
    .from('ap_contractor_payments')
    .insert({
      contractor_id,
      total_amount: total,
      job_count: job_ids.length,
      confirmation_code: code,
      payment_method: payment_method || null,
      paid_on: paidOn,
      paid_by: userId,
      notes: notes || null,
    })
    .select('id')
    .single();
  if (runErr || !run) return NextResponse.json({ error: runErr?.message || 'Failed to create pay run' }, { status: 500 });

  const nowIso = new Date().toISOString();
  // Mark each job paid + link to the run.
  const { error: updErr } = await supabase
    .from('ap_install_jobs')
    .update({
      payment_status: 'paid',
      payment_paid_at: nowIso,
      payment_paid_by: userId,
      payment_batch_id: run.id,
      payment_confirmation_code: code,
      payment_method: payment_method || null,
    })
    .in('id', job_ids);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Activity log per job.
  const logs = (jobs || []).map((j: any) => ({
    job_id: j.id,
    contractor_id,
    action: 'payment_paid',
    description: `Paid via lump payment (${job_ids.length} jobs, conf ${code})`,
    old_value: 'ready_to_pay',
    new_value: 'paid',
    performed_by: userId,
  }));
  if (logs.length) await supabase.from('ap_activity_log').insert(logs);

  return NextResponse.json({ id: run.id, job_count: job_ids.length, total_amount: total, confirmation_code: code });
}
