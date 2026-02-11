import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQuickBooksClient, isQuickBooksConfigured } from '@/lib/quickbooks';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/quickbooks/status
 * Returns QuickBooks connection status and last sync info
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if QuickBooks is configured in environment
    const configured = isQuickBooksConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        companyName: null,
        lastSync: null,
        tokenValid: false,
      });
    }

    // Load client and check connection
    const client = await getQuickBooksClient();
    const status = client.getConnectionStatus();

    // Get last sync info
    const supabase = getServerSupabase();
    const { data: lastSync } = await supabase
      .from('ar_qb_sync_log')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // Check if token is still valid
    let tokenValid = false;
    if (status.connected && status.refreshTokenExpiresAt) {
      const refreshExpires = new Date(status.refreshTokenExpiresAt);
      tokenValid = refreshExpires > new Date();
    }

    return NextResponse.json({
      configured: true,
      connected: status.connected,
      companyName: status.companyName,
      realmId: status.realmId,
      tokenExpiresAt: status.tokenExpiresAt,
      refreshTokenExpiresAt: status.refreshTokenExpiresAt,
      tokenValid,
      lastSync: lastSync ? {
        completedAt: lastSync.completed_at,
        recordsFetched: lastSync.records_fetched,
        matchesFound: lastSync.matches_found,
        status: lastSync.status,
      } : null,
    });
  } catch (error) {
    console.error('[QuickBooks Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
