import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasRecallPermission } from '@/lib/qc-recalls';
import { sendSMS } from '@/lib/quo';

type Ctx = { params: Promise<{ jobId: string }> };

// POST /api/recalls/[jobId]/questions/send  { id }
// Texts the recall's original technician a magic link to answer this question, via Quo.
// Falls back (returns the link, sent:false) if the tech has no phone on file or Quo isn't
// configured — the UI still shows the copy-link path.
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId } = await params;
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Question id required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: q } = await supabase.from('sd_research_questions').select('id, question, answer_token').eq('id', id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Mint the answer token if it doesn't exist yet (same as the "ask" route).
  let token = q.answer_token as string | null;
  if (!token) {
    token = randomBytes(24).toString('hex');
    const { error } = await supabase.from('sd_research_questions').update({ answer_token: token }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const origin = new URL(request.url).origin;
  const link = `${origin}/q/${token}`;
  const message = `Christmas Air — quick question on job #${jobId}: "${q.question}" Please answer here: ${link}`;

  // Find the recall's original tech and their phone.
  const { data: recall } = await supabase.from('sd_recalls_caused').select('caused_by_tech_id').eq('st_recall_job_id', parseInt(jobId, 10)).maybeSingle();
  let phone: string | null = null;
  if (recall?.caused_by_tech_id != null) {
    try { phone = await getServiceTitanClient().getTechnicianPhone(recall.caused_by_tech_id); } catch { phone = null; }
  }
  if (!phone) {
    return NextResponse.json({ sent: false, link, message, error: 'No phone on file for that technician — copy the link and send it manually.' });
  }

  const result = await sendSMS(phone, message);
  if (!result.success) {
    return NextResponse.json({ sent: false, link, message, error: result.error || 'Text failed — copy the link and send it manually.' });
  }

  const actor = (session.user as { id?: string }).id ?? null;
  const { data: inv } = await supabase.from('sd_recall_investigations').select('id').eq('st_recall_job_id', parseInt(jobId, 10)).maybeSingle();
  if (inv) await supabase.from('sd_recall_activity').insert({ investigation_id: inv.id, actor, action: 'question_texted_to_tech' });

  const masked = phone.replace(/\d(?=\d{2})/g, '•');
  return NextResponse.json({ sent: true, to: masked });
}
