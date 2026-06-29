import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * POST /api/supplier-invoices/resolve-links — link job-linked Shearer invoices to their
 * install job. PO = sales estimate job #; that estimate's project also holds the
 * HVAC-Install (BU 610) job. Resolves PO → estimate.projectId → install job # and stores
 * it. Idempotent: by default only fills invoices not yet resolved (?all=1 re-resolves).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const all = new URL(request.url).searchParams.get('all') === '1';
  const supabase = getServerSupabase();

  let q = supabase
    .from('ap_supplier_invoices')
    .select('id, estimate_job_number')
    .not('estimate_job_number', 'is', null);
  if (!all) q = q.is('links_resolved_at', null);
  const { data: invoices, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices || invoices.length === 0) return NextResponse.json({ resolved: 0, linked: 0 });

  const st = getServiceTitanClient();
  if (!st.isConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });

  // PO (estimate job #) → projectId via the estimate, then projectId → install job #.
  const estJobs = Array.from(new Set(invoices.map((i: any) => i.estimate_job_number)));
  const ests = await st.getEstimateEquipmentByJob(estJobs);
  const projectByJob = new Map<string, number>();
  for (const [jobNo, e] of ests) if (e.project_id) projectByJob.set(jobNo, e.project_id);
  const installByProject = await st.getInstallJobByProject(Array.from(new Set(projectByJob.values())));

  let resolved = 0, linked = 0;
  for (const inv of invoices) {
    const pid = projectByJob.get(inv.estimate_job_number) ?? null;
    const installJobNo = pid != null ? (installByProject.get(pid) ?? null) : null;
    await supabase.from('ap_supplier_invoices').update({
      estimate_project_id: pid,
      linked_install_job_number: installJobNo,
      links_resolved_at: new Date().toISOString(),
    }).eq('id', inv.id);
    resolved++;
    if (installJobNo) linked++;
  }

  return NextResponse.json({ resolved, linked });
}
