import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { upsertSnapshot } from '@/lib/ar-snapshot';

// POST /api/dashboard/snapshots/backfill
// Reconstruct the last N days of AR snapshots from current ar_invoices state.
// Admin only — this is a one-off or occasional re-run when something drifts.
// Runs with is_backfilled=true so the cron can later overwrite with precise
// same-day numbers.
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
    const results: { date: string; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      // Only mark as backfill when it's a past date; today's is authoritative.
      const isBackfill = i > 0;
      const r = await upsertSnapshot(d, { isBackfill });
      results.push({ date: r.snapshot_date, total: r.total_outstanding });
    }
    return NextResponse.json({ success: true, days, snapshots: results });
  } catch (error) {
    console.error('Snapshot backfill error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 },
    );
  }
}
