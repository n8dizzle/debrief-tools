import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';
const SHEET_NAME = 'Daily #s';
const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

// ---------------------------------------------------------------------------
// Sheet helpers (same pattern as overview route)
// ---------------------------------------------------------------------------

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

function getMonthColumns(headers: string[], monthNum: number): number[] {
  const prefix = MONTH_ABBREVS[monthNum - 1] + '-';
  const indices: number[] = [];
  for (let i = 2; i < headers.length; i++) {
    if (headers[i]?.startsWith(prefix)) indices.push(i);
  }
  return indices;
}

function getTodayColumn(headers: string[]): number | null {
  const now = new Date();
  const target = `${MONTH_ABBREVS[now.getMonth()]}-${now.getDate()}`;
  for (let i = 2; i < headers.length; i++) {
    if (headers[i] === target) return i;
  }
  return null;
}

function getWeekColumns(headers: string[]): number[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const indices: number[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const label = `${MONTH_ABBREVS[date.getMonth()]}-${date.getDate()}`;
    for (let i = 2; i < headers.length; i++) {
      if (headers[i] === label) { indices.push(i); break; }
    }
  }
  return indices;
}

function sumColumns(row: string[] | undefined, indices: number[]): number {
  if (!row) return 0;
  return indices.reduce((sum, idx) => sum + parseCell(row[idx]), 0);
}

function findRow(rows: string[][], label: string): string[] | undefined {
  return rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
}

// ---------------------------------------------------------------------------
// Pacing helpers
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

type BarColor = 'green' | 'gold' | 'red' | 'neutral';

function computePacing(
  actual: number,
  target: number | null,
  daysElapsed: number | null,
  daysInPeriod: number | null,
): { pct: number | null; pacingLabel: string | null; barColor: BarColor } {
  if (target === null || target === 0) {
    return { pct: null, pacingLabel: null, barColor: 'neutral' };
  }
  const pct = Math.round((actual / target) * 100);

  if (daysElapsed === null || daysInPeriod === null) {
    // Past period — no pacing label, just color based on final %
    const barColor: BarColor = pct >= 90 ? 'green' : pct >= 70 ? 'gold' : 'red';
    return { pct, pacingLabel: null, barColor };
  }

  const expectedPct = (daysElapsed / daysInPeriod) * 100;
  const delta = pct - expectedPct;

  let pacingLabel: string;
  let barColor: BarColor;

  if (delta >= 5) {
    pacingLabel = 'ahead of pace';
    barColor = 'green';
  } else if (delta >= -10) {
    pacingLabel = 'on pace';
    barColor = 'green';
  } else {
    pacingLabel = `${Math.abs(Math.round(delta))}% behind`;
    barColor = delta <= -20 ? 'red' : 'gold';
  }

  return { pct, pacingLabel, barColor };
}

// ---------------------------------------------------------------------------
// Date range helpers for Supabase (LSA spend)
// ---------------------------------------------------------------------------

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/scorecard?period=ytd|today|week|1-12
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || String(new Date().getMonth() + 1);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Determine which month(s) to fetch targets for, and pacing context
  let targetMonths: number[] = []; // months to sum targets from
  let daysElapsed: number | null = null;
  let daysInPeriodVal: number | null = null;
  let periodLabel: string;
  let lsaStartDate: string;
  let lsaEndDate: string;

  if (period === 'ytd') {
    targetMonths = Array.from({ length: currentMonth }, (_, i) => i + 1);
    const doy = dayOfYear(now);
    daysElapsed = doy;
    daysInPeriodVal = daysInYear(currentYear);
    periodLabel = 'YTD';
    lsaStartDate = `${currentYear}-01-01`;
    lsaEndDate = localDateStr(now);
  } else if (period === 'today') {
    targetMonths = []; // no daily targets
    periodLabel = 'Today';
    lsaStartDate = localDateStr(now);
    lsaEndDate = localDateStr(now);
  } else if (period === 'week') {
    targetMonths = []; // no weekly targets
    periodLabel = 'This Week';
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    lsaStartDate = localDateStr(monday);
    lsaEndDate = localDateStr(now);
  } else {
    const monthNum = parseInt(period, 10);
    if (monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }
    targetMonths = [monthNum];
    periodLabel = MONTH_ABBREVS[monthNum - 1] + ' ' + currentYear;
    lsaStartDate = `${currentYear}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = daysInMonth(currentYear, monthNum);
    const isCurrentMonth = monthNum === currentMonth;
    if (isCurrentMonth) {
      // Current month in progress — pacing applies
      daysElapsed = now.getDate();
      daysInPeriodVal = daysInMonth(currentYear, monthNum);
      lsaEndDate = localDateStr(now);
    } else if (monthNum < currentMonth) {
      // Past month — show final %, no pacing label
      lsaEndDate = `${currentYear}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
    } else {
      // Future month — no data
      return NextResponse.json({
        period: periodLabel,
        kpis: {
          revenue: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
          leads: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
          hvacReplacementLeads: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
          newCustomerRevenue: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
          spend: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
          reviews: { actual: 0, target: null, pct: null, pacingLabel: null, barColor: 'neutral' },
        },
      });
    }
  }

  try {
    // -------------------------------------------------------------------
    // 1. Sheet actuals
    // -------------------------------------------------------------------
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });
    const rows = (res.data.values || []) as string[][];
    const headers = rows[0] || [];

    let getVal: (label: string) => number;

    if (period === 'ytd') {
      getVal = (label) => {
        const row = findRow(rows, label);
        return row ? parseCell(row[1]) : 0;
      };
    } else if (period === 'today') {
      const todayIdx = getTodayColumn(headers);
      getVal = (label) => {
        if (todayIdx === null) return 0;
        const row = findRow(rows, label);
        return row ? parseCell(row[todayIdx]) : 0;
      };
    } else if (period === 'week') {
      const weekCols = getWeekColumns(headers);
      getVal = (label) => {
        const row = findRow(rows, label);
        return sumColumns(row, weekCols);
      };
    } else {
      const monthNum = parseInt(period, 10);
      const monthCols = getMonthColumns(headers, monthNum);
      getVal = (label) => {
        const row = findRow(rows, label);
        return sumColumns(row, monthCols);
      };
    }

    const revenue = getVal('Total Revenue');
    const leads = getVal('Total Leads');
    const hvacReplacementLeads = getVal('Total Marketed Leads');
    const newCustomerRevenue = getVal('New Customer Revenue');
    const reviews = getVal('# of Reviews');

    // -------------------------------------------------------------------
    // 2. LSA spend from Supabase
    // -------------------------------------------------------------------
    const { data: spendRows } = await supabase
      .from('lsa_daily_performance')
      .select('cost_micros')
      .gte('date', lsaStartDate)
      .lte('date', lsaEndDate);

    const spend = spendRows
      ? spendRows.reduce((sum, r) => sum + (r.cost_micros || 0), 0) / 1_000_000
      : 0;

    // -------------------------------------------------------------------
    // 3. Targets from marketing_monthly_targets
    // -------------------------------------------------------------------
    let targets: Record<string, number> = {};

    if (targetMonths.length > 0) {
      const { data: targetRows } = await supabase
        .from('marketing_monthly_targets')
        .select('kpi, target')
        .eq('year', currentYear)
        .in('month', targetMonths);

      if (targetRows) {
        // Sum across months (for YTD, sums Jan–current; for single month, just that month)
        for (const row of targetRows) {
          targets[row.kpi] = (targets[row.kpi] || 0) + Number(row.target);
        }
      }
    }

    const t = (kpi: string): number | null =>
      targets[kpi] !== undefined ? targets[kpi] : null;

    // -------------------------------------------------------------------
    // 4. Compute pacing for each KPI
    // -------------------------------------------------------------------
    const paceRevenue = computePacing(revenue, t('revenue'), daysElapsed, daysInPeriodVal);
    const paceLeads = computePacing(leads, t('leads'), daysElapsed, daysInPeriodVal);
    const paceHvac = computePacing(hvacReplacementLeads, t('hvac_replacement_leads'), daysElapsed, daysInPeriodVal);
    const paceNewCust = computePacing(newCustomerRevenue, t('new_customer_revenue'), daysElapsed, daysInPeriodVal);
    const paceSpend = computePacing(spend, t('spend_budget'), daysElapsed, daysInPeriodVal);
    const paceReviews = computePacing(reviews, t('reviews'), daysElapsed, daysInPeriodVal);

    return NextResponse.json({
      period: periodLabel,
      kpis: {
        revenue: { actual: revenue, target: t('revenue'), ...paceRevenue },
        leads: { actual: leads, target: t('leads'), ...paceLeads },
        hvacReplacementLeads: { actual: hvacReplacementLeads, target: t('hvac_replacement_leads'), ...paceHvac },
        newCustomerRevenue: { actual: newCustomerRevenue, target: t('new_customer_revenue'), ...paceNewCust },
        spend: { actual: Math.round(spend), target: t('spend_budget'), ...paceSpend },
        reviews: { actual: reviews, target: t('reviews'), ...paceReviews },
      },
    });
  } catch (err) {
    console.error('[Scorecard] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch scorecard data' },
      { status: 500 }
    );
  }
}
