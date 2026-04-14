#!/usr/bin/env node
/**
 * Backfill sales data from ST Report 234 (BU Dashboard - Sales) into trade_daily_snapshots.
 * Updates the `sales` column on existing rows — doesn't touch revenue data.
 *
 * Usage:
 *   node backfill-sales.js                          # All dates with sales=0
 *   node backfill-sales.js 2025-01-01 2025-03-31    # Specific range
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'https://api.servicetitan.io';
const AUTH_URL = 'https://auth.servicetitan.io/connect/token';
const tenantId = process.env.ST_TENANT_ID;
const DELAY_MS = 65000;

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
    if (retryCount >= 5) {
      console.log('  Rate limited 5 times — stopping. Re-run to resume.');
      process.exit(0);
    }
    console.log(`  429 - waiting 120s... (retry ${retryCount + 1}/5)`);
    await new Promise(r => setTimeout(r, 120000));
    return getSalesReport(from, to, retryCount + 1);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

function fmt(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

(async () => {
  const args = process.argv.slice(2);
  let startStr, endStr;

  if (args.length >= 2) {
    startStr = args[0];
    endStr = args[1];
  } else {
    // Find all dates that have snapshots (get distinct dates)
    startStr = '2025-01-01';
    const y = new Date(); y.setDate(y.getDate() - 1);
    endStr = fmt(y);
  }

  const start = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  const totalDays = Math.round((end - start) / 86400000) + 1;

  console.log(`=== Sales Backfill (Report 234): ${startStr} to ${endStr} (${totalDays} days) ===`);
  console.log(`Started at: ${new Date().toLocaleString()}`);
  console.log(`Delay: ${DELAY_MS / 1000}s between calls\n`);

  let current = new Date(start);
  let count = 0, errors = 0;

  while (current <= end) {
    const dateStr = fmt(current);
    try {
      const data = await getSalesReport(dateStr, dateStr);

      // Build sales by BU name
      const salesByBU = new Map();
      const nameIdx = 0, salesIdx = 1; // Name, TotalSales
      for (const row of (data.data || [])) {
        const name = (row[nameIdx] || '').toString().trim();
        const sales = parseFloat(row[salesIdx]) || 0;
        salesByBU.set(name, sales);
      }

      // Aggregate sales by trade and department
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

      // Update existing snapshot rows with sales
      const updates = [
        { trade: 'hvac', department: null, sales: hvacSales },
        { trade: 'hvac', department: 'install', sales: deptSales.install },
        { trade: 'hvac', department: 'service', sales: deptSales.service },
        { trade: 'hvac', department: 'maintenance', sales: deptSales.maintenance },
        { trade: 'plumbing', department: null, sales: plumbingSales },
      ];

      for (const u of updates) {
        let query = supabase
          .from('trade_daily_snapshots')
          .update({ sales: u.sales })
          .eq('snapshot_date', dateStr)
          .eq('trade', u.trade);

        if (u.department === null) {
          query = query.is('department', null);
        } else {
          query = query.eq('department', u.department);
        }

        const { error } = await query;
        if (error) console.error(`  Update error ${u.trade}/${u.department}: ${error.message}`);
      }

      count++;
      const totalSales = hvacSales + plumbingSales;
      const pct = Math.round((count / totalDays) * 100);
      if (totalSales > 0) console.log(`${dateStr}: $${totalSales.toLocaleString('en', { minimumFractionDigits: 2 })} sales  [${count}/${totalDays} ${pct}%]`);
      else process.stdout.write(`${dateStr}: $0  `);

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (e) {
      console.error(`${dateStr} ERROR: ${e.message}`);
      errors++;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
    current.setDate(current.getDate() + 1);
  }

  console.log(`\nDone! ${count} days updated, ${errors} errors`);
  console.log(`Finished at: ${new Date().toLocaleString()}`);
})();
