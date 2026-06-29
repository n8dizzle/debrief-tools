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

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, job_number, customer_name, job_type_name, completed_date, st_revenue, job_total')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .order('completed_date', { ascending: false, nullsFirst: false });
  if (start) q = q.gte('completed_date', start);
  if (end) q = q.lte('completed_date', end);
  const { data: jobs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobRows = jobs || [];
  const ids = jobRows.map((j: any) => j.id);
  const jobNos = jobRows.map((j: any) => j.job_number);

  // Saved manual cost inputs.
  const inputsByJob = new Map<string, any>();
  if (ids.length) {
    const { data: inputs } = await supabase
      .from('ap_job_cost_inputs')
      .select('job_id, equipment_amount, material_amount, labor_amount')
      .in('job_id', ids);
    for (const r of (inputs || []) as any[]) inputsByJob.set(r.job_id, r);
  }

  // Matched estimate job # (reverse of resolved Shearer PO links).
  const estByJobNo = new Map<string, string>();
  if (jobNos.length) {
    const { data: links } = await supabase
      .from('ap_supplier_invoices')
      .select('estimate_job_number, linked_install_job_number')
      .in('linked_install_job_number', jobNos)
      .not('estimate_job_number', 'is', null);
    for (const r of (links || []) as any[]) estByJobNo.set(r.linked_install_job_number, r.estimate_job_number);
  }

  const rows = jobRows.map((j: any) => {
    const inp = inputsByJob.get(j.id);
    const invoice = j.st_revenue != null ? Number(j.st_revenue)
      : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : null);
    return {
      id: j.id,
      st_job_id: j.st_job_id,
      job_number: j.job_number,
      estimate_job_number: estByJobNo.get(j.job_number) || null,
      customer_name: j.customer_name,
      job_type: j.job_type_name,
      completed_date: j.completed_date,
      invoice,
      equipment_amount: inp?.equipment_amount != null ? Number(inp.equipment_amount) : null,
      material_amount: inp?.material_amount != null ? Number(inp.material_amount) : null,
      labor_amount: inp?.labor_amount != null ? Number(inp.labor_amount) : null,
    };
  });

  return NextResponse.json({ rows });
}
