import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasRecallPermission, getActiveRootCauseCategories } from '@/lib/qc-recalls';
import { suggestRootCause, AI_MODEL_ID, type RcaContext } from '@/lib/root-cause-ai';

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

  // Job summaries + notes from ServiceTitan (best-effort — don't fail the suggestion if ST is slow/down).
  let originalSummary: string | null = null;
  let recallSummary: string | null = null;
  let originalNotes: string[] = [];
  let recallNotes: string[] = [];
  try {
    const st = getServiceTitanClient();
    const [recallJob, recallNotesRaw, originalJob, originalNotesRaw] = await Promise.all([
      st.getJobById(jobId),
      st.getJobNotes(jobId),
      recall?.st_original_job_id ? st.getJobById(recall.st_original_job_id) : Promise.resolve(null),
      recall?.st_original_job_id ? st.getJobNotes(recall.st_original_job_id) : Promise.resolve([] as { text: string }[]),
    ]);
    recallSummary = recallJob?.summaryOfWork || recallJob?.summary || null;
    originalSummary = originalJob?.summaryOfWork || originalJob?.summary || null;
    recallNotes = (recallNotesRaw || []).map(n => n.text);
    originalNotes = (originalNotesRaw || []).map(n => n.text);
  } catch {
    // leave summaries/notes empty — equipment/timing context is still useful
  }

  const ctx: RcaContext = {
    trade: recall?.trade ?? null,
    jobType: recall?.job_type_name ?? null,
    daysToRecall: recall?.days_to_recall ?? null,
    businessUnit: recall?.business_unit_name ?? null,
    equipment,
    originalSummary,
    recallSummary,
    originalNotes,
    recallNotes,
  };

  try {
    const activeCategories = await getActiveRootCauseCategories(supabase);
    const suggestion = await suggestRootCause(ctx, activeCategories);
    // Persist the fresh proposal so a re-run isn't lost on tab close. Never clobber a human
    // decision: only (re)write ai_* + set ai_proposed when the record isn't already validated/overridden.
    const { data: inv } = await supabase.from('sd_recall_investigations')
      .select('id, validation_state').eq('st_recall_job_id', jobId).maybeSingle();
    const humanDecided = inv?.validation_state === 'validated' || inv?.validation_state === 'overridden';
    const patch: Record<string, unknown> = {
      st_recall_job_id: jobId,
      ai_root_cause_category: suggestion.root_cause_category,
      ai_rationale: suggestion.rationale,
      ai_evidence: suggestion.evidence,
      ai_confidence: suggestion.confidence,
      ai_model: AI_MODEL_ID,
      ai_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!inv) patch.status = 'open';              // brand-new investigation
    if (!humanDecided) patch.validation_state = 'ai_proposed'; // don't clobber a human decision
    await supabase.from('sd_recall_investigations').upsert(patch, { onConflict: 'st_recall_job_id' });
    return NextResponse.json({ suggestion }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = (err as Error).message || 'Suggestion failed';
    // 503 for "not configured", 502 for upstream AI error — both let the UI show a clean message
    const status = msg.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
