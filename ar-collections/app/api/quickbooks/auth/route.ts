import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QuickBooksClient, isQuickBooksConfigured } from '@/lib/quickbooks';

/**
 * GET /api/quickbooks/auth
 * Returns the OAuth authorization URL to initiate QuickBooks connection
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if QuickBooks is configured
    if (!isQuickBooksConfigured()) {
      return NextResponse.json(
        { error: 'QuickBooks is not configured. Please set environment variables.' },
        { status: 500 }
      );
    }

    // Generate authorization URL with state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId: session.user.id,
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = QuickBooksClient.getAuthUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[QuickBooks Auth] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
