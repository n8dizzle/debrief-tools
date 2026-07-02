import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPEPermission } from '@/lib/pe-utils';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://orders.christmasair.com';
  const res = await fetch(`${baseUrl}/api/cron/sync-estimates`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, ...data });
}
