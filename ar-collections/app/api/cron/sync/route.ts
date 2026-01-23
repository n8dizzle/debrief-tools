import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to sync endpoint
  const syncResponse = await fetch(new URL('/api/sync', request.url), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await syncResponse.json();
  return NextResponse.json(data, { status: syncResponse.status });
}

// Vercel cron jobs call GET by default
export { GET as POST };
