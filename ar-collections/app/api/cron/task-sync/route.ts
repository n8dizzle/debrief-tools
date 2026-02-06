import { NextRequest, NextResponse } from 'next/server';
import { runFullTaskSync } from '@/lib/task-sync';

/**
 * POST /api/cron/task-sync
 * Cron job to sync tasks bidirectionally with ServiceTitan
 * Runs every 2 hours during business hours (8am-6pm Mon-Fri CT)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (skip in development for local testing)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isDev = process.env.NODE_ENV === 'development';

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting task sync cron job...');

    const result = await runFullTaskSync();

    console.log(`Task sync complete: pushed=${result.pushed}, pulled=${result.pulled}, updated=${result.updated}, errors=${result.errors.length}`);

    return NextResponse.json({
      success: result.success,
      pushed: result.pushed,
      pulled: result.pulled,
      updated: result.updated,
      errors: result.errors.slice(0, 10), // Limit errors in response
    });
  } catch (error) {
    console.error('Task sync cron error:', error);
    return NextResponse.json({
      error: 'Task sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
