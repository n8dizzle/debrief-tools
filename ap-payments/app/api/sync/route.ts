import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * Manual sync trigger - proxies to the cron sync route.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_sync_data')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Forward to the cron sync route
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3005';
  const cronSecret = process.env.CRON_SECRET;

  const response = await fetch(`${baseUrl}/api/cron/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
