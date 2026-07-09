import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getFormSubmissions, getJobProjectMap, stConfigured, type STFormSubmission } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// The live "Sales - Estimate Debrief HVAC / Instructions for Installers" form.
const DEBRIEF_FORM_ID = 2709;

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true;
  const role = (await getServerSession(authOptions))?.user as { role?: string } | undefined;
  return role?.role === 'owner' || role?.role === 'manager';
}

function ownerJob(s: STFormSubmission): number | null {
  return s.owners?.find((o) => o.type === 'Job')?.id ?? null;
}
function paymentType(s: STFormSubmission): string[] {
  const u = s.units?.find((x) => x.name === 'Payment Type');
  return (u?.values ?? []).filter(Boolean);
}
// Keep the whole submission's answers for later (only payment_type is surfaced today).
function leanFields(s: STFormSubmission) {
  return (s.units ?? [])
    .filter((u) => u.name)
    .map((u) => ({ name: u.name, type: u.type, value: u.value ?? null, values: u.values ?? null }));
}

// Sync Estimate Debrief submissions → install_debriefs. Params: formId=N (default 2709).
async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 503 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const formId = Number(new URL(req.url).searchParams.get('formId')) || DEBRIEF_FORM_ID;

  // 1) Pull every submission for the form.
  const subs = await getFormSubmissions(formId);

  // 2) Reuse job→project resolutions from prior syncs so a re-run doesn't re-hit ST for
  //    the ~2k jobs. Page past Supabase's 1000-row cap.
  const jobProject = new Map<number, number | null>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('install_debriefs').select('owner_job_id, st_project_id')
      .not('owner_job_id', 'is', null).range(from, from + 999);
    const rows = ((data as unknown) as { owner_job_id: number; st_project_id: number | null }[]) || [];
    for (const r of rows) if (r.st_project_id != null) jobProject.set(r.owner_job_id, r.st_project_id);
    if (rows.length < 1000) break;
  }

  // 3) Resolve only the jobs we haven't seen before.
  const toResolve = Array.from(new Set(
    subs.map(ownerJob).filter((j): j is number => j != null && !jobProject.has(j)),
  ));
  const resolved = await getJobProjectMap(toResolve);
  for (const [job, proj] of resolved) jobProject.set(job, proj);

  // 4) Upsert one row per submission.
  const now = new Date().toISOString();
  const rows = subs.map((s) => {
    const job = ownerJob(s);
    return {
      submission_id: s.id,
      form_id: formId,
      st_project_id: job != null ? jobProject.get(job) ?? null : null,
      owner_job_id: job,
      status: s.status ?? null,
      submitted_on: s.submittedOn ?? null,
      payment_type: paymentType(s),
      fields: leanFields(s),
      synced_at: now,
    };
  });
  let upserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('install_debriefs').upsert(rows.slice(i, i + 500), { onConflict: 'submission_id' });
    if (error) errors.push(error.message);
    else upserted += rows.slice(i, i + 500).length;
  }

  const linked = rows.filter((r) => r.st_project_id != null).length;
  const withPay = rows.filter((r) => r.payment_type.length > 0).length;
  return NextResponse.json({
    formId,
    submissions: subs.length,
    upserted,
    linkedToProject: linked,
    unlinked: rows.length - linked,
    withPaymentType: withPay,
    jobsResolvedThisRun: toResolve.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
