import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { upsertSnapshotRange } from '@/lib/ar-snapshot';

// Vercel serverless function timeout. Backfill should finish in seconds now
// that the data fetch is hoisted outside the per-day loop, but give it room
// in case ar_invoices grows.
export const maxDuration = 300;

// POST /api/dashboard/snapshots/backfill?days=90
// Reconstructs the last N days of AR snapshots in a single pass (one bulk
// fetch + in-memory per-day aggregation + batched upsert).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = Math.max(1, Math.min(365, parseInt(daysParam || '90', 10)));

  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));

    const results = await upsertSnapshotRange(from, today);

    return NextResponse.json({
      success: true,
      days,
      from: results[0]?.snapshot_date,
      to: results[results.length - 1]?.snapshot_date,
      snapshots: results.map((r) => ({
        date: r.snapshot_date,
        total: r.total_outstanding,
        actionable: r.actionable_ar,
        pending: r.pending_closures,
        dso: r.true_dso_total,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Snapshot backfill error:', error);
    return NextResponse.json(
      { error: msg, stack: error instanceof Error ? error.stack : undefined },
      { status: 500 },
    );
  }
}
