import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasRecallPermission } from '@/lib/qc-recalls';
import { suggestRootCause, type RcaContext } from '@/lib/root-cause-ai';

export const maxDuration = 60;

type Ctx = { params: Promise<{ jobId: string }> };

// POST /api/recalls/[jobId]/suggest — on-demand AI root-cause suggestion (suggest-only).
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (Number.isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: recall } = await supabase
    .from('sd_recalls_caused')
    .select('st_original_job_id, trade, job_type_name, business_unit_name, days_to_recall, equipment_id')
    .eq('st_recall_job_id', jobId)
    .maybeSingle();

  let equipment: RcaContext['equipment'] = null;
  if (recall?.equipment_id != null) {
    const { data: e } = await supabase
      .from('sd_equipment')
      .select('manufacturer, model, type, installed_on')
      .eq('st_equipment_id', recall.equipment_id)
      .maybeSingle();
    if (e) equipment = { manufacturer: e.manufacturer, model: e.model, type: e.type, installedOn: e.installed_on };
  }

  // Job summaries from ServiceTitan (best-effort — don't fail the suggestion if ST is slow/down).
  let originalSummary: string | null = null;
  let recallSummary: string | null = null;
  try {
    const st = getServiceTitanClient();
    const [recallJob, originalJob] = await Promise.all([
      st.getJobById(jobId),
      recall?.st_original_job_id ? st.getJobById(recall.st_original_job_id) : Promise.resolve(null),
    ]);
    recallSummary = recallJob?.summary ?? null;
    originalSummary = originalJob?.summary ?? null;
  } catch {
    // leave summaries null — equipment/timing context is still useful
  }

  const ctx: RcaContext = {
    trade: recall?.trade ?? null,
    jobType: recall?.job_type_name ?? null,
    daysToRecall: recall?.days_to_recall ?? null,
    businessUnit: recall?.business_unit_name ?? null,
    equipment,
    originalSummary,
    recallSummary,
  };

  try {
    const suggestion = await suggestRootCause(ctx);
    return NextResponse.json({ suggestion }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = (err as Error).message || 'Suggestion failed';
    // 503 for "not configured", 502 for upstream AI error — both let the UI show a clean message
    const status = msg.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
