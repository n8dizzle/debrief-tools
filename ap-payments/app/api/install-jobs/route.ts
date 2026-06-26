import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/install-jobs — install jobs for a period with their crew assignments
 * (multiple technicians/subcontractors per job, from ap_job_assignments).
 * Query: start, end (completed_date range), trade, business_unit.
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

  let query = supabase
    .from('ap_install_jobs')
    .select(`
      id, st_job_id, job_number, customer_name, trade, job_type_name,
      business_unit_name, completed_date, job_status, st_revenue, job_total
    `)
    .eq('business_unit_name', 'HVAC - Install')  // tab is scoped to HVAC Install only
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .order('completed_date', { ascending: false });

  if (start) query = query.gte('completed_date', start);
  if (end) query = query.lte('completed_date', end);

  const { data: jobs, error } = await query;
  if (error) {
    console.error('Install jobs query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const jobRows = jobs || [];
  const jobIds = jobRows.map((j: any) => j.id);

  // One query for all assignments across these jobs (no N+1).
  const byJob = new Map<string, any[]>();
  if (jobIds.length > 0) {
    const { data: assignments } = await supabase
      .from('ap_job_assignments')
      .select(`
        id, job_id, assignee_type, technician_id, contractor_id, pay_amount, pay_type_id, pay_basis,
        technician:ap_technicians(name), contractor:ap_contractors(name)
      `)
      .in('job_id', jobIds)
      .order('created_at', { ascending: true });

    for (const a of (assignments || []) as any[]) {
      const list = byJob.get(a.job_id) || [];
      list.push({
        id: a.id,
        type: a.assignee_type,
        technician_id: a.technician_id,
        contractor_id: a.contractor_id,
        name: a.assignee_type === 'technician' ? a.technician?.name : a.contractor?.name,
        pay_amount: a.pay_amount,
        pay_type_id: a.pay_type_id,
        pay_basis: a.pay_basis,
      });
      byJob.set(a.job_id, list);
    }
  }

  const rows = jobRows.map((j: any) => ({
    id: j.id,
    st_job_id: j.st_job_id,
    job_number: j.job_number,
    customer_name: j.customer_name,
    trade: j.trade,
    job_type: j.job_type_name,
    business_unit: j.business_unit_name,
    completed_date: j.completed_date,
    // Invoice amount = ServiceTitan report revenue (st_revenue); fall back to job_total when present.
    invoice_amount: j.st_revenue != null ? Number(j.st_revenue) : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : null),
    assignments: byJob.get(j.id) || [],
  }));

  return NextResponse.json({ rows });
}
