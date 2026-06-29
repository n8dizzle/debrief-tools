import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/reports/labor-by-tech/[id]?start&end — one technician's HVAC Install jobs
 * in a date range, with ST clocked hours, the pay type chosen, and pay set. Shows any
 * job where the tech has ST labor OR a pay assignment.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: technicianId } = await params;
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  let jq = supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, job_number, customer_name, completed_date, invoice_amount:st_revenue, job_total')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false');
  if (start) jq = jq.gte('completed_date', start);
  if (end) jq = jq.lte('completed_date', end);
  const { data: jobs, error } = await jq;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobIds = (jobs || []).map((j: any) => j.id);
  if (jobIds.length === 0) return NextResponse.json({ jobs: [] });
  const jobMap = new Map((jobs || []).map((j: any) => [j.id, j]));

  const [labRes, assignRes] = await Promise.all([
    supabase.from('ap_job_st_labor').select('job_id, hours').eq('technician_id', technicianId).in('job_id', jobIds),
    supabase.from('ap_job_assignments')
      .select('job_id, pay_amount, pay_basis, pay_type:ap_pay_types(name)')
      .eq('technician_id', technicianId).eq('assignee_type', 'technician').in('job_id', jobIds),
  ]);
  const hoursByJob = new Map<string, number>();
  for (const l of (labRes.data || []) as any[]) hoursByJob.set(l.job_id, l.hours == null ? 0 : Number(l.hours));
  const payByJob = new Map<string, any>();
  for (const a of (assignRes.data || []) as any[]) {
    const pt = Array.isArray(a.pay_type) ? a.pay_type[0] : a.pay_type;
    payByJob.set(a.job_id, { pay_amount: a.pay_amount == null ? null : Number(a.pay_amount), pay_type: pt?.name || null });
  }

  // Union of jobs the tech touched (labor or pay).
  const touched = new Set<string>([...hoursByJob.keys(), ...payByJob.keys()]);
  const rows = Array.from(touched).map(jid => {
    const j: any = jobMap.get(jid) || {};
    const pay = payByJob.get(jid);
    const inv = j.invoice_amount != null ? Number(j.invoice_amount) : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : null);
    return {
      job_id: jid,
      st_job_id: j.st_job_id ?? null,
      job_number: j.job_number ?? '—',
      customer_name: j.customer_name ?? null,
      completed_date: j.completed_date ?? null,
      invoice_amount: inv,
      hours: hoursByJob.has(jid) ? hoursByJob.get(jid)! : null,
      pay_type: pay?.pay_type ?? null,
      pay_amount: pay?.pay_amount ?? null,
    };
  }).sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''));

  return NextResponse.json({ jobs: rows });
}
