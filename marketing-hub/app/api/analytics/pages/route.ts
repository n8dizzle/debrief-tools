import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getGoogleAnalyticsClient } from '@/lib/google-analytics';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role as string;
    const permissions = session.user.permissions as Record<string, unknown>;

    if (!hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Parse period
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;

    const client = getGoogleAnalyticsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Analytics not configured' },
        { status: 500 }
      );
    }

    const pages = await client.getTopPages(days, limit);

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('[Analytics Pages] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch page data' },
      { status: 500 }
    );
  }
}
