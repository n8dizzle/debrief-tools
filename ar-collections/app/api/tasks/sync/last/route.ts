import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/tasks/sync/last
 * Returns the last successful task sync date
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Get the most recent completed sync (regardless of success/failure)
    const { data: lastSync, error } = await supabase
      .from('ar_task_sync_log')
      .select('completed_at, status, started_at')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // If no completed syncs, try to get the most recent started sync
    if (!lastSync && !error) {
      const { data: lastStarted } = await supabase
        .from('ar_task_sync_log')
        .select('started_at, status')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        last_sync_at: lastStarted?.started_at || null,
        status: lastStarted?.status || null,
      });
    }

    return NextResponse.json({
      last_sync_at: lastSync?.completed_at || null,
      status: lastSync?.status || null,
    });
  } catch (error) {
    console.error('Last task sync API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
