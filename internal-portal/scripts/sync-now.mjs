/**
 * Direct sync script - bypasses auth for testing
 * Run: node --env-file=.env.local scripts/sync-now.mjs [date]
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_URL = 'https://api.servicetitan.io';
const AUTH_URL = 'https://auth.servicetitan.io/connect/token';

const clientId = process.env.ST_CLIENT_ID;
const clientSecret = process.env.ST_CLIENT_SECRET;
const tenantId = process.env.ST_TENANT_ID;
const appKey = process.env.ST_APP_KEY;

async function getToken() {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function request(token, endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'ST-App-Key': appKey,
    },
  });
  return res.json();
}

async function syncDate(dateStr) {
  const token = await getToken();
  console.log('✓ Got ST token');

  const baseDate = new Date(dateStr + 'T00:00:00Z');
  baseDate.setDate(baseDate.getDate() + 1);
  const nextDayStr = baseDate.toISOString().split('T')[0];

  console.log(`\n📅 Syncing data for: ${dateStr}\n`);

  // Get completed jobs
  const jobs = await request(token, `jpm/v2/tenant/${tenantId}/jobs`, {
    completedOnOrAfter: `${dateStr}T00:00:00Z`,
    completedBefore: `${nextDayStr}T00:00:00Z`,
    jobStatus: 'Completed',
    pageSize: '200',
  });

  const jobRevenue = jobs.data?.reduce((sum, j) => sum + (Number(j.total) || 0), 0) || 0;
  const completedJobIds = new Set(jobs.data?.map(j => j.id) || []);

  // Get invoices
  const invoices = await request(token, `accounting/v2/tenant/${tenantId}/invoices`, {
    createdOnOrAfter: `${dateStr}T00:00:00Z`,
    createdBefore: `${nextDayStr}T00:00:00Z`,
    pageSize: '200',
  });

  const invoiceTotal = invoices.data?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
  const completedJobInvoiceTotal = invoices.data
    ?.filter(inv => inv.job && completedJobIds.has(inv.job.id))
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
  const nonJobRevenue = Math.max(0, invoiceTotal - completedJobInvoiceTotal);
  const totalRevenue = jobRevenue + nonJobRevenue;

  // Get scheduled jobs
  const scheduled = await request(token, `jpm/v2/tenant/${tenantId}/jobs`, {
    scheduledOnOrAfter: `${dateStr}T00:00:00Z`,
    scheduledBefore: `${nextDayStr}T00:00:00Z`,
    pageSize: '200',
  });

  const jobsScheduled = scheduled.data?.length || 0;
  const jobsCompleted = jobs.data?.length || 0;

  console.log('=== ServiceTitan Data ===');
  console.log(`Jobs Scheduled: ${jobsScheduled}`);
  console.log(`Jobs Completed: ${jobsCompleted}`);
  console.log(`Completed Job Revenue: $${jobRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`Non-Job Revenue: $${nonJobRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`Total Revenue: $${totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`);

  // Get KPIs from database
  const { data: kpis } = await supabase
    .from('huddle_kpis')
    .select('id, slug')
    .in('slug', ['jobs-scheduled', 'revenue-completed', 'non-job-revenue', 'total-revenue']);

  console.log('\n=== Updating Snapshots ===');

  const kpiMap = new Map(kpis?.map(k => [k.slug, k.id]) || []);

  const snapshots = [
    { slug: 'jobs-scheduled', value: jobsScheduled },
    { slug: 'revenue-completed', value: jobRevenue },
    { slug: 'non-job-revenue', value: nonJobRevenue },
    { slug: 'total-revenue', value: totalRevenue },
  ];

  for (const snap of snapshots) {
    const kpiId = kpiMap.get(snap.slug);
    if (!kpiId) {
      console.log(`  ⚠️ KPI not found: ${snap.slug}`);
      continue;
    }

    const { error } = await supabase.from('huddle_snapshots').upsert({
      kpi_id: kpiId,
      snapshot_date: dateStr,
      actual_value: snap.value,
      data_source: 'servicetitan',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'kpi_id,snapshot_date' });

    if (error) {
      console.log(`  ❌ ${snap.slug}: Error - ${error.message}`);
    } else {
      const formatted = snap.slug === 'jobs-scheduled'
        ? snap.value.toString()
        : '$' + snap.value.toLocaleString('en-US', {minimumFractionDigits: 2});
      console.log(`  ✓ ${snap.slug}: ${formatted}`);
    }
  }

  console.log('\n✅ Sync complete!');
}

// Get date from argument or use today
const dateArg = process.argv[2] || '2026-01-06';
await syncDate(dateArg);
