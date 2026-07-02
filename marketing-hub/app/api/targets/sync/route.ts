import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SPREADSHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';
const TARGETS_SHEET = 'Targets';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

function getSheetsAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

function parseCell(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * POST /api/targets/sync
 * Reads the Targets tab from the Google Sheet and upserts all monthly targets
 * into marketing_monthly_targets. Called by Vercel cron daily at 6am CT.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { role } = session.user as { role?: string };
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  console.log('[Targets Sync] Starting at', new Date().toISOString());

  try {
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${TARGETS_SHEET}'`,
    });

    const rows = (res.data.values || []) as string[][];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data in Targets tab' }, { status: 500 });
    }

    // Find the header row — look for a row with month names
    let headerRowIdx = -1;
    let monthColMap: Record<number, number> = {}; // month 1-12 → column index

    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      const monthMatches: Record<number, number> = {};
      for (let j = 0; j < row.length; j++) {
        const cell = (row[j] || '').trim();
        // Match "January", "Jan", "Jul", "Jul-26", etc.
        const matchIdx = MONTH_NAMES.findIndex(m =>
          cell.toLowerCase().startsWith(m.toLowerCase()) ||
          cell.toLowerCase() === m.toLowerCase()
        );
        if (matchIdx >= 0) {
          monthMatches[matchIdx + 1] = j;
        }
      }
      if (Object.keys(monthMatches).length >= 6) {
        headerRowIdx = i;
        monthColMap = monthMatches;
        break;
      }
    }

    if (headerRowIdx === -1) {
      console.error('[Targets Sync] Could not find month header row in Targets tab');
      return NextResponse.json({ error: 'Could not find month headers in Targets tab' }, { status: 500 });
    }

    // KPIs to extract and which row label to search for
    const KPI_LABELS: Array<{ kpi: string; label: string }> = [
      { kpi: 'revenue',                label: 'TOTAL' },
      { kpi: 'leads',                  label: 'TOTAL LEADS' },
      { kpi: 'hvac_replacement_leads', label: 'Total Marketed Leads' },
      { kpi: 'new_customer_revenue',   label: 'New Customer Revenue' },
      { kpi: 'reviews',                label: 'Monthly' },
    ];

    const year = new Date().getFullYear();
    const upsertRows: Array<{ year: number; month: number; kpi: string; target: number }> = [];

    for (const { kpi, label } of KPI_LABELS) {
      const dataRow = rows.find((r, idx) =>
        idx > headerRowIdx &&
        r[0]?.trim().toLowerCase() === label.toLowerCase()
      );
      if (!dataRow) {
        console.warn(`[Targets Sync] Row not found for kpi=${kpi} label="${label}"`);
        continue;
      }

      for (const [monthStr, colIdx] of Object.entries(monthColMap)) {
        const month = parseInt(monthStr);
        const val = parseCell(dataRow[colIdx]);
        if (val > 0) {
          upsertRows.push({ year, month, kpi, target: val });
        }
      }
    }

    // spend_budget = 5% of revenue target per month
    const revenueRows = upsertRows.filter(r => r.kpi === 'revenue');
    for (const revRow of revenueRows) {
      upsertRows.push({
        year: revRow.year,
        month: revRow.month,
        kpi: 'spend_budget',
        target: Math.round(revRow.target * 0.05),
      });
    }

    if (upsertRows.length === 0) {
      return NextResponse.json({ message: 'No target data found to sync', synced: 0 });
    }

    const { error } = await supabase
      .from('marketing_monthly_targets')
      .upsert(upsertRows, { onConflict: 'year,month,kpi' });

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    console.log('[Targets Sync] Synced', upsertRows.length, 'rows');
    return NextResponse.json({ message: 'Targets synced', synced: upsertRows.length });
  } catch (err) {
    console.error('[Targets Sync] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
