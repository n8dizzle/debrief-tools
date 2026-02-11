import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runQBSync } from '@/lib/qb-sync';

/**
 * POST /api/quickbooks/sync
 * Manually trigger a QuickBooks sync
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[QuickBooks Sync] Manual sync triggered by:', session.user.email);

    const result = await runQBSync();

    return NextResponse.json(result);
  } catch (error) {
    console.error('[QuickBooks Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quickbooks/sync
 * Get sync history
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getServerSupabase } = await import('@/lib/supabase');
    const supabase = getServerSupabase();

    const { data: logs, error } = await supabase
      .from('ar_qb_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error('[QuickBooks Sync] Error fetching logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
