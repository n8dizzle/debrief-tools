import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasRecallPermission } from '@/lib/qc-recalls';

type Ctx = { params: Promise<{ jobId: string }> };

// POST /api/recalls/[jobId]/questions/ask  { id }
// Mints a magic-link token for a research question and returns a public answer link
// + a prefilled message the manager can text/Slack to the original technician.
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId } = await params;
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: 'Question id required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: q } = await supabase.from('sd_research_questions').select('id, question, answer_token, status').eq('id', id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Reuse an existing token if one was already minted (idempotent link).
  let token = q.answer_token as string | null;
  if (!token) {
    token = randomBytes(24).toString('hex'); // 48-char unguessable token
    const { error } = await supabase.from('sd_research_questions').update({ answer_token: token }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(request.url).origin; // e.g. https://service.christmasair.com
  const link = `${origin}/q/${token}`;
  const message = `Christmas Air — quick question on job #${jobId}: "${q.question}" Please answer here: ${link}`;

  return NextResponse.json({ link, message });
}
