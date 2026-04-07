import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isValidCronRequest } from '@/lib/ap-utils';
import { sendDailyApprovalReminders } from '@/lib/sms-notifications';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role || 'employee';
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const result = await sendDailyApprovalReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily reminder failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Support both GET and POST for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
