import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

const INSTALL_BU_ID = 610; // HVAC - Install

/**
 * GET /api/reports/labor-by-tech — per-technician labor on HVAC Install jobs in a date
 * range (by completed_date): ST clocked hours + pay you've set, with each tech's home
 * team so cross-team helpers (e.g. HVAC-Service) are visible. Excludes the generic
 * "Install Team" ST account.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  // Install jobs in range.
  let jq = supabase
    .from('ap_install_jobs')
    .select('id')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false');
  if (start) jq = jq.gte('completed_date', start);
  if (end) jq = jq.lte('completed_date', end);
  const { data: jobs, error: jobsErr } = await jq;
  if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });

  const jobIds = (jobs || []).map((j: any) => j.id);
  if (jobIds.length === 0) return NextResponse.json({ techs: [], job_count: 0 });

  // ST crew (hours) + pay assignments, across those jobs.
  const [crewRes, assignRes] = await Promise.all([
    supabase.from('ap_job_st_labor')
      .select('job_id, technician_id, technician_name, hours')
      .in('job_id', jobIds)
      .not('technician_id', 'is', null),
    supabase.from('ap_job_assignments')
      .select('job_id, technician_id, pay_amount, pay_basis')
      .in('job_id', jobIds)
      .eq('assignee_type', 'technician')
      .not('pay_amount', 'is', null),
  ]);
  const crew = (crewRes.data || []) as any[];
  const assigns = (assignRes.data || []) as any[];

  // Home team per technician.
  const techIds = Array.from(new Set(crew.map(c => c.technician_id)));
  const { data: techRows } = techIds.length
    ? await supabase.from('ap_technicians').select('id, name, business_unit_id, business_unit_name').in('id', techIds)
    : { data: [] as any[] };
  const techMap = new Map((techRows || []).map((t: any) => [t.id, t]));

  // Pay per technician, split into commission ($ = percent of revenue from pay_basis)
  // and hourly (= everything else: pay_amount - commission). By construction the two
  // always sum to pay_set, so flats/overrides land in the hourly bucket.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const payByTech = new Map<string, { pay: number; commission: number; hourly: number }>();
  // (tech|job) pairs whose pay type actually uses hours (Hourly or Hourly+Commission),
  // so we can total ST hours on hourly-paid work only (excludes pure commission + flat).
  const hourlyPairs = new Set<string>();
  for (const a of assigns) {
    const pay = Number(a.pay_amount || 0);
    const pb = a.pay_basis || {};
    const commission = pb.percent != null && pb.revenue != null ? Number(pb.revenue) * Number(pb.percent) / 100 : 0;
    const cur = payByTech.get(a.technician_id) || { pay: 0, commission: 0, hourly: 0 };
    cur.pay += pay;
    cur.commission += commission;
    cur.hourly += pay - commission;
    payByTech.set(a.technician_id, cur);
    if (pb.hourly_rate != null) hourlyPairs.add(`${a.technician_id}|${a.job_id}`);
  }

  // Aggregate crew per technician.
  const agg = new Map<string, { jobs: Set<string>; hours: number; hourly_hours: number; name: string }>();
  for (const c of crew) {
    const cur = agg.get(c.technician_id) || { jobs: new Set<string>(), hours: 0, hourly_hours: 0, name: c.technician_name || '' };
    cur.jobs.add(c.job_id);
    const h = Number(c.hours || 0);
    cur.hours += h;
    if (hourlyPairs.has(`${c.technician_id}|${c.job_id}`)) cur.hourly_hours += h;
    if (!cur.name && c.technician_name) cur.name = c.technician_name;
    agg.set(c.technician_id, cur);
  }

  const techs = Array.from(agg.entries())
    .map(([technician_id, v]) => {
      const t = techMap.get(technician_id);
      const name = t?.name || v.name || '—';
      const p = payByTech.get(technician_id) || { pay: 0, commission: 0, hourly: 0 };
      return {
        technician_id,
        name,
        home_team: t?.business_unit_name || null,
        is_install: t?.business_unit_id === INSTALL_BU_ID,
        jobs: v.jobs.size,
        hours: Math.round(v.hours * 100) / 100,
        hourly_hours: r2(v.hourly_hours),
        pay_set: r2(p.pay),
        commission: r2(p.commission),
        hourly: r2(p.hourly),
      };
    })
    .filter(t => t.name !== 'Install Team')
    .sort((a, b) => b.hours - a.hours);

  return NextResponse.json({ techs, job_count: jobIds.length });
}
