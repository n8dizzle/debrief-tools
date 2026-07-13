import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasRecallPermission } from '@/lib/qc-recalls';
import { sendSMS, formatPhoneE164 } from '@/lib/quo';

type Ctx = { params: Promise<{ jobId: string }> };

// POST /api/recalls/[jobId]/photo-link  { phone }
// Texts the supervisor a magic link to upload photos from their phone for this recall.
// The link (/upload/<token>) is public + token-gated and can be used repeatedly.
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId: jobIdStr } = await params;
  const jobId = parseInt(jobIdStr, 10);
  if (Number.isNaN(jobId)) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });

  const { phone } = await request.json().catch(() => ({})) as { phone?: string };
  const formatted = phone ? formatPhoneE164(phone) : null;
  if (!formatted) return NextResponse.json({ error: 'Enter a valid US mobile number.' }, { status: 400 });

  const supabase = getServerSupabase();
  const actor = (session.user as { id?: string }).id ?? null;

  // Ensure an investigation exists (photos attach to it), then mint the token if absent.
  let { data: inv } = await supabase.from('sd_recall_investigations').select('id, photo_upload_token').eq('st_recall_job_id', jobId).maybeSingle();
  if (!inv) {
    const { data: created, error } = await supabase
      .from('sd_recall_investigations')
      .insert({ st_recall_job_id: jobId, status: 'investigating', opened_by: actor })
      .select('id, photo_upload_token').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inv = created;
  }

  let token = inv.photo_upload_token as string | null;
  if (!token) {
    token = randomBytes(24).toString('hex');
    const { error } = await supabase.from('sd_recall_investigations').update({ photo_upload_token: token }).eq('id', inv.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const link = `${new URL(request.url).origin}/upload/${token}`;
  const message = `Christmas Air — upload photos for recall job #${jobId} here: ${link}`;
  const result = await sendSMS(formatted, message);
  if (!result.success) {
    return NextResponse.json({ sent: false, link, error: result.error || 'Text failed — copy the link and open it on your phone.' });
  }

  await supabase.from('sd_recall_activity').insert({ investigation_id: inv.id, actor, action: 'photo_upload_link_sent' });
  const masked = formatted.replace(/\d(?=\d{2})/g, '•');
  return NextResponse.json({ sent: true, to: masked });
}
