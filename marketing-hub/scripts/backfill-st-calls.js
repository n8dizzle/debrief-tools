#!/usr/bin/env node
/**
 * Backfill ST Calls for 2025
 *
 * Run with: node scripts/backfill-st-calls.js
 *
 * This script fetches all ServiceTitan calls from 2025 month by month
 * and saves them to the st_calls table in Supabase.
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ST_CONFIG = {
  clientId: (process.env.ST_CLIENT_ID || '').trim(),
  clientSecret: (process.env.ST_CLIENT_SECRET || '').trim(),
  tenantId: (process.env.ST_TENANT_ID || '').trim(),
  appKey: (process.env.ST_APP_KEY || '').trim(),
};

const BASE_URL = 'https://api.servicetitan.io';
const AUTH_URL = 'https://auth.servicetitan.io/connect/token';

let accessToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
  if (accessToken && tokenExpiresAt && new Date() < new Date(tokenExpiresAt.getTime() - 60000)) {
    return accessToken;
  }

  console.log('  [Auth] Getting new access token...');
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: ST_CONFIG.clientId,
      client_secret: ST_CONFIG.clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = new Date(Date.now() + (data.expires_in || 900) * 1000);
  return accessToken;
}

async function fetchCallsPage(startDate, endDate, page) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    createdOnOrAfter: `${startDate}T00:00:00`,
    createdBefore: `${endDate}T00:00:00`,
    pageSize: '500',
    page: page.toString(),
  });

  const url = `${BASE_URL}/telecom/v2/tenant/${ST_CONFIG.tenantId}/calls?${params}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'ST-App-Key': ST_CONFIG.appKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ST API error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function fetchAllCallsForPeriod(startDate, endDate) {
  const allCalls = [];
  let page = 1;
  let hasMore = true;
  let totalCount = 0;

  while (hasMore) {
    const response = await fetchCallsPage(startDate, endDate, page);

    if (response.totalCount) {
      totalCount = response.totalCount;
    }

    allCalls.push(...(response.data || []));
    hasMore = response.hasMore;

    if (page % 5 === 0) {
      console.log(`    Page ${page}: ${allCalls.length}/${totalCount} calls fetched...`);
    }

    page++;

    if (page > 500) {
      console.warn(`    WARNING: Hit page limit at ${allCalls.length} calls`);
      break;
    }

    // Small delay to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { calls: allCalls, totalCount };
}

function parseDuration(duration) {
  if (duration === null || duration === undefined) return null;
  if (typeof duration === 'number') return duration;

  if (duration.startsWith('PT')) {
    let seconds = 0;
    const hourMatch = duration.match(/(\d+)H/);
    const minMatch = duration.match(/(\d+)M/);
    const secMatch = duration.match(/(\d+)S/);
    if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) seconds += parseInt(minMatch[1]) * 60;
    if (secMatch) seconds += parseInt(secMatch[1]);
    return seconds;
  }

  const parts = duration.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }

  return parseInt(duration, 10) || null;
}

function transformCall(callWrapper) {
  const call = callWrapper.leadCall || callWrapper;

  return {
    st_call_id: call.id?.toString(),
    direction: call.direction || 'Unknown',
    call_type: call.callType || callWrapper.type?.name || null,
    duration_seconds: parseDuration(call.duration),
    customer_id: call.customer?.id || null,
    job_id: callWrapper.jobNumber ? parseInt(callWrapper.jobNumber) : null,
    booking_id: call.booking?.id || null,
    from_phone: call.from || null,
    to_phone: call.to || null,
    tracking_number: call.to || null,
    campaign_id: call.campaign?.id || null,
    campaign_name: call.campaign?.name || null,
    agent_id: call.agent?.id || call.createdBy?.id || null,
    agent_name: call.agent?.name || call.createdBy?.name || null,
    recording_url: call.recordingUrl || null,
    business_unit_id: callWrapper.businessUnit?.id || null,
    business_unit_name: callWrapper.businessUnit?.name || null,
    received_at: call.receivedOn,
    answered_at: null,
    ended_at: null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function saveCalls(calls) {
  let synced = 0;
  let errors = 0;

  const batchSize = 100;
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    const records = batch
      .map(transformCall)
      .filter(r => r.st_call_id && r.received_at);

    if (records.length === 0) continue;

    const { error } = await supabase
      .from('st_calls')
      .upsert(records, { onConflict: 'st_call_id' });

    if (error) {
      console.error(`    Batch upsert error:`, error.message);
      errors += records.length;
    } else {
      synced += records.length;
    }
  }

  return { synced, errors };
}

async function backfillMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  console.log(`\n📅 Processing ${year}-${String(month).padStart(2, '0')}...`);
  console.log(`   Date range: ${startDate} to ${endDate}`);

  const startTime = Date.now();

  try {
    const { calls, totalCount } = await fetchAllCallsForPeriod(startDate, endDate);
    console.log(`   Fetched ${calls.length} calls (API total: ${totalCount})`);

    const { synced, errors } = await saveCalls(calls);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   ✅ Saved ${synced} calls, ${errors} errors (${durationSec}s)`);

    return { month: `${year}-${String(month).padStart(2, '0')}`, fetched: calls.length, synced, errors };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { month: `${year}-${String(month).padStart(2, '0')}`, fetched: 0, synced: 0, errors: 1, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('ST Calls Backfill - 2025');
  console.log('='.repeat(60));

  // Validate config
  if (!ST_CONFIG.clientId || !ST_CONFIG.clientSecret || !ST_CONFIG.tenantId || !ST_CONFIG.appKey) {
    console.error('❌ Missing ServiceTitan configuration. Check your .env.local file.');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase configuration. Check your .env.local file.');
    process.exit(1);
  }

  console.log('✅ Configuration validated');
  console.log(`   Tenant ID: ${ST_CONFIG.tenantId}`);
  console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  // Check current data
  const { count: currentCount } = await supabase
    .from('st_calls')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Current st_calls count: ${currentCount}`);

  // Process each month of 2025
  const results = [];
  let totalFetched = 0;
  let totalSynced = 0;

  for (let month = 1; month <= 12; month++) {
    const result = await backfillMonth(2025, month);
    results.push(result);
    totalFetched += result.fetched;
    totalSynced += result.synced;
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log('='.repeat(60));

  const { count: newCount } = await supabase
    .from('st_calls')
    .select('*', { count: 'exact', head: true });

  const { data: earliest } = await supabase
    .from('st_calls')
    .select('received_at')
    .order('received_at', { ascending: true })
    .limit(1);

  const { data: latest } = await supabase
    .from('st_calls')
    .select('received_at')
    .order('received_at', { ascending: false })
    .limit(1);

  console.log('\nResults by month:');
  console.log('-'.repeat(50));
  for (const r of results) {
    const status = r.errors > 0 ? '⚠️' : '✅';
    console.log(`  ${status} ${r.month}: ${r.fetched} fetched, ${r.synced} synced`);
  }

  console.log('-'.repeat(50));
  console.log(`\nTotal: ${totalFetched} calls fetched, ${totalSynced} synced`);
  console.log(`Database now has: ${newCount} total calls`);
  console.log(`Date range: ${earliest?.[0]?.received_at} to ${latest?.[0]?.received_at}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
