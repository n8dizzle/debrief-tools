import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { stripHtml } from '@/lib/text';

// Public, token-gated endpoint for a technician to answer a research question via a
// magic link — no login. The 48-char token is the secret; there is no other auth.
// Exempt from the auth middleware (see middleware.ts matcher).
//
// Special token "demo" → a safe sandbox with sample data (no real record, no writes) so
// a supervisor can walk the exact technician experience for coaching.

const DEMO = {
  demo: true,
  already_answered: false,
  answer: null,
  question: 'Was the condensate line flushed and the drain pan checked before you closed out?',
  context: {
    customer_name: 'Sample Customer (demo)',
    days_to_recall: 6,
    equipment: 'Trane XR16 (demo)',
    original: { job_id: 100001, summary: 'Replaced blower capacitor, verified cooling. System running at close-out.', notes: ['Customer reported weak airflow. Swapped capacitor, tested amp draw — within spec.'] },
    recall: { job_id: 100002, summary: 'Callback — customer says water around the indoor unit.', notes: ['Found clogged condensate drain; pan overflowing.'] },
  },
};

async function buildContext(supabase: ReturnType<typeof getServerSupabase>, investigationId: string) {
  const { data: inv } = await supabase.from('sd_recall_investigations').select('st_recall_job_id').eq('id', investigationId).maybeSingle();
  const jobId = inv?.st_recall_job_id;
  if (!jobId) return null;

  const { data: recall } = await supabase
    .from('sd_recalls_caused')
    .select('st_original_job_id, customer_name, days_to_recall, equipment_id')
    .eq('st_recall_job_id', jobId).maybeSingle();

  let equipment: string | null = null;
  if (recall?.equipment_id != null) {
    const { data: e } = await supabase.from('sd_equipment').select('manufacturer, model, type').eq('st_equipment_id', recall.equipment_id).maybeSingle();
    if (e) equipment = [e.manufacturer, e.model, e.type].filter(Boolean).join(' ') || null;
  }

  const context: Record<string, unknown> = {
    customer_name: recall?.customer_name ?? null,
    days_to_recall: recall?.days_to_recall ?? null,
    equipment,
    original: null,
    recall: { job_id: jobId, summary: null, notes: [] as { text: string; createdOn?: string }[] },
  };

  // Live ST job summaries + notes (best-effort).
  try {
    const st = getServiceTitanClient();
    const origId: number | null = recall?.st_original_job_id ?? null;
    const [recallJob, recallNotes, origJob, origNotes] = await Promise.all([
      st.getJobById(jobId),
      st.getJobNotes(jobId),
      origId ? st.getJobById(origId) : Promise.resolve(null),
      origId ? st.getJobNotes(origId) : Promise.resolve([] as { text: string; createdOn?: string }[]),
    ]);
    const clean = (notes: { text: string; createdOn?: string }[]) =>
      notes.map(n => ({ ...n, text: stripHtml(n.text) })).filter(n => n.text);
    context.recall = { job_id: jobId, summary: stripHtml(recallJob?.summaryOfWork || recallJob?.summary) || null, notes: clean(recallNotes) };
    context.original = origId ? { job_id: origId, summary: stripHtml(origJob?.summaryOfWork || origJob?.summary) || null, notes: clean(origNotes) } : null;
  } catch { /* leave minimal context */ }

  return context;
}

// GET /api/public/answer?token=... → question + job context (customer, job#, summary, notes)
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (token === 'demo') return NextResponse.json(DEMO, { headers: { 'Cache-Control': 'no-store' } });

  const supabase = getServerSupabase();
  const { data: q } = await supabase
    .from('sd_research_questions')
    .select('question, status, answer, deleted_at, investigation_id')
    .eq('answer_token', token)
    .maybeSingle();

  if (!q || q.deleted_at) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });

  const context = await buildContext(supabase, q.investigation_id);
  return NextResponse.json({
    question: q.question,
    already_answered: q.status === 'answered',
    answer: q.status === 'answered' ? q.answer : null,
    context,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/public/answer  { token, answer }
export async function POST(request: NextRequest) {
  const { token, answer } = await request.json().catch(() => ({})) as { token?: string; answer?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!answer || !answer.trim()) return NextResponse.json({ error: 'Please enter an answer.' }, { status: 400 });
  if (token === 'demo') return NextResponse.json({ ok: true, demo: true }); // sandbox — nothing saved

  const supabase = getServerSupabase();
  const { data: q } = await supabase
    .from('sd_research_questions')
    .select('id, investigation_id, deleted_at')
    .eq('answer_token', token)
    .maybeSingle();
  if (!q || q.deleted_at) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('sd_research_questions')
    .update({ answer: answer.trim(), status: 'answered', answered_at: now, answered_via: 'tech_link', updated_at: now })
    .eq('id', q.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('sd_recall_activity').insert({
    investigation_id: q.investigation_id, actor: null, action: 'question_answered_by_tech',
  });

  return NextResponse.json({ ok: true });
}
