import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission, formatLocalDate } from '@/lib/ap-utils';

/**
 * GET /api/payroll-periods — distinct ServiceTitan pay cycles (most recent first).
 * ST returns one payroll row per employee per cycle; we dedupe to {start, end} date
 * ranges so the Install Jobs tab can filter by pay period.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });

  // Look back ~6 months so the dropdown stays light.
  const since = formatLocalDate(new Date(Date.now() - 183 * 24 * 60 * 60 * 1000));
  const rows = await st.getPayrollPeriods(since);

  // ST's endedOn is ambiguous/inconsistent (sometimes exclusive = next period's start),
  // which caused overlaps and off-by-one ends. Cycles here are weekly, so derive the
  // week from the reliable start date: Monday start + 6 days = Sunday end. No overlap,
  // always a full 7-day Mon-Sun week.
  const addDays = (dateStr: string, n: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return formatLocalDate(d);
  };

  // Dedupe by start (ST returns one row per employee per cycle).
  const seen = new Map<string, { start: string; end: string }>();
  for (const r of rows) {
    if (!r.startedOn) continue;
    const start = r.startedOn.slice(0, 10);
    seen.set(start, { start, end: addDays(start, 6) });
  }

  const periods = Array.from(seen.values())
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .slice(0, 16);

  return NextResponse.json(periods);
}
