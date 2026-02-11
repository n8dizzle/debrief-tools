import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { manualMatch, markAsDiscrepancy } from '@/lib/qb-sync';

/**
 * POST /api/deposits/match
 * Manually match a payment to an invoice
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reconciliationId, invoiceId } = body;

    if (!reconciliationId || !invoiceId) {
      return NextResponse.json(
        { error: 'Missing reconciliationId or invoiceId' },
        { status: 400 }
      );
    }

    await manualMatch(reconciliationId, invoiceId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Payment matched successfully',
    });
  } catch (error) {
    console.error('[Deposits Match] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to match payment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/deposits/match
 * Mark a payment as discrepancy
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reconciliationId, action } = body;

    if (!reconciliationId) {
      return NextResponse.json(
        { error: 'Missing reconciliationId' },
        { status: 400 }
      );
    }

    if (action === 'discrepancy') {
      await markAsDiscrepancy(reconciliationId);

      return NextResponse.json({
        success: true,
        message: 'Payment marked as discrepancy',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Deposits Match] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update payment' },
      { status: 500 }
    );
  }
}
