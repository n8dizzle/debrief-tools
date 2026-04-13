import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendManualSMS } from '@/lib/sms-notifications';
import { hasAPPermission } from '@/lib/ap-utils';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { job_id, contractor_id, phone, recipient_name, message } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
  }

  const result = await sendManualSMS({
    job_id: job_id || null,
    contractor_id: contractor_id || null,
    phone,
    recipient_name: recipient_name || null,
    message,
    sent_by: session.user.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
