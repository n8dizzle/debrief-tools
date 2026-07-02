import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasRecallPermission, ROOT_CAUSE_CATEGORIES } from '@/lib/qc-recalls';
import { stripHtml } from '@/lib/text';

type Ctx = { params: Promise<{ jobId: string }> };

// GET /api/recalls/[jobId] — recall context + investigation + questions + activity (RCA page).
export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (Number.isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

  const supabase = getServerSupabase();

  const { data: recall } = await supabase.from('sd_recalls_caused').select('*').eq('st_recall_job_id', jobId).maybeSingle();

  let techName: string | null = null;
  if (recall?.caused_by_tech_id != null) {
    const { data: t } = await supabase.from('sd_technicians').select('name').eq('st_technician_id', recall.caused_by_tech_id).maybeSingle();
    techName = t?.name ?? null;
  }
  let equipment = null;
  if (recall?.equipment_id != null) {
    const { data: e } = await supabase.from('sd_equipment').select('manufacturer, model, type, installed_on, serial_number').eq('st_equipment_id', recall.equipment_id).maybeSingle();
    equipment = e ?? null;
  }

  const { data: investigation } = await supabase.from('sd_recall_investigations').select('*').eq('st_recall_job_id', jobId).maybeSingle();
  let questions: unknown[] = [];
  let activity: unknown[] = [];
  let photos: { id: string; url: string | null; uploaded_at: string }[] = [];
  if (investigation) {
    const { data: q } = await supabase.from('sd_research_questions').select('*').eq('investigation_id', investigation.id).is('deleted_at', null).order('created_at');
    questions = q || [];
    const { data: a } = await supabase.from('sd_recall_activity').select('*').eq('investigation_id', investigation.id).order('created_at', { ascending: false });
    activity = a || [];
    const { data: ph } = await supabase.from('sd_recall_photos').select('id, storage_path, uploaded_at').eq('investigation_id', investigation.id).order('uploaded_at', { ascending: false });
    if (ph?.length) {
      // Private bucket — sign each path for a 1h read window.
      const signed = await Promise.all(ph.map(async p => {
        const { data: s } = await supabase.storage.from('recall-photos').createSignedUrl(p.storage_path, 3600);
        return { id: p.id, url: s?.signedUrl ?? null, uploaded_at: p.uploaded_at };
      }));
      photos = signed;
    }
  }

  // Job summary + notes from ServiceTitan (best-effort, parallel — don't fail the page if ST is slow).
  let jobDetails: unknown = null;
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
    jobDetails = {
      recall: { summary: stripHtml(recallJob?.summaryOfWork || recallJob?.summary) || null, notes: clean(recallNotes) },
      original: origId ? { job_id: origId, summary: stripHtml(origJob?.summaryOfWork || origJob?.summary) || null, notes: clean(origNotes) } : null,
    };
  } catch { jobDetails = null; }

  return NextResponse.json({
    job_id: jobId,
    recall: recall ? { ...recall, tech_name: techName } : null,
    equipment,
    job_details: jobDetails,
    investigation: investigation || null,
    questions,
    activity,
    photos,
    root_cause_categories: ROOT_CAUSE_CATEGORIES,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/recalls/[jobId] — open or update the investigation (status, root cause, assignee).
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (Number.isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const { status, root_cause_category, root_cause_note, root_cause_details, assigned_to } = body as {
    status?: string; root_cause_category?: string; root_cause_note?: string; root_cause_details?: string; assigned_to?: string;
  };
  const actor = (session.user as { id?: string }).id ?? null;
  const supabase = getServerSupabase();

  // Resolve requires a root cause (enforced server-side, mirrors the disabled Resolve button).
  const { data: existing } = await supabase.from('sd_recall_investigations').select('*').eq('st_recall_job_id', jobId).maybeSingle();
  const targetStatus = status ?? existing?.status ?? 'open';
  const targetRootCause = root_cause_category ?? existing?.root_cause_category ?? null;
  if (targetStatus === 'resolved' && !targetRootCause) {
    return NextResponse.json({ error: 'A root cause is required to resolve.' }, { status: 400 });
  }
  if (root_cause_category && !ROOT_CAUSE_CATEGORIES.includes(root_cause_category as never)) {
    return NextResponse.json({ error: 'Invalid root cause category.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    st_recall_job_id: jobId,
    status: targetStatus,
    root_cause_category: targetRootCause,
    root_cause_note: root_cause_note ?? existing?.root_cause_note ?? null,
    root_cause_details: root_cause_details ?? existing?.root_cause_details ?? null,
    assigned_to: assigned_to ?? existing?.assigned_to ?? null,
    opened_by: existing?.opened_by ?? actor,
    resolved_by: targetStatus === 'resolved' ? actor : (targetStatus === 'investigating' ? null : existing?.resolved_by ?? null),
    resolved_at: targetStatus === 'resolved' ? now : (targetStatus === 'investigating' ? null : existing?.resolved_at ?? null),
    updated_at: now,
  };

  const { data: saved, error } = await supabase
    .from('sd_recall_investigations')
    .upsert(row, { onConflict: 'st_recall_job_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const action = !existing ? 'opened' : (existing.status !== targetStatus ? `status:${existing.status}→${targetStatus}` : 'updated');
  await supabase.from('sd_recall_activity').insert({
    investigation_id: saved.id, actor, action,
    detail: { root_cause_category: targetRootCause },
  });

  return NextResponse.json({ investigation: saved });
}
