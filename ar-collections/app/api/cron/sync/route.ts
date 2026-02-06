import { NextRequest, NextResponse } from 'next/server';
import { runARSync } from '@/lib/ar-sync';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runARSync();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cron sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Vercel cron jobs call GET by default
export { GET as POST };
