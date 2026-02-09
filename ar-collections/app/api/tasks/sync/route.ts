import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runFullTaskSync } from '@/lib/task-sync';

/**
 * POST /api/tasks/sync
 * Manual sync endpoint - requires user authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Manual task sync triggered by ${session.user.email}`);

    const result = await runFullTaskSync();

    console.log(`Task sync complete: pushed=${result.pushed}, pulled=${result.pulled}, updated=${result.updated}, errors=${result.errors.length}`);

    return NextResponse.json({
      success: result.success,
      pushed: result.pushed,
      pulled: result.pulled,
      updated: result.updated,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Manual task sync error:', error);
    return NextResponse.json({
      error: 'Task sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
