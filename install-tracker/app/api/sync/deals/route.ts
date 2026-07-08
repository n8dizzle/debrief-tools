import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  getSoldEstimates, getCustomerNames, getTechnicianNames, getInstallJobForProject,
  getAppointmentStart, getInvoice, toEstimateRow,
  estimateStatus, estimateEquipmentCount, stConfigured, type STEstimate,
} from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  const role = (await getServerSession(authOptions))?.user as { role?: string } | undefined;
  return role?.role === 'owner' || role?.role === 'manager';
}

// Independent deal discovery: pull ALL sold estimates since a date, group into
// deals (projects), suggest install/other, upsert install_deals + install_estimates.
// Never overwrites a human triage decision. Params: soldAfter=ISO | days=N | limit=N.
async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 503 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const url = new URL(req.url);
  const days = Number(url.searchParams.get('days')) || 120;
  const soldAfter = url.searchParams.get('soldAfter')
    || new Date(Date.now() - days * 86400_000).toISOString();
  const projectLimit = Number(url.searchParams.get('limit')) || 5000;

  // 1) Discover sold estimates (all BUs)
  const estimates = await getSoldEstimates(soldAfter);
  const withProject = estimates.filter((e) => (e.projectId ?? 0) > 0);
  const noProject = estimates.length - withProject.length;

  // 2) Upsert every sold estimate into install_estimates (the evidence store)
  const estRows = withProject.map((e) => toEstimateRow(e, e.projectId as number));
  for (let i = 0; i < estRows.length; i += 500) {
    await supabase.from('install_estimates').upsert(estRows.slice(i, i + 500), { onConflict: 'estimate_id' });
  }

  // 3) Group estimates by project
  const byProject = new Map<number, STEstimate[]>();
  for (const e of withProject) {
    const pid = e.projectId as number;
    (byProject.get(pid) ?? byProject.set(pid, []).get(pid)!).push(e);
  }
  const projectIds = Array.from(byProject.keys()).slice(0, projectLimit);

  // 4) Resolve customer + technician names, and existing triage decisions (preserve them)
  const custIds = withProject.map((e) => e.customerId ?? 0);
  const techIds = withProject.map((e) => e.soldBy ?? 0);
  const [names, techNames, existing] = await Promise.all([
    getCustomerNames(custIds),
    getTechnicianNames(techIds),
    supabase.from('install_deals').select('st_project_id, triage_status, triaged_by, triaged_at')
      .in('st_project_id', projectIds),
  ]);
  const priorTriage = new Map<number, { triage_status: string; triaged_by: string | null; triaged_at: string | null }>();
  for (const r of (existing.data || []) as { st_project_id: number; triage_status: string; triaged_by: string | null; triaged_at: string | null }[]) {
    priorTriage.set(r.st_project_id, r);
  }

  // 5) Build a deal per project (install-job lookup is concurrent)
  let dealsUpserted = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();
  let idx = 0;
  async function worker() {
    while (idx < projectIds.length) {
      const pid = projectIds[idx++];
      const sold = (byProject.get(pid) || []).filter((e) => estimateStatus(e) === 'Sold');
      const source = sold.length ? sold : byProject.get(pid)!;
      try {
        const equipUnits = sold.reduce((s, e) => s + estimateEquipmentCount(e), 0);
        const contract = sold.reduce((s, e) => s + (e.subtotal ?? 0), 0);
        const soldDates = sold.map((e) => e.soldOn).filter(Boolean).sort() as string[];
        const rep = [...source].sort((a, b) => (b.subtotal ?? 0) - (a.subtotal ?? 0))[0];
        const job = await getInstallJobForProject(pid).catch(() => null);
        // Pull the install job's schedule + invoice straight from ST (own data).
        const [apptStart, invoice] = job
          ? await Promise.all([
              job.firstAppointmentId ? getAppointmentStart(job.firstAppointmentId).catch(() => null) : Promise.resolve(null),
              job.invoiceId ? getInvoice(job.invoiceId).catch(() => null) : Promise.resolve(null),
            ])
          : [null, null];
        const soldByIds = sold.map((e) => e.soldBy).filter(Boolean) as number[];
        const soldByName = soldByIds.length ? techNames.get(soldByIds[0]) ?? null : null;
        const prior = priorTriage.get(pid);

        // Suggest install when the deal sold equipment OR the project already has an
        // HVAC-Install job (catches equipment typed as material / add-ons).
        const suggestInstall = equipUnits > 0 || !!job;
        const reason = equipUnits > 0
          ? `${equipUnits} equipment unit${equipUnits === 1 ? '' : 's'} on ${sold.length} sold estimate${sold.length === 1 ? '' : 's'}`
          : job
            ? `HVAC-Install job ${job.jobNumber} exists (no equipment line on estimate)`
            : `no equipment · ${rep?.businessUnitName ?? 'unknown BU'}`;
        const row = {
          st_project_id: pid,
          triage_status: prior?.triage_status ?? 'untriaged',
          suggested_class: suggestInstall ? 'install' : 'other',
          suggestion_reason: reason,
          customer_id: rep?.customerId ?? null,
          customer_name: rep?.customerId ? names.get(rep.customerId) ?? null : null,
          sold_by_name: soldByName,
          primary_business_unit: rep?.businessUnitName ?? null,
          sold_on: soldDates[0] ? soldDates[0].slice(0, 10) : null,
          sold_estimate_count: sold.length,
          equipment_unit_count: equipUnits,
          contract_total: Number(contract.toFixed(2)),
          install_job_number: job?.jobNumber ?? null,
          install_job_status: job?.jobStatus ?? null,
          scheduled_date: apptStart ? apptStart.slice(0, 10) : null,
          completed_date: job?.completedOn ? job.completedOn.slice(0, 10) : null,
          invoice_number: invoice?.number ?? null,
          invoice_date: invoice?.date ? invoice.date.slice(0, 10) : null,
          invoice_balance: invoice?.balance ?? null,
          invoice_total: invoice?.total ?? null,
          triaged_by: prior?.triaged_by ?? null,
          triaged_at: prior?.triaged_at ?? null,
          synced_at: now,
        };
        const { error } = await supabase!.from('install_deals').upsert(row, { onConflict: 'st_project_id' });
        if (error) errors.push(`project ${pid}: ${error.message}`);
        else dealsUpserted++;
      } catch (err) {
        errors.push(`project ${pid}: ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  return NextResponse.json({
    soldAfter,
    soldEstimates: estimates.length,
    estimatesWithoutProject: noProject,
    projects: projectIds.length,
    dealsUpserted,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
