/**
 * Import weekly scorecard data from Google Sheets (2025 + 2026)
 *
 * Usage: npx tsx scripts/import-weekly-scorecard.ts
 *
 * Reads the "Weekly #s" tab from both spreadsheets and upserts into weekly_scorecard table.
 * Safe to re-run (uses upsert on year/week/trade/department unique constraint).
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SHEETS = [
  { year: 2025, id: '1aWF_yAzCkfZrC4YTmiAI16fVl0BOlZp-bmHYknbpIAg' },
  { year: 2026, id: '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw' },
];

// Row numbers (1-indexed) mapping to metric names
// 2026 layout (canonical)
const ROW_MAP_2026 = {
  // CHRISTMAS TOTALS (company)
  company_revenue: 5,
  company_completed_revenue: 6,
  company_non_job_revenue: 7,
  company_adj_revenue: 8,
  company_sales: 9,
  company_sold_estimates: 11,
  company_avg_sale: 12,
  company_avg_ticket: 13,
  company_jobs_ran: 15,

  // MEMBERSHIPS
  memberships_total: 18,
  memberships_sold: 19,
  memberships_renewed: 20,
  memberships_expired: 21,
  memberships_cancelled: 22,
  memberships_suspended: 23,
  memberships_deleted: 24,
  memberships_reactivated: 25,
  memberships_active_end: 26,

  // GROWTH
  total_leads: 29,
  new_customers: 32,
  new_customer_revenue: 34,

  // REVIEWS
  reviews_count: 40,
  reviews_pct: 41,
  reviews_avg_rating: 43,

  // CALLS
  total_calls: 46,
  outbound_calls: 47,
  inbound_calls: 49,
  phone_leads: 51,
  booked_from_inbound: 53,
  total_jobs_booked: 55,
  total_cancellations: 58,
  net_bookings: 59,

  // HVAC (aggregate)
  hvac_revenue: 63,
  hvac_sales: 65,
  hvac_avg_ticket: 66,
  hvac_jobs_ran: 67,
  hvac_warranty_jobs: 68,
  hvac_recall_jobs: 70,
  hvac_zero_dollar: 72,
  hvac_zero_dollar_pct: 73,
  hvac_tgls: 76,
  hvac_tgl_sales: 78,
  hvac_tgl_num_sales: 79,
  hvac_tgl_avg_sale: 80,

  // HVAC SALES
  hvac_lead_sales: 83,
  hvac_lead_avg_sale: 84,
  hvac_leads: 85,
  hvac_appts_ran: 89,
  hvac_close_rate: 92,
  marketed_lead_sales: 95,
  marketed_leads: 97,

  // HVAC SERVICE
  hvac_service_revenue: 120,
  hvac_service_sales: 122,
  hvac_service_avg_ticket: 123,
  hvac_service_jobs_ran: 125,
  hvac_service_tgls: 132,
  hvac_service_tgl_sales: 134,
  hvac_service_close_rate: 137,

  // HVAC MAINTENANCE
  hvac_maint_revenue: 140,
  hvac_maint_sales: 142,
  hvac_maint_avg_ticket: 143,
  hvac_maint_jobs_ran: 145,
  hvac_maint_tgls: 148,
  hvac_maint_tgl_sales: 150,
  hvac_maint_close_rate: 153,

  // HVAC INSTALL
  hvac_install_revenue: 156,
  hvac_install_avg_ticket: 159,
  hvac_install_jobs_ran: 161,
  hvac_install_warranty: 162,
  hvac_install_recall: 164,
  hvac_install_zero_dollar: 166,

  // PLUMBING
  plumbing_revenue: 173,
  plumbing_sales: 175,
  plumbing_avg_ticket: 176,
  plumbing_jobs_booked: 177,
  plumbing_jobs_ran: 178,
};

// 2025 sheet has been updated to match 2026 row layout
// (user added Total Sales rows to match). Same map for both years.
const ROW_MAP_2025 = ROW_MAP_2026;

function parseNum(val: string | undefined): number {
  if (!val) return 0;
  // Remove $, commas, %, #REF!, and trim
  const cleaned = val.replace(/[$,%#REF!]/g, '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '') return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseInt2(val: string | undefined): number {
  return Math.round(parseNum(val));
}

function readSheet(spreadsheetId: string): string[][] {
  // Read all data from Weekly #s tab
  const cmd = `gws sheets +read --spreadsheet ${spreadsheetId} --range "Weekly #s!A1:AZ200"`;
  const result = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

  // gws outputs a "Using keyring backend" line before the JSON
  const jsonStart = result.indexOf('{');
  const json = result.substring(jsonStart);
  const data = JSON.parse(json);
  return data.values || [];
}

function getWeekEnding(dateStr: string, year: number): Date {
  // dateStr is like "Jan-4", "Feb-15", etc.
  const monthMap: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = dateStr.split('-');
  const month = monthMap[parts[0]];
  const day = parseInt(parts[1]);
  if (month === undefined || isNaN(day)) return new Date(NaN);
  return new Date(year, month, day);
}

function getISOWeekNumber(date: Date): number {
  // ISO week: Mon-Sun, week 1 contains Jan 4
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function importSheet(sheetConfig: { year: number; id: string }) {
  console.log(`\nReading ${sheetConfig.year} spreadsheet...`);
  const rows = readSheet(sheetConfig.id);
  const ROW_MAP = sheetConfig.year === 2025 ? ROW_MAP_2025 : ROW_MAP_2026;

  if (rows.length === 0) {
    console.log('  No data found');
    return;
  }

  // Row 0 is the header row with week dates: ["2026", "YTD Total", "Jan-4", "Jan-11", ...]
  const headerRow = rows[0];
  // Week columns start at index 2 (skip year label + YTD Total)
  const weekColumns = headerRow.slice(2);

  console.log(`  Found ${weekColumns.length} week columns (using ${sheetConfig.year === 2025 ? '2025' : '2026'} row map)`);

  // Helper to get cell value by row number (1-indexed) and column index
  // Returns '' for row 0 (metric not available in this year's layout)
  const getVal = (rowNum: number, colIdx: number): string => {
    if (rowNum === 0) return '';
    const row = rows[rowNum - 1]; // Convert to 0-indexed
    if (!row) return '';
    return row[colIdx + 2] || ''; // +2 to skip label + YTD columns
  };

  let insertCount = 0;

  for (let colIdx = 0; colIdx < weekColumns.length; colIdx++) {
    const dateStr = weekColumns[colIdx];
    if (!dateStr) continue;

    const weekEnding = getWeekEnding(dateStr, sheetConfig.year);
    if (isNaN(weekEnding.getTime())) {
      console.log(`  Skipping invalid date: ${dateStr}`);
      continue;
    }

    // Use simple sequential week number (WK 1, WK 2, etc.) matching the spreadsheet
    const weekNum = colIdx + 1;

    // Check if this week has any data (revenue > 0)
    const companyRev = parseNum(getVal(ROW_MAP.company_revenue, colIdx));
    if (companyRev === 0) continue; // Skip empty weeks

    const weekEndStr = `${weekEnding.getFullYear()}-${String(weekEnding.getMonth() + 1).padStart(2, '0')}-${String(weekEnding.getDate()).padStart(2, '0')}`;

    // Build rows for this week
    const weekRows: any[] = [];

    // Company totals
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'company',
      department: null,
      revenue: parseNum(getVal(ROW_MAP.company_revenue, colIdx)),
      completed_revenue: parseNum(getVal(ROW_MAP.company_completed_revenue, colIdx)),
      non_job_revenue: parseNum(getVal(ROW_MAP.company_non_job_revenue, colIdx)),
      adj_revenue: parseNum(getVal(ROW_MAP.company_adj_revenue, colIdx)),
      sales: parseNum(getVal(ROW_MAP.company_sales, colIdx)),
      sold_estimates: parseInt2(getVal(ROW_MAP.company_sold_estimates, colIdx)),
      avg_sale: parseNum(getVal(ROW_MAP.company_avg_sale, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.company_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.company_jobs_ran, colIdx)),
      // Memberships
      memberships_total: parseInt2(getVal(ROW_MAP.memberships_total, colIdx)),
      memberships_sold: parseInt2(getVal(ROW_MAP.memberships_sold, colIdx)),
      memberships_renewed: parseInt2(getVal(ROW_MAP.memberships_renewed, colIdx)),
      memberships_expired: parseInt2(getVal(ROW_MAP.memberships_expired, colIdx)),
      memberships_cancelled: parseInt2(getVal(ROW_MAP.memberships_cancelled, colIdx)),
      memberships_suspended: parseInt2(getVal(ROW_MAP.memberships_suspended, colIdx)),
      memberships_deleted: parseInt2(getVal(ROW_MAP.memberships_deleted, colIdx)),
      memberships_reactivated: parseInt2(getVal(ROW_MAP.memberships_reactivated, colIdx)),
      memberships_active_end: parseInt2(getVal(ROW_MAP.memberships_active_end, colIdx)),
      // Growth
      total_leads: parseInt2(getVal(ROW_MAP.total_leads, colIdx)),
      new_customers: parseInt2(getVal(ROW_MAP.new_customers, colIdx)),
      new_customer_revenue: parseNum(getVal(ROW_MAP.new_customer_revenue, colIdx)),
      // Reviews
      reviews_count: parseInt2(getVal(ROW_MAP.reviews_count, colIdx)),
      reviews_pct: parseNum(getVal(ROW_MAP.reviews_pct, colIdx)),
      reviews_avg_rating: parseNum(getVal(ROW_MAP.reviews_avg_rating, colIdx)),
      // Calls
      total_calls: parseInt2(getVal(ROW_MAP.total_calls, colIdx)),
      outbound_calls: parseInt2(getVal(ROW_MAP.outbound_calls, colIdx)),
      inbound_calls: parseInt2(getVal(ROW_MAP.inbound_calls, colIdx)),
      phone_leads: parseInt2(getVal(ROW_MAP.phone_leads, colIdx)),
      booked_from_inbound: parseInt2(getVal(ROW_MAP.booked_from_inbound, colIdx)),
      total_jobs_booked: parseInt2(getVal(ROW_MAP.total_jobs_booked, colIdx)),
      total_cancellations: parseInt2(getVal(ROW_MAP.total_cancellations, colIdx)),
      net_bookings: parseInt2(getVal(ROW_MAP.net_bookings, colIdx)),
      data_source: 'import',
    });

    // HVAC totals
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'hvac',
      department: null,
      revenue: parseNum(getVal(ROW_MAP.hvac_revenue, colIdx)),
      sales: parseNum(getVal(ROW_MAP.hvac_sales, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.hvac_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.hvac_jobs_ran, colIdx)),
      warranty_jobs: parseInt2(getVal(ROW_MAP.hvac_warranty_jobs, colIdx)),
      recall_jobs: parseInt2(getVal(ROW_MAP.hvac_recall_jobs, colIdx)),
      zero_dollar_tickets: parseInt2(getVal(ROW_MAP.hvac_zero_dollar, colIdx)),
      zero_dollar_pct: parseNum(getVal(ROW_MAP.hvac_zero_dollar_pct, colIdx)),
      tgls: parseInt2(getVal(ROW_MAP.hvac_tgls, colIdx)),
      tgl_sales: parseNum(getVal(ROW_MAP.hvac_tgl_sales, colIdx)),
      tgl_avg_sale: parseNum(getVal(ROW_MAP.hvac_tgl_avg_sale, colIdx)),
      data_source: 'import',
    });

    // HVAC Install
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'hvac',
      department: 'install',
      revenue: parseNum(getVal(ROW_MAP.hvac_install_revenue, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.hvac_install_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.hvac_install_jobs_ran, colIdx)),
      warranty_jobs: parseInt2(getVal(ROW_MAP.hvac_install_warranty, colIdx)),
      recall_jobs: parseInt2(getVal(ROW_MAP.hvac_install_recall, colIdx)),
      zero_dollar_tickets: parseInt2(getVal(ROW_MAP.hvac_install_zero_dollar, colIdx)),
      data_source: 'import',
    });

    // HVAC Service
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'hvac',
      department: 'service',
      revenue: parseNum(getVal(ROW_MAP.hvac_service_revenue, colIdx)),
      sales: parseNum(getVal(ROW_MAP.hvac_service_sales, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.hvac_service_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.hvac_service_jobs_ran, colIdx)),
      tgls: parseInt2(getVal(ROW_MAP.hvac_service_tgls, colIdx)),
      tgl_sales: parseNum(getVal(ROW_MAP.hvac_service_tgl_sales, colIdx)),
      tgl_close_rate: parseNum(getVal(ROW_MAP.hvac_service_close_rate, colIdx)),
      data_source: 'import',
    });

    // HVAC Maintenance
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'hvac',
      department: 'maintenance',
      revenue: parseNum(getVal(ROW_MAP.hvac_maint_revenue, colIdx)),
      sales: parseNum(getVal(ROW_MAP.hvac_maint_sales, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.hvac_maint_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.hvac_maint_jobs_ran, colIdx)),
      tgls: parseInt2(getVal(ROW_MAP.hvac_maint_tgls, colIdx)),
      tgl_sales: parseNum(getVal(ROW_MAP.hvac_maint_tgl_sales, colIdx)),
      tgl_close_rate: parseNum(getVal(ROW_MAP.hvac_maint_close_rate, colIdx)),
      data_source: 'import',
    });

    // HVAC Sales (department)
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'hvac',
      department: 'sales',
      hvac_lead_sales: parseNum(getVal(ROW_MAP.hvac_lead_sales, colIdx)),
      hvac_leads: parseInt2(getVal(ROW_MAP.hvac_leads, colIdx)),
      appts_ran: parseInt2(getVal(ROW_MAP.hvac_appts_ran, colIdx)),
      close_rate: parseNum(getVal(ROW_MAP.hvac_close_rate, colIdx)),
      marketed_lead_sales: parseNum(getVal(ROW_MAP.marketed_lead_sales, colIdx)),
      marketed_leads: parseInt2(getVal(ROW_MAP.marketed_leads, colIdx)),
      data_source: 'import',
    });

    // Plumbing
    weekRows.push({
      year: sheetConfig.year,
      week_number: weekNum,
      week_ending: weekEndStr,
      trade: 'plumbing',
      department: null,
      revenue: parseNum(getVal(ROW_MAP.plumbing_revenue, colIdx)),
      sales: parseNum(getVal(ROW_MAP.plumbing_sales, colIdx)),
      avg_ticket: parseNum(getVal(ROW_MAP.plumbing_avg_ticket, colIdx)),
      jobs_ran: parseInt2(getVal(ROW_MAP.plumbing_jobs_ran, colIdx)),
      data_source: 'import',
    });

    // Upsert all rows for this week
    const { error } = await supabase
      .from('weekly_scorecard')
      .upsert(weekRows, { onConflict: 'year,week_number,trade,department' });

    if (error) {
      console.error(`  Error inserting week ${weekNum} (${dateStr}):`, error.message);
    } else {
      insertCount += weekRows.length;
      if (weekNum <= 3 || weekNum % 10 === 0) {
        console.log(`  WK ${weekNum} (${dateStr}): ${weekRows.length} rows`);
      }
    }
  }

  console.log(`  Total: ${insertCount} rows inserted for ${sheetConfig.year}`);
}

async function main() {
  console.log('Weekly Scorecard Import');
  console.log('======================');

  for (const sheet of SHEETS) {
    await importSheet(sheet);
  }

  // Verify
  const { count } = await supabase
    .from('weekly_scorecard')
    .select('*', { count: 'exact', head: true });

  console.log(`\nDone. Total rows in weekly_scorecard: ${count}`);
}

main().catch(console.error);
