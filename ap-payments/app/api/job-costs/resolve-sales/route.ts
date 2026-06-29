import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * POST /api/job-costs/resolve-sales?start&end — resolve the comfort advisor (sold-by)
 * for HVAC-Install jobs: install job → project → the Sold estimate → soldBy (tech →
 * ap_technicians name) + estimate job # + sold date. Stores on ap_install_jobs.
 * Idempotent: only jobs not yet resolved unless ?all=1.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const all = searchParams.get('all') === '1';
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, job_number, st_project_id')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled');
  if (!all) q = q.is('sales_resolved_at', null);
  if (start) q = q.gte('completed_date', start);
  if (end) q = q.lte('completed_date', end);
  const { data: jobs, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length === 0) return NextResponse.json({ resolved: 0, with_advisor: 0 });

  const st = getServiceTitanClient();
  if (!st.isConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });

  // Backfill missing project ids.
  const needProject = jobs.filter((j: any) => !j.st_project_id && j.st_job_id).map((j: any) => j.st_job_id);
  const projForJob = needProject.length ? await st.getProjectIdsForJobs(needProject) : new Map<number, number>();
  for (const j of jobs as any[]) {
    if (!j.st_project_id && j.st_job_id && projForJob.has(j.st_job_id)) j.st_project_id = projForJob.get(j.st_job_id);
  }

  // Sold-by per project.
  const projectIds = Array.from(new Set(jobs.map((j: any) => j.st_project_id).filter(Boolean)));
  const salesByProject = await st.getSalesInfoByProject(projectIds as number[]);

  // tech id → name.
  const techIds = Array.from(new Set(Array.from(salesByProject.values()).map(v => v.sold_by_st_id).filter(Boolean)));
  const nameById = new Map<number, string>();
  if (techIds.length) {
    const { data: techs } = await supabase.from('ap_technicians').select('st_technician_id, name').in('st_technician_id', techIds);
    for (const t of (techs || []) as any[]) nameById.set(t.st_technician_id, t.name);
  }

  let resolved = 0, withAdvisor = 0;
  for (const j of jobs as any[]) {
    const sales = j.st_project_id ? salesByProject.get(j.st_project_id) : null;
    const soldById = sales?.sold_by_st_id ?? null;
    const soldByName = soldById != null ? (nameById.get(soldById) || null) : null;
    await supabase.from('ap_install_jobs').update({
      st_project_id: j.st_project_id ?? null,
      sold_by_st_technician_id: soldById,
      sold_by_name: soldByName,
      sold_estimate_job_number: sales?.estimate_job_number ?? null,
      sold_on: sales?.sold_on ?? null,
      sales_resolved_at: new Date().toISOString(),
    }).eq('id', j.id);
    resolved++;
    if (soldByName) withAdvisor++;
  }

  return NextResponse.json({ resolved, with_advisor: withAdvisor });
}
