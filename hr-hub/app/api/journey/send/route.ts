import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { sendSMS, formatPhoneE164 } from '@/lib/quo';
import { issueMagicLinkToken } from '@/lib/tech-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canSend(user: SessionUser | undefined): boolean {
  // Anyone who can view/assess can text a tech their own-progress link.
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// POST /api/journey/send — text a technician their self-view magic link.
// body: { st_technician_id, ladder_id? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canSend(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const stId = Number(body?.st_technician_id);
  const ladderId = body?.ladder_id ? String(body.ladder_id) : null;
  if (!stId) return NextResponse.json({ error: 'Missing st_technician_id' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: tech } = await supabase
    .from('ap_technicians').select('st_technician_id, name, is_active').eq('st_technician_id', stId).maybeSingle();
  if (!tech || !tech.is_active) return NextResponse.json({ error: 'Technician not found' }, { status: 404 });

  const st = getServiceTitanClient();
  if (!st.configured) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 503 });

  let phone: string | null = null;
  try { phone = await st.getTechnicianPhone(stId); }
  catch (e: any) { return NextResponse.json({ error: 'ServiceTitan lookup failed: ' + (e?.message || 'error') }, { status: 502 }); }
  const e164 = phone ? formatPhoneE164(phone) : null;
  if (!e164) return NextResponse.json({ error: 'No valid mobile number on file for this technician in ServiceTitan.' }, { status: 400 });

  const token = await issueMagicLinkToken(stId);
  const origin = process.env.NEXTAUTH_URL || 'https://hr.christmasair.com';
  const link = `${origin.replace(/\/$/, '')}/journey/${token}`;
  const firstName = (tech.name || '').split(' ')[0] || 'there';
  const msg = `Hi ${firstName}, here's your Christmas Air career ladder — see where you are and what's next: ${link}`;

  const sent = await sendSMS(e164, msg);
  const last4 = e164.slice(-4);
  await supabase.from('hr_journey_links').insert({
    st_technician_id: stId, ladder_id: ladderId, sent_by: user.id ?? null,
    phone_last4: last4, channel: 'sms', message_id: sent.messageId ?? null, ok: sent.success, error: sent.success ? null : (sent.error ?? null),
  });

  if (!sent.success) return NextResponse.json({ error: sent.error || 'Failed to send SMS' }, { status: 502 });
  return NextResponse.json({ ok: true, phone_last4: last4, link });
}
