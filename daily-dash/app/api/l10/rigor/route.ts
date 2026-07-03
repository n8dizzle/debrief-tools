import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// ============================================
// Rigor tab (L10)
//
// Measures whether the internal tools we build are actually being USED for
// their improvement purpose — not just whether records exist. For each app we
// track a single "a human took the improvement action" signal (a table +
// timestamp column that only a person writes to, never the cron sync) and
// report freshness: last action, count this week, count in the last 30 days.
//
// To add an app to the tab, add one entry to RIGOR_APPS below. Nothing else.
// ============================================

interface RigorApp {
  key: string;
  name: string;
  purpose: string; // what the tool exists to improve
  url: string | null;
  actionLabel: string; // plural noun for the counted action, e.g. "debriefs"
  table: string;
  timestampColumn: string;
  // Optional: a column that must be non-null for the row to count as a human
  // action (defends against any system-written rows sneaking in).
  requireColumn?: string;
}

const RIGOR_APPS: RigorApp[] = [
  {
    key: 'debrief_qa',
    name: "That's a Wrap",
    purpose: 'Dispatchers debrief completed jobs so techs improve',
    url: 'https://debrief.christmasair.com',
    actionLabel: 'debriefs completed',
    table: 'debrief_sessions',
    timestampColumn: 'completed_at',
  },
  {
    key: 'ap_payments',
    name: 'AP Payments',
    purpose: 'Assigning & paying install jobs',
    url: 'https://ap.christmasair.com',
    actionLabel: 'actions logged',
    table: 'ap_activity_log',
    timestampColumn: 'created_at',
    requireColumn: 'performed_by',
  },
  {
    key: 'service_recalls',
    name: 'Service Recalls (RCA)',
    purpose: 'Root-cause analysis on service recalls',
    url: 'https://service.christmasair.com',
    actionLabel: 'recall actions',
    table: 'sd_recall_activity',
    timestampColumn: 'created_at',
    // Only count office RCA work (a portal user). Excludes actor-null rows like
    // a tech's photo upload via the phone link, which isn't the office's analysis.
    requireColumn: 'actor',
  },
];

type RigorStatus = 'active' | 'slipping' | 'dormant' | 'unknown';

interface RigorResult {
  key: string;
  name: string;
  purpose: string;
  url: string | null;
  actionLabel: string;
  lastAction: string | null;
  count7d: number;
  count30d: number;
  status: RigorStatus;
}

async function measure(app: RigorApp): Promise<RigorResult> {
  const supabase = getServerSupabase();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const base = () => {
    let q = supabase.from(app.table).select('*', { count: 'exact', head: true });
    if (app.requireColumn) q = q.not(app.requireColumn, 'is', null);
    return q;
  };

  try {
    const [week, month, last] = await Promise.all([
      base().gte(app.timestampColumn, sevenDaysAgo),
      base().gte(app.timestampColumn, thirtyDaysAgo),
      (() => {
        let q = supabase
          .from(app.table)
          .select(app.timestampColumn)
          .not(app.timestampColumn, 'is', null)
          .order(app.timestampColumn, { ascending: false })
          .limit(1);
        if (app.requireColumn) q = q.not(app.requireColumn, 'is', null);
        return q;
      })(),
    ]);

    if (week.error || month.error || last.error) {
      console.error(`Rigor query error for ${app.key}:`, week.error || month.error || last.error);
      return {
        key: app.key,
        name: app.name,
        purpose: app.purpose,
        url: app.url,
        actionLabel: app.actionLabel,
        lastAction: null,
        count7d: 0,
        count30d: 0,
        status: 'unknown',
      };
    }

    const count7d = week.count ?? 0;
    const count30d = month.count ?? 0;
    const lastRow = (last.data?.[0] ?? null) as unknown as Record<string, string> | null;
    const lastAction = lastRow ? lastRow[app.timestampColumn] ?? null : null;

    // Weekly-focus, freshness-only status.
    const status: RigorStatus = count7d > 0 ? 'active' : count30d > 0 ? 'slipping' : 'dormant';

    return {
      key: app.key,
      name: app.name,
      purpose: app.purpose,
      url: app.url,
      actionLabel: app.actionLabel,
      lastAction,
      count7d,
      count30d,
      status,
    };
  } catch (err) {
    console.error(`Rigor measure failed for ${app.key}:`, err);
    return {
      key: app.key,
      name: app.name,
      purpose: app.purpose,
      url: app.url,
      actionLabel: app.actionLabel,
      lastAction: null,
      count7d: 0,
      count30d: 0,
      status: 'unknown',
    };
  }
}

// GET /api/l10/rigor
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apps = await Promise.all(RIGOR_APPS.map(measure));

    return NextResponse.json({ apps });
  } catch (error) {
    console.error('Error in rigor GET:', error);
    return NextResponse.json({ error: 'Failed to fetch rigor' }, { status: 500 });
  }
}
