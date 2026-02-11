import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getQuickBooksClient } from '@/lib/quickbooks';

/**
 * POST /api/quickbooks/disconnect
 * Disconnects from QuickBooks by deleting stored credentials
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - only owners can disconnect
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await getQuickBooksClient();

    if (!client.isConnected()) {
      return NextResponse.json({ message: 'Not connected to QuickBooks' });
    }

    await client.disconnect();

    console.log('[QuickBooks] Disconnected by user:', session.user.email);

    return NextResponse.json({
      success: true,
      message: 'Successfully disconnected from QuickBooks',
    });
  } catch (error) {
    console.error('[QuickBooks Disconnect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
