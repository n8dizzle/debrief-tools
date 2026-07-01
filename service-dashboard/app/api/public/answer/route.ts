import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// Public, token-gated endpoint for a technician to answer a research question via a
// magic link — no login. The 48-char token is the secret; there is no other auth.
// Exempt from the auth middleware (see middleware.ts matcher).

// GET /api/public/answer?token=... → question text + whether it's already answered
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: q } = await supabase
    .from('sd_research_questions')
    .select('question, status, answer, deleted_at')
    .eq('answer_token', token)
    .maybeSingle();

  if (!q || q.deleted_at) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });
  return NextResponse.json({
    question: q.question,
    already_answered: q.status === 'answered',
    answer: q.status === 'answered' ? q.answer : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/public/answer  { token, answer }
export async function POST(request: NextRequest) {
  const { token, answer } = await request.json().catch(() => ({})) as { token?: string; answer?: string };
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (!answer || !answer.trim()) return NextResponse.json({ error: 'Please enter an answer.' }, { status: 400 });

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
