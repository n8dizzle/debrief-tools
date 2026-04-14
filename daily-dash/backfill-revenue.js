#!/usr/bin/env node
/**
 * Backfill daily revenue snapshots from ST Report 222 (BU Dashboard - Revenue).
 *
 * Usage:
 *   node backfill-revenue.js                    # Resume from last completed date
 *   node backfill-revenue.js 2025-11-18         # Start from specific date
 *   node backfill-revenue.js 2025-01-01 2025-03-31  # Specific range
 *
 * Requires .env.local with ST_CLIENT_ID, ST_CLIENT_SECRET, ST_TENANT_ID, ST_APP_KEY,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'https://api.servicetitan.io';
const AUTH_URL = 'https://auth.servicetitan.io/connect/token';
const tenantId = process.env.ST_TENANT_ID;
const DELAY_MS = 65000; // 65s between calls

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HVAC_BUS = [
  'HVAC - Install', 'HVAC - Service', 'HVAC - Maintenance', 'HVAC - Sales',
  'Mims - Service', 'z-DNU - Christmas HVAC- Install',
  'z-DNU - Christmas HVAC- Service', 'z DNU Imported Default Businessunit',
];
const PLUMBING_BUS = [
  'Plumbing - Install', 'Plumbing - Service', 'Plumbing - Maintenance', 'Plumbing - Sales',
];
const DEPT_MAP = {
  'HVAC - Install': 'install', 'HVAC - Service': 'service',
  'HVAC - Maintenance': 'maintenance', 'HVAC - Sales': 'install',
  'Mims - Service': 'service', 'z-DNU - Christmas HVAC- Install': 'install',
  'z-DNU - Christmas HVAC- Service': 'service',
  'z DNU Imported Default Businessunit': 'service',
};

let token = null, tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.ST_CLIENT_ID,
      client_secret: process.env.ST_CLIENT_SECRET,
    }),
  });
  const d = await res.json();
  token = d.access_token;
  tokenExpiry = Date.now() + 800000;
  return token;
}

async function getSalesReport(from, to, retryCount = 0) {
  const tk = await getToken();
  const res = await fetch(
    `${BASE_URL}/reporting/v2/tenant/${tenantId}/report-category/business-unit-dashboard/reports/234/data`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tk}`,
        'ST-App-Key': process.env.ST_APP_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parameters: [
          { name: 'From', value: from },
          { name: 'To', value: to },
        ],
        pageSize: 2000,
        page: 1,
      }),
    }
  );
  if (res.status === 429) {
    if (retryCount >= 5) return { data: [] }; // Skip sales if rate limited
    await sleep(120 * 1000);
    return getSalesReport(from, to, retryCount + 1);
  }
  if (!res.ok) return { data: [] }; // Skip sales on error, don't fail the whole run
  return res.json();
}

async function getReport(from, to, retryCount = 0) {
  const tk = await getToken();
  const res = await fetch(
    `${BASE_URL}/reporting/v2/tenant/${tenantId}/report-category/business-unit-dashboard/reports/222/data`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tk}`,
        'ST-App-Key': process.env.ST_APP_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parameters: [
          { name: 'From', value: from },
          { name: 'To', value: to },
        ],
        pageSize: 2000,
        page: 1,
      }),
    }
  );
  if (res.status === 429) {
    if (retryCount >= 5) {
      console.log('  Rate limited 5 times in a row — stopping. Re-run to resume.');
      process.exit(0);
    }
    const wait = 120;
    console.log(`  429 - waiting ${wait}s... (retry ${retryCount + 1}/5)`);
    await sleep(wait * 1000);
    return getReport(from, to, retryCount + 1);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

function aggregate(rows) {
  const hvac = { cr: 0, njr: 0, ar: 0, tr: 0 };
  const plumbing = { cr: 0, njr: 0, ar: 0, tr: 0 };
  const depts = {
    install: { cr: 0, njr: 0, ar: 0, tr: 0 },
    service: { cr: 0, njr: 0, ar: 0, tr: 0 },
    maintenance: { cr: 0, njr: 0, ar: 0, tr: 0 },
  };
  for (const r of rows) {
    const name = r[0];
    const cr = parseFloat(r[1]) || 0;
    const njr = parseFloat(r[2]) || 0;
    const ar = parseFloat(r[3]) || 0;
    const tr = parseFloat(r[4]) || 0;
    if (HVAC_BUS.includes(name)) {
      hvac.cr += cr; hvac.njr += njr; hvac.ar += ar; hvac.tr += tr;
      const dept = DEPT_MAP[name];
      if (dept) {
        depts[dept].cr += cr; depts[dept].njr += njr;
        depts[dept].ar += ar; depts[dept].tr += tr;
      }
    } else if (PLUMBING_BUS.includes(name)) {
      plumbing.cr += cr; plumbing.njr += njr;
      plumbing.ar += ar; plumbing.tr += tr;
    }
  }
  return { hvac, plumbing, depts };
}

function aggregateSales(rows) {
  const salesByBU = new Map();
  for (const r of (rows || [])) {
    const name = (r[0] || '').toString().trim();
    const sales = parseFloat(r[1]) || 0;
    salesByBU.set(name, sales);
  }
  let hvacSales = 0, plumbingSales = 0;
  const deptSales = { install: 0, service: 0, maintenance: 0 };
  for (const [name, sales] of salesByBU) {
    if (HVAC_BUS.includes(name)) {
      hvacSales += sales;
      const dept = DEPT_MAP[name];
      if (dept) deptSales[dept] += sales;
    } else if (PLUMBING_BUS.includes(name)) {
      plumbingSales += sales;
    }
  }
  return { hvacSales, plumbingSales, deptSales };
}

function fmt(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findResumeDate() {
  // Find the latest date we have in the DB, resume from the day after
  const { data } = await supabase
    .from('trade_daily_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    const last = new Date(data[0].snapshot_date + 'T00:00:00Z');
    last.setDate(last.getDate() + 1);
    return fmt(last);
  }
  return '2025-01-01';
}

(async () => {
  const args = process.argv.slice(2);
  let startStr, endStr;

  if (args.length >= 2) {
    startStr = args[0];
    endStr = args[1];
  } else if (args.length === 1) {
    startStr = args[0];
    // Default end: yesterday
    const y = new Date(); y.setDate(y.getDate() - 1);
    endStr = fmt(y);
  } else {
    startStr = await findResumeDate();
    const y = new Date(); y.setDate(y.getDate() - 1);
    endStr = fmt(y);
  }

  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  const totalDays = Math.round((end - start) / 86400000) + 1;

  console.log(`=== Revenue Backfill: ${startStr} to ${endStr} (${totalDays} days) ===`);
  console.log(`Started at: ${new Date().toLocaleString()}`);
  console.log(`Delay: ${DELAY_MS / 1000}s between calls\n`);

  let current = new Date(start);
  let count = 0, errors = 0;

  while (current <= end) {
    const dateStr = fmt(current);
    try {
      const [data, salesData] = await Promise.all([
        getReport(dateStr, dateStr),
        getSalesReport(dateStr, dateStr),
      ]);
      const { hvac, plumbing, depts } = aggregate(data.data);
      const { hvacSales, plumbingSales, deptSales } = aggregateSales(salesData.data);
      const rows = [
        { snapshot_date: dateStr, trade: 'hvac', department: null, revenue: hvac.tr, completed_revenue: hvac.cr, non_job_revenue: hvac.njr, adj_revenue: hvac.ar, sales: hvacSales },
        { snapshot_date: dateStr, trade: 'hvac', department: 'install', revenue: depts.install.tr, completed_revenue: depts.install.cr, non_job_revenue: depts.install.njr, adj_revenue: depts.install.ar, sales: deptSales.install },
        { snapshot_date: dateStr, trade: 'hvac', department: 'service', revenue: depts.service.tr, completed_revenue: depts.service.cr, non_job_revenue: depts.service.njr, adj_revenue: depts.service.ar, sales: deptSales.service },
        { snapshot_date: dateStr, trade: 'hvac', department: 'maintenance', revenue: depts.maintenance.tr, completed_revenue: depts.maintenance.cr, non_job_revenue: depts.maintenance.njr, adj_revenue: depts.maintenance.ar, sales: deptSales.maintenance },
        { snapshot_date: dateStr, trade: 'plumbing', department: null, revenue: plumbing.tr, completed_revenue: plumbing.cr, non_job_revenue: plumbing.njr, adj_revenue: plumbing.ar, sales: plumbingSales },
      ];
      await supabase.from('trade_daily_snapshots').delete().eq('snapshot_date', dateStr);
      const { error } = await supabase.from('trade_daily_snapshots').insert(rows);
      if (error) throw new Error(error.message);
      count++;
      const total = hvac.tr + plumbing.tr;
      const pct = Math.round((count / totalDays) * 100);
      if (total > 0) console.log(`${dateStr}: $${total.toLocaleString('en', { minimumFractionDigits: 2 })}  [${count}/${totalDays} ${pct}%]`);
      else process.stdout.write(`${dateStr}: $0  `);
      await sleep(DELAY_MS);
    } catch (e) {
      console.error(`${dateStr} ERROR: ${e.message}`);
      errors++;
      await sleep(DELAY_MS);
    }
    current.setDate(current.getDate() + 1);
  }

  console.log(`\nDone! ${count} days synced, ${errors} errors`);
  console.log(`Finished at: ${new Date().toLocaleString()}`);
})();
