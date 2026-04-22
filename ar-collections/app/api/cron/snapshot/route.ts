import { NextRequest, NextResponse } from 'next/server';
import { upsertSnapshot } from '@/lib/ar-snapshot';

// Daily cron: upsert today's AR snapshot.
// Supports session auth (manual trigger) and CRON_SECRET header (Vercel cron).
async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    // Fall back to session auth for manual triggers via UI.
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const today = new Date();
    const result = await upsertSnapshot(today, { isBackfill: false });
    return NextResponse.json({
      success: true,
      snapshot_date: result.snapshot_date,
      total_outstanding: result.total_outstanding,
      actionable_ar: result.actionable_ar,
      pending_closures: result.pending_closures,
      groups: result.by_group.length,
    });
  } catch (error) {
    console.error('Snapshot cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Snapshot failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
