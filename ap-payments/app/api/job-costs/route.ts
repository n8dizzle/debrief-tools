import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/job-costs?start&end — install-job cost worksheet rows. Each HVAC-Install job
 * in the completed-date range with: matched estimate job # (via resolved Shearer PO
 * links), invoice total, and any hand-keyed Equipment/Material/Labor $.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Comfort advisors we track for commission. Scope the tab to their deals only (drops
  // all non-advisor / unsold noise). Extend this list to add an advisor.
  const COMFORT_ADVISOR_TECH_IDS = [135560302, 37214486]; // Brett Sutherland, Luke Sage

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, job_number, customer_name, job_type_name, completed_date, st_revenue, job_total, sold_by_name, sold_estimate_job_number, sold_on, sales_resolved_at')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .in('sold_by_st_technician_id', COMFORT_ADVISOR_TECH_IDS)
    .order('completed_date', { ascending: false, nullsFirst: false });
  if (start) q = q.gte('completed_date', start);
  if (end) q = q.lte('completed_date', end);
  const { data: jobs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobRows = jobs || [];
  const ids = jobRows.map((j: any) => j.id);

  // Saved manual cost inputs.
  const inputsByJob = new Map<string, any>();
  if (ids.length) {
    const { data: inputs } = await supabase
      .from('ap_job_cost_inputs')
      .select('job_id, equipment_amount, material_amount, labor_amount')
      .in('job_id', ids);
    for (const r of (inputs || []) as any[]) inputsByJob.set(r.job_id, r);
  }

  // How many in this range still need their comfort advisor resolved (UI nudge).
  let uq = supabase.from('ap_install_jobs').select('id', { count: 'exact', head: true })
    .eq('business_unit_name', 'HVAC - Install').neq('job_status', 'Canceled').is('sales_resolved_at', null);
  if (start) uq = uq.gte('completed_date', start);
  if (end) uq = uq.lte('completed_date', end);
  const { count: unresolved } = await uq;

  const rows = jobRows.map((j: any) => {
    const inp = inputsByJob.get(j.id);
    const invoice = j.st_revenue != null ? Number(j.st_revenue)
      : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : null);
    return {
      id: j.id,
      st_job_id: j.st_job_id,
      job_number: j.job_number,
      estimate_job_number: j.sold_estimate_job_number || null,
      sold_by: j.sold_by_name || null,
      sold_on: j.sold_on || null,
      customer_name: j.customer_name,
      job_type: j.job_type_name,
      completed_date: j.completed_date,
      invoice,
      equipment_amount: inp?.equipment_amount != null ? Number(inp.equipment_amount) : null,
      material_amount: inp?.material_amount != null ? Number(inp.material_amount) : null,
      labor_amount: inp?.labor_amount != null ? Number(inp.labor_amount) : null,
    };
  });

  return NextResponse.json({ rows, unresolved: unresolved || 0 });
}
