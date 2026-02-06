import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Manual sync endpoint - proxies to cron endpoints with proper auth.
 * Requires user authentication instead of cron secret.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;

  // Map type to cron endpoint
  const endpoints: Record<string, string> = {
    'auto-create': '/api/cron/auto-create',
    'sync-status': '/api/cron/sync-status',
  };

  const endpoint = endpoints[type];
  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });
  }

  // Get the base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (request.headers.get('x-forwarded-proto') || 'https') + '://' + request.headers.get('host');

  try {
    // Call the cron endpoint with the cron secret
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Manual sync error (${type}):`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
