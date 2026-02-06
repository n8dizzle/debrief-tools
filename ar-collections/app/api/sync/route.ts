import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runARSync } from '@/lib/ar-sync';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Allow cron or authenticated users (manager/owner)
    const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
    const isCronRequest = cronSecret === process.env.CRON_SECRET;

    if (!isCronRequest && (!session?.user || !['manager', 'owner'].includes(session.user.role))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runARSync();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
