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
    // No FK between ap_job_assignments.pay_type_id and ap_pay_types, so we can't embed —
    // fetch pay_type_id and resolve names in a separate lookup below.
    supabase.from('ap_job_assignments')
      .select('job_id, pay_amount, pay_type_id, pay_basis')
      .eq('technician_id', technicianId).eq('assignee_type', 'technician').in('job_id', jobIds),
  ]);
  const hoursByJob = new Map<string, number>();
  for (const l of (labRes.data || []) as any[]) hoursByJob.set(l.job_id, l.hours == null ? 0 : Number(l.hours));

  const assigns = (assignRes.data || []) as any[];
  const ptIds = Array.from(new Set(assigns.map(a => a.pay_type_id).filter(Boolean)));
  const { data: ptRows } = ptIds.length
    ? await supabase.from('ap_pay_types').select('id, name').in('id', ptIds)
    : { data: [] as any[] };
  const ptName = new Map((ptRows || []).map((p: any) => [p.id, p.name]));

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const payByJob = new Map<string, any>();
  for (const a of assigns) {
    const pb = a.pay_basis || {};
    const pay = a.pay_amount == null ? null : Number(a.pay_amount);
    // Commission $ = percent of revenue; hourly = the rest (pay - commission) so the two
    // always sum to pay (matches the per-tech summary; flats/overrides land in hourly).
    const commission = pb.percent != null && pb.revenue != null ? r2(Number(pb.revenue) * Number(pb.percent) / 100) : (pay != null ? 0 : null);
    const hourly = pay != null ? r2(pay - (commission || 0)) : null;
    payByJob.set(a.job_id, {
      pay_amount: pay,
      pay_type: ptName.get(a.pay_type_id) || null,
      commission, hourly,
    });
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
      commission: pay?.commission ?? null,
      hourly: pay?.hourly ?? null,
    };
  }).sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''));

  return NextResponse.json({ jobs: rows });
}
