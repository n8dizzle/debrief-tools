import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasRecallPermission } from '@/lib/qc-recalls';
import type { SupabaseClient } from '@supabase/supabase-js';

type Ctx = { params: Promise<{ jobId: string }> };

// Ensure an investigation row exists for this job (auto-opens on first question).
async function getOrCreateInvestigation(supabase: SupabaseClient, jobId: number, actor: string | null): Promise<string> {
  const { data: existing } = await supabase.from('sd_recall_investigations').select('id').eq('st_recall_job_id', jobId).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from('sd_recall_investigations')
    .insert({ st_recall_job_id: jobId, status: 'investigating', opened_by: actor })
    .select('id').single();
  await supabase.from('sd_recall_activity').insert({ investigation_id: created!.id, actor, action: 'opened' });
  return created!.id;
}

// POST — add a research question { question, assigned_to? }
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (Number.isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

  const { question, assigned_to } = await request.json().catch(() => ({})) as { question?: string; assigned_to?: string };
  if (!question || !question.trim()) return NextResponse.json({ error: 'Question text required' }, { status: 400 });

  const actor = (session.user as { id?: string }).id ?? null;
  const supabase = getServerSupabase();
  const investigationId = await getOrCreateInvestigation(supabase, jobId, actor);

  const { data: q, error } = await supabase
    .from('sd_research_questions')
    .insert({ investigation_id: investigationId, question: question.trim(), assigned_to: assigned_to ?? null, status: 'open' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('sd_recall_activity').insert({ investigation_id: investigationId, actor, action: 'question_added', detail: { question: question.trim() } });
  return NextResponse.json({ question: q });
}

// PATCH — answer or edit a question { id, answer?, question?, status? }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await params; // jobId not needed (question id is unique) but await to satisfy the signature

  const { id, answer, question, status } = await request.json().catch(() => ({})) as { id?: string; answer?: string; question?: string; status?: string };
  if (!id) return NextResponse.json({ error: 'Question id required' }, { status: 400 });

  const actor = (session.user as { id?: string }).id ?? null;
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = { updated_at: now };
  let action = 'question_edited';
  if (answer !== undefined) { patch.answer = answer; patch.status = 'answered'; patch.answered_by = actor; patch.answered_at = now; action = 'question_answered'; }
  if (question !== undefined) patch.question = question;
  if (status === 'open') { patch.status = 'open'; patch.answered_by = null; patch.answered_at = null; action = 'question_reopened'; }

  const { data: q, error } = await supabase.from('sd_research_questions').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('sd_recall_activity').insert({ investigation_id: q.investigation_id, actor, action });
  return NextResponse.json({ question: q });
}

// DELETE — soft-delete a question { id }
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await params;

  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Question id required' }, { status: 400 });

  const actor = (session.user as { id?: string }).id ?? null;
  const supabase = getServerSupabase();
  const { data: q, error } = await supabase.from('sd_research_questions').update({ deleted_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('sd_recall_activity').insert({ investigation_id: q.investigation_id, actor, action: 'question_deleted' });
  return NextResponse.json({ ok: true });
}
