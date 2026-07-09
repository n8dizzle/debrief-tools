import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  getSoldEstimates, getCustomerNames, getTechnicianNames, getInstallJobForProject,
  getAppointmentStart, getInvoice, toEstimateRow,
  estimateStatus, stConfigured, type STEstimate,
} from '@/lib/servicetitan';
import { countDeal } from '@/lib/equipment';

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

  // 4) Resolve customer + technician names
  const custIds = withProject.map((e) => e.customerId ?? 0);
  const techIds = withProject.map((e) => e.soldBy ?? 0);
  const [names, techNames] = await Promise.all([
    getCustomerNames(custIds),
    getTechnicianNames(techIds),
  ]);

  // Existing triage decisions — MUST fetch every one so re-sync preserves them.
  // Supabase caps a response at ~1000 rows, so chunk the id list (a single .in()
  // over all ~1400 projects would silently drop ~400 → their archive status lost).
  type PriorRow = { st_project_id: number; triage_status: string; triaged_by: string | null; triaged_at: string | null };
  const priorTriage = new Map<number, PriorRow>();
  for (let i = 0; i < projectIds.length; i += 300) {
    const chunk = projectIds.slice(i, i + 300);
    const { data } = await supabase
      .from('install_deals').select('st_project_id, triage_status, triaged_by, triaged_at').in('st_project_id', chunk);
    for (const r of ((data as unknown) as PriorRow[]) || []) priorTriage.set(r.st_project_id, r);
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
        // Classify each sold estimate's equipment → components + complete systems.
        const { components, systems } = countDeal(
          sold.map((e) => (e.items || []).map((i) => ({ type: i.sku?.type, name: i.sku?.displayName || i.sku?.name, qty: i.qty }))),
        );
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
        // The deal's sold date + seller come from the LATEST sold estimate (most
        // recent sale on the project), not the first.
        const latestSold = [...sold].filter((e) => e.soldOn).sort((a, b) => (a.soldOn! < b.soldOn! ? 1 : -1))[0];
        const soldOnDate = latestSold?.soldOn ? latestSold.soldOn.slice(0, 10) : null;
        const soldByName = latestSold?.soldBy ? techNames.get(latestSold.soldBy) ?? null : null;
        const prior = priorTriage.get(pid);

        // Warranty work (go-backs) comes through ST as Sold estimates too, but it's a
        // separate workflow — flag it distinctly so it stays out of the install pipeline
        // and out of auto-reopen. A deal is warranty when EVERY sold estimate is a
        // warranty estimate.
        const isWarranty = sold.length > 0 && sold.every((e) => /warrant/i.test(e.name || ''));

        // The classifier routes each deal to a suggested WORKFLOW:
        //   warranty  → all sold estimates are warranty work
        //   full_system → at least one complete system, OR an HVAC-Install job exists
        //                  (job-fallback: likely a full install with mis-typed equipment)
        //   partial   → equipment components but no complete system (e.g. AC + coil)
        //   other     → no equipment, no install job (service / not an install)
        const suggestedClass = isWarranty
          ? 'warranty'
          : systems > 0
            ? 'full_system'
            : components > 0
              ? 'partial'         // equipment pieces but no complete system (e.g. AC + coil) — even if a job exists
              : job
                ? 'full_system'   // 0 equipment on estimate but has an HVAC-Install job → likely mis-typed full install, revisit
                : 'other';
        const reason = isWarranty
          ? 'Warranty work — its own workflow'
          : systems > 0
            ? `${systems} full system${systems === 1 ? '' : 's'} · ${components} component${components === 1 ? '' : 's'}`
            : components > 0
              ? `partial — ${components} component${components === 1 ? '' : 's'}, no complete system`
              : job
                ? `HVAC-Install job ${job.jobNumber} exists (no equipment on estimate)`
                : `no equipment · ${rep?.businessUnitName ?? 'unknown BU'}`;

        // Auto-reopen: if ANY sold estimate closes on an archived deal AFTER it was
        // archived, bring it back to Needs Triage for another look (the user re-archives
        // if it's still not an install; warranty is one-time so it won't nag). Guarded
        // on triaged_at so re-archiving doesn't loop.
        const newSaleAfterTriage = !!(prior?.triaged_at && latestSold?.soldOn && latestSold.soldOn > prior.triaged_at);
        const reopen = prior?.triage_status === 'archived' && newSaleAfterTriage;
        const triageStatus = reopen ? 'untriaged' : (prior?.triage_status ?? 'untriaged');

        const row = {
          st_project_id: pid,
          triage_status: triageStatus,
          suggested_class: suggestedClass,
          suggestion_reason: reopen ? `Re-opened: a new estimate sold after you archived this. ${reason}` : reason,
          customer_id: rep?.customerId ?? null,
          customer_name: rep?.customerId ? names.get(rep.customerId) ?? null : null,
          sold_by_name: soldByName,
          primary_business_unit: rep?.businessUnitName ?? null,
          sold_on: soldOnDate,
          sold_estimate_count: sold.length,
          equipment_unit_count: components,
          system_count: systems,
          contract_total: Number(contract.toFixed(2)),
          install_job_number: job?.jobNumber ?? null,
          install_job_status: job?.jobStatus ?? null,
          scheduled_date: apptStart ? apptStart.slice(0, 10) : null,
          completed_date: job?.completedOn ? job.completedOn.slice(0, 10) : null,
          invoice_number: invoice?.number ?? null,
          invoice_date: invoice?.date ? invoice.date.slice(0, 10) : null,
          invoice_balance: invoice?.balance ?? null,
          invoice_total: invoice?.total ?? null,
          triaged_by: reopen ? null : (prior?.triaged_by ?? null),
          triaged_at: reopen ? null : (prior?.triaged_at ?? null),
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
