import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/reports/equipment-by-job?start&end — equipment cost vs revenue per install job.
 * Sums Shearer equipment $ on invoices linked to each install job (via resolve-links),
 * joins the install job's revenue, and computes equipment % of revenue. Range filters on
 * the install job's completed_date. Loads from stored links — no live ServiceTitan calls.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  // Linked supplier invoices (have an install job #) + their line costs.
  const { data: invoices, error } = await supabase
    .from('ap_supplier_invoices')
    .select(`id, vendor, invoice_number, linked_install_job_number, merchandise,
             lines:ap_supplier_invoice_lines(net_amount)`)
    .not('linked_install_job_number', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobNos = Array.from(new Set((invoices || []).map((i: any) => i.linked_install_job_number)));
  if (jobNos.length === 0) return NextResponse.json({ rows: [], unresolved: 0 });

  // Install jobs in range (by completed_date), HVAC-Install.
  let jq = supabase
    .from('ap_install_jobs')
    .select('job_number, customer_name, completed_date, st_revenue, job_total')
    .in('job_number', jobNos)
    .eq('business_unit_name', 'HVAC - Install');
  if (start) jq = jq.gte('completed_date', start);
  if (end) jq = jq.lte('completed_date', end);
  const { data: jobs } = await jq;
  const jobMap = new Map((jobs || []).map((j: any) => [j.job_number, j]));

  // How many job-linked invoices still need resolving (for a UI nudge).
  const { count: unresolved } = await supabase
    .from('ap_supplier_invoices')
    .select('id', { count: 'exact', head: true })
    .not('estimate_job_number', 'is', null)
    .is('links_resolved_at', null);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Aggregate equipment $ per install job (job must be in range).
  const byJob = new Map<string, { equipment: number; invoices: Set<string> }>();
  for (const inv of (invoices || []) as any[]) {
    const jn = inv.linked_install_job_number;
    if (!jobMap.has(jn)) continue;
    const equip = (inv.lines || []).reduce((s: number, l: any) => s + Number(l.net_amount || 0), 0);
    const cur = byJob.get(jn) || { equipment: 0, invoices: new Set<string>() };
    cur.equipment += equip;
    cur.invoices.add(inv.invoice_number);
    byJob.set(jn, cur);
  }

  const rows = Array.from(byJob.entries()).map(([jobNo, v]) => {
    const j: any = jobMap.get(jobNo);
    const revenue = j.st_revenue != null ? Number(j.st_revenue)
      : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : null);
    const equipment = r2(v.equipment);
    const pct = revenue && revenue > 0 ? r2((equipment / revenue) * 100) : null;
    return {
      job_number: jobNo,
      customer_name: j.customer_name,
      completed_date: j.completed_date,
      revenue,
      equipment,
      equipment_pct: pct,
      invoice_count: v.invoices.size,
    };
  }).sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''));

  return NextResponse.json({ rows, unresolved: unresolved || 0 });
}
