import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runQBSync } from '@/lib/qb-sync';
import { getQuickBooksClient } from '@/lib/quickbooks';

/**
 * POST /api/cron/qb-sync
 * Automated QuickBooks sync - called by Vercel cron or manually
 *
 * Schedule: Every hour during business hours (8am-6pm CT, Mon-Fri)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - either cron secret or logged in manager/owner
    const cronSecret = request.headers.get('Authorization')?.replace('Bearer ', '');
    const isCronRequest = cronSecret === process.env.CRON_SECRET;

    if (!isCronRequest) {
      const session = await getServerSession(authOptions);
      if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Check QB connection status (sync will still run for ST payments)
    const client = await getQuickBooksClient();
    const qbConnected = client.isConnected();

    console.log(`[Deposit Cron] Starting automated sync... QB connected: ${qbConnected}`);

    const result = await runQBSync();

    console.log(`[Deposit Cron] Sync completed: ${result.stPaymentsFetched} ST payments, ${result.recordsFetched} QB payments, ${result.matchesFound} matches`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Deposit Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/qb-sync
 * Check if QB sync is configured and get last sync status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getQuickBooksClient();
    const status = client.getConnectionStatus();

    return NextResponse.json({
      configured: status.connected,
      companyName: status.companyName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check status' },
      { status: 500 }
    );
  }
}
