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

// Iterate day-by-day and find matching sheet column headers (format: "Jul-1", "Jul-2", etc.)
function getDateRangeColumns(headers: string[], startDate: Date, endDate: Date): number[] {
  const indices: number[] = [];
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (d <= end) {
    const label = `${MONTH_ABBREVS[d.getMonth()]}-${d.getDate()}`;
    for (let i = 2; i < headers.length; i++) {
      if (headers[i] === label) {
        indices.push(i);
        break;
      }
    }
    d.setDate(d.getDate() + 1);
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
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

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/dashboard/scorecard?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 });
  }

  const now = new Date();
  const todayStr = localDateStr(now);
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const startY = startDate.getFullYear();
  const startM = startDate.getMonth() + 1;
  const startD = startDate.getDate();
  const endY = endDate.getFullYear();
  const endM = endDate.getMonth() + 1;

  // Months overlapping the date range in the current year (up to current month)
  const targetMonths: number[] = [];
  if (startY <= currentYear && endY >= currentYear) {
    const mStart = startY === currentYear ? startM : 1;
    const mEnd = endY === currentYear ? endM : 12;
    for (let m = mStart; m <= mEnd; m++) {
      if (m <= currentMonth) targetMonths.push(m);
    }
  }

  // Detect known period types for pacing
  const isMTD =
    startY === currentYear && startM === currentMonth && startD === 1 && end === todayStr;
  const isYTD =
    startY === currentYear && startM === 1 && startD === 1 && end === todayStr;

  let daysElapsed: number | null = null;
  let daysInPeriodVal: number | null = null;

  if (isMTD) {
    daysElapsed = now.getDate();
    daysInPeriodVal = daysInMonth(currentYear, currentMonth);
  } else if (isYTD) {
    daysElapsed = dayOfYear(now);
    daysInPeriodVal = daysInYear(currentYear);
  }

  // Period label
  let periodLabel: string;
  if (isYTD) {
    periodLabel = 'YTD';
  } else if (isMTD) {
    periodLabel = `${MONTH_ABBREVS[currentMonth - 1]} ${currentYear}`;
  } else {
    const fmtDate = (s: string) => {
      const d = new Date(s + 'T00:00:00');
      return `${MONTH_ABBREVS[d.getMonth()]} ${d.getDate()}`;
    };
    periodLabel = `${fmtDate(start)} – ${fmtDate(end)}`;
  }

  try {
    // 1. Sheet actuals
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });
    const rows = (res.data.values || []) as string[][];
    const headers = rows[0] || [];

    let getVal: (label: string) => number;

    if (isYTD) {
      // Use pre-aggregated YTD column (index 1 = column B)
      getVal = (label) => {
        const row = findRow(rows, label);
        return row ? parseCell(row[1]) : 0;
      };
    } else {
      const cols = getDateRangeColumns(headers, startDate, endDate);
      getVal = (label) => {
        const row = findRow(rows, label);
        return sumColumns(row, cols);
      };
    }

    const revenue = getVal('Total Revenue');
    const leads = getVal('Total Leads');
    const hvacReplacementLeads = getVal('Total Marketed Leads');
    const newCustomerRevenue = getVal('New Customer Revenue');
    const reviews = getVal('# of Reviews');

    // 2. LSA spend from Supabase
    const { data: spendRows } = await supabase
      .from('lsa_daily_performance')
      .select('cost_micros')
      .gte('date', start)
      .lte('date', end);

    const spend = spendRows
      ? spendRows.reduce((sum, r) => sum + (r.cost_micros || 0), 0) / 1_000_000
      : 0;

    // 3. Targets from marketing_monthly_targets
    let targets: Record<string, number> = {};
    if (targetMonths.length > 0) {
      const { data: targetRows } = await supabase
        .from('marketing_monthly_targets')
        .select('kpi, target')
        .eq('year', currentYear)
        .in('month', targetMonths);

      if (targetRows) {
        for (const row of targetRows) {
          targets[row.kpi] = (targets[row.kpi] || 0) + Number(row.target);
        }
      }
    }

    const t = (kpi: string): number | null =>
      targets[kpi] !== undefined ? targets[kpi] : null;

    // 4. Compute pacing
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
