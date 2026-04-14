#!/usr/bin/env node
/**
 * Export revenue data from Supabase to Google Sheet "Non-Job Revenue" tab.
 * Pulls from trade_daily_snapshots — instant, no ST API calls.
 *
 * Usage:
 *   node export-revenue-to-sheet.js                          # Export all data
 *   node export-revenue-to-sheet.js 2025-01-01 2025-03-31    # Specific range
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SHEET_ID = '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';
const TAB = 'Non-Job Revenue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function fmtSheetDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y.slice(2)}`;
}

function fmtCurrency(num) {
  if (num < 0) return '-$' + Math.abs(num).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function writeToSheet(range, values) {
  const fs = require('fs');
  const tmpParams = '/tmp/sheet-export-params.json';
  const tmpBody = '/tmp/sheet-export-values.json';
  fs.writeFileSync(tmpBody, JSON.stringify({ values }));
  fs.writeFileSync(tmpParams, JSON.stringify({ spreadsheetId: SHEET_ID, range: `'${TAB}'!${range}`, valueInputOption: 'USER_ENTERED' }));
  try {
    execSync(`gws sheets spreadsheets values update --params "$(cat ${tmpParams})" --json "$(cat ${tmpBody})"`, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
    return true;
  } catch (e) {
    console.error('Sheet write error:', e.stderr?.toString().slice(0, 500));
    return false;
  }
}

function clearSheet(range) {
  const fs = require('fs');
  const tmpParams = '/tmp/sheet-clear-params.json';
  fs.writeFileSync(tmpParams, JSON.stringify({ spreadsheetId: SHEET_ID, range: `'${TAB}'!${range}` }));
  try {
    execSync(`gws sheets spreadsheets values clear --params "$(cat ${tmpParams})" --json '{}'`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('Sheet clear error:', e.stderr?.toString().slice(0, 200));
    return false;
  }
}

(async () => {
  const args = process.argv.slice(2);
  const startStr = args[0] || '2025-01-01';
  const endStr = args[1] || new Date().toISOString().split('T')[0];

  console.log(`=== Revenue Export to Google Sheet ===`);
  console.log(`Range: ${startStr} to ${endStr}`);
  console.log(`Source: Supabase trade_daily_snapshots`);
  console.log(`Started at: ${new Date().toLocaleString()}\n`);

  // Fetch all snapshots from Supabase
  console.log('Fetching data from Supabase...');
  const allRows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('trade_daily_snapshots')
      .select('snapshot_date, trade, department, revenue, completed_revenue, non_job_revenue, adj_revenue')
      .gte('snapshot_date', startStr)
      .lte('snapshot_date', endStr)
      .order('snapshot_date', { ascending: true })
      .order('trade', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }

    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Fetched ${allRows.length} rows from Supabase\n`);

  // Filter to only department-level rows (skip aggregate trade rows where department is null)
  // This gives us: hvac/install, hvac/service, hvac/maintenance, plumbing (aggregate only)
  // For plumbing we keep the null-department row since there's no department breakdown
  const sheetRows = allRows.filter(r => {
    if (r.trade === 'plumbing' && r.department === null) return true;
    if (r.department !== null) return true;
    return false;
  });

  console.log(`${sheetRows.length} rows to write (department-level + plumbing aggregate)\n`);

  // Write header
  const header = [['DATE', 'TRADE', 'DEPARTMENT', 'TOTAL REVENUE', 'COMPLETED REVENUE', 'NON-JOB REVENUE', 'ADJUSTMENT REVENUE']];
  writeToSheet('A1:G1', header);

  // Clear existing data
  clearSheet('A2:J50000');

  // Build all sheet rows
  const values = sheetRows.map(r => [
    fmtSheetDate(r.snapshot_date),
    r.trade.toUpperCase(),
    r.department ? r.department.charAt(0).toUpperCase() + r.department.slice(1) : 'All',
    fmtCurrency(r.revenue || 0),
    fmtCurrency(r.completed_revenue || 0),
    fmtCurrency(r.non_job_revenue || 0),
    fmtCurrency(r.adj_revenue || 0),
  ]);

  // Write in batches of 5000 rows (Sheets API limit)
  const BATCH_SIZE = 5000;
  let written = 0;

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const startRow = i + 2; // Row 1 is header
    const endRow = startRow + batch.length - 1;
    const range = `A${startRow}:G${endRow}`;

    console.log(`Writing rows ${startRow}-${endRow}...`);
    writeToSheet(range, batch);
    written += batch.length;
  }

  console.log(`\nDone! ${written} rows written to "${TAB}" tab`);
  console.log(`Finished at: ${new Date().toLocaleString()}`);
})();
