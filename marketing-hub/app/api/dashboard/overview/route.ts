import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_BUSINESS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google API credentials not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// Parse a cell value like "$788,937" or "51%" or "4.98" into a number
function parseCell(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Month abbreviations to column index (C=Jan, D=Feb, ... N=Dec)
const MONTH_COL: Record<number, number> = {
  1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7,
  7: 8, 8: 9, 9: 10, 10: 11, 11: 12, 12: 13,
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'ytd'; // ytd, or month number (1-12)

  try {
    const auth = getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    // Read the Monthly #s sheet - rows 1-80 cover all sections
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Monthly #s'!A1:N80",
    });

    const rows = res.data.values || [];

    // Determine which column to read based on period
    // Column B (index 1) = YTD, Column C (index 2) = Jan, etc.
    let colIdx = 1; // default YTD
    if (period !== 'ytd') {
      const monthNum = parseInt(period, 10);
      if (monthNum >= 1 && monthNum <= 12) {
        colIdx = MONTH_COL[monthNum];
      }
    }

    // Build a lookup: row label -> value
    const getValue = (label: string): number => {
      const row = rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());
      if (!row) return 0;
      return parseCell(row[colIdx]);
    };

    // Build sections from the sheet data
    const data = {
      period: period === 'ytd' ? 'YTD' : `Month ${period}`,
      revenueGoal: getValue('Revenue Goal'),

      // Christmas Totals
      totals: {
        totalRevenue: getValue('Total Revenue'),
        totalSales: getValue('Total Sales'),
        avgTicket: getValue('AVG Ticket'),
        totalJobsRan: getValue('Total Jobs Ran'),
      },

      // Memberships
      memberships: {
        totalMembers: getValue('Total Members'),
        sold: getValue('Memberships Sold'),
        renewed: getValue('Renewed'),
        expired: getValue('Expired'),
        cancelled: getValue('Cancelled'),
        activeAtEnd: getValue('Active at End'),
      },

      // Growth
      growth: {
        totalLeads: getValue('Total Leads'),
        newNamesInST: getValue('# of New Names in ST'),
        totalNewCustomers: getValue('Total New Customers'),
        leadsToCustomerPercent: getValue('% of Names -> customers'),
        newCustomerRevenue: getValue('New Customer Revenue'),
        revenuePercentOfTotal: getValue('% of total revenue'),
        avgRevenuePerNewCustomer: getValue('Avg Revenue Per New Customer'),
        revenuePerLead: getValue('Revenue Per Lead'),
      },

      // Reviews
      reviews: {
        count: getValue('# of Reviews'),
        jobsWithReviewPercent: getValue('% of jobs with review'),
        grossRating: getValue('Gross Rating'),
        avgRating: getValue('AVG Rating'),
      },

      // Calls
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

      // Monthly breakdown for trend display
      monthly: period === 'ytd' ? buildMonthlyBreakdown(rows) : undefined,
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

function buildMonthlyBreakdown(rows: string[][]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getRow = (label: string) => rows.find(r => r[0]?.trim().toLowerCase() === label.toLowerCase());

  return months.map((month, i) => {
    const colIdx = i + 2; // Column C = index 2 = Jan
    const revRow = getRow('Total Revenue');
    const salesRow = getRow('Total Sales');
    const leadsRow = getRow('Total Leads');
    const reviewsRow = getRow('# of Reviews');
    const newCustRow = getRow('Total New Customers');

    return {
      month,
      revenue: parseCell(revRow?.[colIdx]),
      sales: parseCell(salesRow?.[colIdx]),
      leads: parseCell(leadsRow?.[colIdx]),
      reviews: parseCell(reviewsRow?.[colIdx]),
      newCustomers: parseCell(newCustRow?.[colIdx]),
    };
  });
}
