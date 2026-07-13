import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/pay-runs/eligible — contractors that have approved ("ready to pay") jobs,
 * with those jobs, for building a lump payment (Pay Run). Only contractor-assigned,
 * ready_to_pay, non-ignored jobs are eligible (keeps the approval chain intact).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { data: jobs, error } = await supabase
    .from('ap_install_jobs')
    .select('id, job_number, customer_name, job_address, completed_date, payment_amount, contractor_id')
    .eq('assignment_type', 'contractor')
    .eq('payment_status', 'ready_to_pay')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .order('completed_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobRows = (jobs || []).filter((j: any) => j.contractor_id);
  const contractorIds = Array.from(new Set(jobRows.map((j: any) => j.contractor_id)));
  const nameById = new Map<string, string>();
  if (contractorIds.length) {
    const { data: cons } = await supabase.from('ap_contractors').select('id, name, payment_method').in('id', contractorIds);
    for (const c of (cons || []) as any[]) nameById.set(c.id, c.name);
  }

  const byContractor = new Map<string, any>();
  for (const j of jobRows as any[]) {
    if (!byContractor.has(j.contractor_id)) {
      byContractor.set(j.contractor_id, { contractor_id: j.contractor_id, contractor_name: nameById.get(j.contractor_id) || 'Unknown', jobs: [] });
    }
    byContractor.get(j.contractor_id).jobs.push({
      id: j.id, job_number: j.job_number, customer_name: j.customer_name, job_address: j.job_address || null,
      completed_date: j.completed_date, payment_amount: j.payment_amount != null ? Number(j.payment_amount) : 0,
    });
  }

  const contractors = Array.from(byContractor.values())
    .map(c => ({ ...c, total: c.jobs.reduce((s: number, j: any) => s + (j.payment_amount || 0), 0) }))
    .sort((a, b) => a.contractor_name.localeCompare(b.contractor_name));

  return NextResponse.json({ contractors });
}
