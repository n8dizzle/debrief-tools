/**
 * Debug script to verify ServiceTitan API values directly
 * Run: node --env-file=.env.local scripts/debug-st.mjs
 */

const BASE_URL = 'https://api.servicetitan.io';
const AUTH_URL = 'https://auth.servicetitan.io/connect/token';

const clientId = process.env.ST_CLIENT_ID;
const clientSecret = process.env.ST_CLIENT_SECRET;
const tenantId = process.env.ST_TENANT_ID;
const appKey = process.env.ST_APP_KEY;

if (!clientId || !clientSecret || !tenantId || !appKey) {
  console.error('Missing ST credentials in .env.local');
  process.exit(1);
}

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

async function main() {
  const token = await getToken();
  console.log('✓ Got ST token');

  // Check specific date (pass as arg or use yesterday)
  const argDate = process.argv[2];
  let dateStr;
  if (argDate) {
    dateStr = argDate;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateStr = yesterday.toISOString().split('T')[0];
  }
  // Calculate next day from dateStr
  const baseDate = new Date(dateStr + 'T00:00:00Z');
  baseDate.setDate(baseDate.getDate() + 1);
  const nextDayStr = baseDate.toISOString().split('T')[0];

  console.log(`\n📅 Checking data for: ${dateStr}\n`);

  // Get completed jobs
  console.log('=== COMPLETED JOBS ===');
  const jobs = await request(token, `jpm/v2/tenant/${tenantId}/jobs`, {
    completedOnOrAfter: `${dateStr}T00:00:00Z`,
    completedBefore: `${nextDayStr}T00:00:00Z`,
    jobStatus: 'Completed',
    pageSize: '200',
  });

  console.log(`Total completed jobs: ${jobs.data?.length || 0}`);

  let jobTotalSum = 0;
  jobs.data?.forEach((job, i) => {
    const total = Number(job.total) || 0;
    jobTotalSum += total;
    if (i < 10) {
      console.log(`  Job ${job.jobNumber}: $${total.toFixed(2)} (type: ${typeof job.total})`);
    }
  });
  if (jobs.data?.length > 10) {
    console.log(`  ... and ${jobs.data.length - 10} more jobs`);
  }
  console.log(`\n💰 Revenue Completed (sum of job totals): $${jobTotalSum.toFixed(2)}`);

  // Get invoices
  console.log('\n=== INVOICES ===');
  const invoices = await request(token, `accounting/v2/tenant/${tenantId}/invoices`, {
    createdOnOrAfter: `${dateStr}T00:00:00Z`,
    createdBefore: `${nextDayStr}T00:00:00Z`,
    pageSize: '200',
  });

  console.log(`Total invoices: ${invoices.data?.length || 0}`);

  let invoiceTotalSum = 0;
  invoices.data?.forEach((inv, i) => {
    const total = Number(inv.total) || 0;
    invoiceTotalSum += total;
    if (i < 10) {
      console.log(`  Invoice ${inv.invoiceNumber}: $${total.toFixed(2)} (type: ${typeof inv.total})`);
    }
  });
  if (invoices.data?.length > 10) {
    console.log(`  ... and ${invoices.data.length - 10} more invoices`);
  }
  console.log(`\n💰 Yesterday Sales (sum of invoice totals): $${invoiceTotalSum.toFixed(2)}`);

  // Get scheduled jobs
  console.log('\n=== SCHEDULED JOBS ===');
  const scheduled = await request(token, `jpm/v2/tenant/${tenantId}/jobs`, {
    scheduledOnOrAfter: `${dateStr}T00:00:00Z`,
    scheduledBefore: `${nextDayStr}T00:00:00Z`,
    pageSize: '200',
  });
  console.log(`📋 Jobs Scheduled: ${scheduled.data?.length || 0}`);

  // Calculate non-job revenue (invoices NOT for completed jobs)
  const completedJobIds = new Set(jobs.data?.map(j => j.id) || []);
  const completedJobInvoices = invoices.data?.filter(inv => inv.job && completedJobIds.has(inv.job.id)) || [];
  const nonCompletedJobInvoices = invoices.data?.filter(inv => inv.job && !completedJobIds.has(inv.job.id)) || [];
  const completedJobInvoiceRevenue = completedJobInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const nonJobRevenue = invoiceTotalSum - completedJobInvoiceRevenue;

  console.log('\n=== INVOICE BREAKDOWN ===');
  console.log(`Total invoices: ${invoices.data?.length || 0}`);
  console.log(`Invoices for COMPLETED jobs: ${completedJobInvoices.length} ($${completedJobInvoiceRevenue.toFixed(2)})`);
  console.log(`Invoices for NON-COMPLETED jobs: ${nonCompletedJobInvoices.length} ($${nonJobRevenue.toFixed(2)})`);

  // Debug: show what the job field looks like
  console.log('\nSample invoice job field values:');
  invoices.data?.slice(0, 8).forEach((inv, i) => {
    console.log(`  Invoice ${i+1}: job=${JSON.stringify(inv.job)}, total=$${Number(inv.total).toFixed(2)}`);
  });

  if (nonCompletedJobInvoices.length > 0) {
    console.log('\nNon-completed job invoice samples:');
    nonCompletedJobInvoices.slice(0, 5).forEach((inv) => {
      console.log(`  Job #${inv.job?.number} (${inv.job?.type}): $${(Number(inv.total) || 0).toFixed(2)}`);
    });
  }
  console.log(`\n💰 Non-Job Revenue: $${nonJobRevenue.toFixed(2)}`);

  // Check payments endpoint - might be source of non-job revenue
  console.log('\n=== PAYMENTS ===');
  const payments = await request(token, `accounting/v2/tenant/${tenantId}/payments`, {
    createdOnOrAfter: `${dateStr}T00:00:00Z`,
    createdBefore: `${nextDayStr}T00:00:00Z`,
    pageSize: '200',
  });

  console.log(`Total payments: ${payments.data?.length || 0}`);
  let paymentTotalSum = 0;
  let nonJobPayments = [];
  payments.data?.forEach((pmt, i) => {
    const total = Number(pmt.total) || 0;
    paymentTotalSum += total;
    // Check if payment is not linked to a job
    if (!pmt.job && !pmt.jobId) {
      nonJobPayments.push(pmt);
    }
    if (i < 5) {
      console.log(`  Payment ${i+1}: $${total.toFixed(2)}, job=${JSON.stringify(pmt.job || pmt.jobId)}, type=${pmt.type || pmt.paymentType}`);
    }
  });
  console.log(`Payment total: $${paymentTotalSum.toFixed(2)}`);
  console.log(`Non-job payments: ${nonJobPayments.length}`);

  // Calculate total revenue (completed jobs + non-job revenue)
  const totalRevenue = jobTotalSum + nonJobRevenue;

  console.log(`\n📊 Total Revenue Calculation:`);
  console.log(`  Completed Job Revenue: $${jobTotalSum.toFixed(2)}`);
  console.log(`  Non-Job Revenue: $${nonJobRevenue.toFixed(2)}`);
  console.log(`  TOTAL REVENUE: $${totalRevenue.toFixed(2)}`);

  console.log('\n=== SUMMARY ===');
  console.log(`Date: ${dateStr}`);
  console.log(`Jobs Scheduled: ${scheduled.data?.length || 0}`);
  console.log(`Completed Job Revenue: $${jobTotalSum.toFixed(2)}`);
  console.log(`Non-Job Revenue: $${nonJobRevenue.toFixed(2)}`);
  console.log(`TOTAL REVENUE: $${totalRevenue.toFixed(2)}`);
  console.log(`Yesterday Sales (invoices): $${invoiceTotalSum.toFixed(2)}`);
}

main().catch(console.error);
