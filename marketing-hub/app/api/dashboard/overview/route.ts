import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';
const SHEET_NAME = 'Daily #s';

function getSheetsAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Parse "$788,937" or "51%" or "4.98" into a number
function parseCell(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Build month abbreviation map: "Jan" -> 1, "Feb" -> 2, etc.
const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Find column indices for a given month from the header row
// Headers are like "Jan-1", "Jan-2", ..., "Feb-1", etc.
function getMonthColumns(headers: string[], monthNum: number): number[] {
  const prefix = MONTH_ABBREVS[monthNum - 1] + '-';
  const indices: number[] = [];
  for (let i = 2; i < headers.length; i++) {
    if (headers[i]?.startsWith(prefix)) {
      indices.push(i);
    }
  }
  return indices;
}

// Find today's column index
function getTodayColumn(headers: string[]): number | null {
  const now = new Date();
  const month = MONTH_ABBREVS[now.getMonth()];
  const day = now.getDate();
  const target = `${month}-${day}`;
  for (let i = 2; i < headers.length; i++) {
    if (headers[i] === target) return i;
  }
  return null;
}

// Find this week's column indices (Mon-Sun of current week)
function getWeekColumns(headers: string[]): number[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const indices: number[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const label = `${MONTH_ABBREVS[date.getMonth()]}-${date.getDate()}`;
    for (let i = 2; i < headers.length; i++) {
      if (headers[i] === label) {
        indices.push(i);
        break;
      }
    }
  }
  return indices;
}

// Sum values across multiple columns for a given row
function sumColumns(row: string[] | undefined, indices: number[]): number {
  if (!row) return 0;
  let total = 0;
  for (const idx of indices) {
    total += parseCell(row[idx]);
  }
  return total;
}

// For percentage/average rows, take the average instead of sum
function avgColumns(row: string[] | undefined, indices: number[]): number {
  if (!row) return 0;
  let total = 0;
  let count = 0;
  for (const idx of indices) {
    const val = parseCell(row[idx]);
    if (val > 0) {
      total += val;
      count++;
    }
  }
  return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  // period: "ytd", "today", "week", or month number "1"-"12"
  const period = searchParams.get('period') || 'ytd';

  try {
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read the entire Daily #s sheet (all rows, all columns)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data in sheet' }, { status: 500 });
    }

    const headers = rows[0] || [];

    // Determine how to extract values based on period
    let getValue: (label: string) => number;
    let getAvgValue: (label: string) => number;
    let periodLabel: string;

    if (period === 'ytd') {
      // Column B (index 1) has YTD totals
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return row ? parseCell(row[1]) : 0;
      };
      getAvgValue = getValue; // YTD averages are already computed in the sheet
      periodLabel = 'YTD';
    } else if (period === 'today') {
      const todayIdx = getTodayColumn(headers);
      if (todayIdx === null) {
        return NextResponse.json({ error: 'Today\'s column not found' }, { status: 404 });
      }
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return row ? parseCell(row[todayIdx]) : 0;
      };
      getAvgValue = getValue;
      periodLabel = 'Today';
    } else if (period === 'week') {
      const weekCols = getWeekColumns(headers);
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return sumColumns(row, weekCols);
      };
      getAvgValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return avgColumns(row, weekCols);
      };
      periodLabel = 'This Week';
    } else {
      // Month number
      const monthNum = parseInt(period, 10);
      if (monthNum < 1 || monthNum > 12) {
        return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
      }
      const monthCols = getMonthColumns(headers, monthNum);
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return sumColumns(row, monthCols);
      };
      getAvgValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return avgColumns(row, monthCols);
      };
      periodLabel = MONTH_ABBREVS[monthNum - 1] + ' 2026';
    }

    const data = {
      period: periodLabel,
      revenueGoal: getValue('Revenue Goal'),

      totals: {
        totalRevenue: getValue('Total Revenue'),
        completedRevenue: getValue('Completed Revenue'),
        totalSales: getValue('Total Sales'),
        avgTicket: getAvgValue('AVG Ticket'),
        totalJobsRan: getValue('Total Jobs Ran'),
      },

      memberships: {
        totalMembers: getValue('Total Members'),
        sold: getValue('Memberships Sold'),
        renewed: getValue('Renewed'),
        expired: getValue('Expired'),
        cancelled: getValue('Cancelled'),
        activeAtEnd: getValue('Active at End'),
      },

      growth: {
        totalLeads: getValue('Total Leads'),
        newNamesInST: getValue('# of New Names in ST'),
        totalNewCustomers: getValue('Total New Customers'),
        leadsToCustomerPercent: getAvgValue('% of leads -> customers'),
        newCustomerRevenue: getValue('New Customer Revenue'),
        revenuePercentOfTotal: getAvgValue('% of total revenue'),
        avgRevenuePerNewCustomer: getAvgValue('Avg Revenue Per New Customer'),
        revenuePerLead: getAvgValue('Revenue Per Lead'),
      },

      reviews: {
        count: getValue('# of Reviews'),
        jobsWithReviewPercent: getAvgValue('% of jobs with review'),
        grossRating: getValue('Gross Rating'),
        avgRating: getAvgValue('AVG Rating'),
      },

      calls: {
        totalPhoneCalls: getValue('Total Phone Calls'),
        outboundCalls: getValue('Outbound Calls'),
        inboundPhoneCalls: getValue('Inbound Phone Calls'),
        phoneLeads: getValue('Phone Leads'),
        bookedJobsFromInbound: getValue('Booked Jobs from Inbound'),
        totalJobsBooked: getValue('Total Jobs Booked'),
        totalCancellations: getValue('Total Cancellations'),
        netBookings: getValue('Net Bookings'),
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('Dashboard overview error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
