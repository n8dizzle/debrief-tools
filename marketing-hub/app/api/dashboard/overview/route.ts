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

const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  let total = 0;
  for (const idx of indices) {
    total += parseCell(row[idx]);
  }
  return total;
}

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

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// GET /api/dashboard/overview?start=YYYY-MM-DD&end=YYYY-MM-DD
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

  // Detect YTD for pre-aggregated column usage
  const isYTD =
    startY === currentYear && startM === 1 && startD === 1 && end === todayStr;

  // Period label
  let periodLabel: string;
  if (isYTD) {
    periodLabel = 'YTD';
  } else {
    const fmtDate = (s: string) => {
      const d = new Date(s + 'T00:00:00');
      return `${MONTH_ABBREVS[d.getMonth()]} ${d.getDate()}`;
    };
    periodLabel = `${fmtDate(start)} – ${fmtDate(end)}`;
  }

  try {
    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data in sheet' }, { status: 500 });
    }

    const headers = rows[0] || [];

    let getValue: (label: string) => number;
    let getAvgValue: (label: string) => number;

    if (isYTD) {
      // Column B (index 1) has YTD totals
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return row ? parseCell(row[1]) : 0;
      };
      getAvgValue = getValue;
    } else {
      const cols = getDateRangeColumns(headers, startDate, endDate);
      getValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return sumColumns(row, cols);
      };
      getAvgValue = (label: string) => {
        const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
        return avgColumns(row, cols);
      };
    }

    const data = {
      period: periodLabel,
      revenueGoal: getValue('Revenue Goal'),

      totals: (() => {
        const totalRev = getValue('Total Revenue');
        const totalJobs = getValue('Total Jobs Ran');
        return {
          totalRevenue: totalRev,
          completedRevenue: getValue('Completed Revenue'),
          totalSales: getValue('Total Sales'),
          avgTicket: isYTD
            ? getValue('AVG Ticket')
            : (totalJobs > 0 ? Math.round(totalRev / totalJobs) : 0),
          totalJobsRan: totalJobs,
        };
      })(),

      memberships: {
        totalMembers: getValue('Total Members'),
        sold: getValue('Memberships Sold'),
        renewed: getValue('Renewed'),
        expired: getValue('Expired'),
        cancelled: getValue('Cancelled'),
        activeAtEnd: getValue('Active at End'),
      },

      growth: (() => {
        const totalLeads = getValue('Total Leads');
        const newNames = getValue('# of New Names in ST');
        const newCust = getValue('Total New Customers');
        const newCustRev = getValue('New Customer Revenue');
        const totalRev = getValue('Total Revenue');
        return {
          totalLeads,
          newNamesInST: newNames,
          totalNewCustomers: newCust,
          leadsToCustomerPercent: isYTD
            ? getValue('% of leads -> customers')
            : (newNames > 0 ? Math.round((newCust / newNames) * 100) : 0),
          newCustomerRevenue: newCustRev,
          revenuePercentOfTotal: isYTD
            ? getValue('% of total revenue')
            : (totalRev > 0 ? Math.round((newCustRev / totalRev) * 100) : 0),
          avgRevenuePerNewCustomer: isYTD
            ? getValue('Avg Revenue Per New Customer')
            : (newCust > 0 ? Math.round(newCustRev / newCust) : 0),
          revenuePerLead: isYTD
            ? getValue('Revenue Per Lead')
            : (totalLeads > 0 ? Math.round(totalRev / totalLeads) : 0),
        };
      })(),

      reviews: (() => {
        const count = getValue('# of Reviews');
        const grossRating = getValue('Gross Rating');
        const totalJobs = getValue('Total Jobs Ran');
        return {
          count,
          jobsWithReviewPercent: isYTD
            ? getValue('% of jobs with review')
            : (totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0),
          grossRating,
          avgRating: isYTD
            ? getValue('AVG Rating')
            : (count > 0 ? Math.round((grossRating / count) * 100) / 100 : 0),
        };
      })(),

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
