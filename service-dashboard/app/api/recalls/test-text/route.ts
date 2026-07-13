import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasRecallPermission } from '@/lib/qc-recalls';
import { sendSMS, formatPhoneE164 } from '@/lib/quo';

// POST /api/recalls/test-text  { phone }
// Sends the logged-in supervisor a real SMS with the DEMO answer link (/q/demo), so they
// can walk the exact technician experience end-to-end — receiving the text, tapping the
// link, and answering — without touching any real record (the demo page saves nothing).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Sends a real SMS to a caller-supplied number — gate at the same level as texting a tech.
  if (!hasRecallPermission(session, 'investigate')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { phone } = await request.json().catch(() => ({})) as { phone?: string };
  if (!phone) return NextResponse.json({ error: 'Enter a mobile number.' }, { status: 400 });

  const formatted = formatPhoneE164(phone);
  if (!formatted) return NextResponse.json({ error: 'That doesn’t look like a valid US mobile number.' }, { status: 400 });

  const link = `${new URL(request.url).origin}/q/demo`;
  const message = `Christmas Air — test of the recall question flow. This is what a technician sees; nothing you enter is saved: ${link}`;

  const result = await sendSMS(formatted, message);
  if (!result.success) {
    return NextResponse.json({ sent: false, error: result.error || 'Text failed. Try again in a moment.' }, { status: 502 });
  }

  const masked = formatted.replace(/\d(?=\d{2})/g, '•');
  return NextResponse.json({ sent: true, to: masked });
}
