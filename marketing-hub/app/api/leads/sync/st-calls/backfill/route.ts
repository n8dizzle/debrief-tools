import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getSTConfig() {
  return {
    clientId: (process.env.ST_CLIENT_ID || '').trim(),
    clientSecret: (process.env.ST_CLIENT_SECRET || '').trim(),
    tenantId: (process.env.ST_TENANT_ID || '').trim(),
    appKey: (process.env.ST_APP_KEY || '').trim(),
  };
}

class STCallsClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  isConfigured(): boolean {
    const config = getSTConfig();
    return !!(config.clientId && config.clientSecret && config.tenantId && config.appKey);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferTime = new Date(this.tokenExpiresAt.getTime() - 60000);
      if (now < bufferTime) {
        return this.accessToken;
      }
    }

    const config = getSTConfig();
    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get ST access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 900) * 1000);
    return this.accessToken!;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options: { params?: Record<string, string> } = {}
  ): Promise<T> {
    const config = getSTConfig();
    const token = await this.getAccessToken();
    let url = `${this.BASE_URL}/${endpoint}`;
    if (options.params) {
      url += `?${new URLSearchParams(options.params).toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': config.appKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ST API error ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json();
  }

  /**
   * Fetch calls for a specific date range with full pagination
   */
  async getCallsForPeriod(
    startDate: string,
    endDate: string
  ): Promise<{ calls: any[]; totalCount: number }> {
    const config = getSTConfig();
    const allCalls: any[] = [];
    let page = 1;
    let hasMore = true;
    let totalCount = 0;

    while (hasMore) {
      const params: Record<string, string> = {
        createdOnOrAfter: `${startDate}T00:00:00`,
        createdBefore: `${endDate}T00:00:00`,
        pageSize: '500', // Max allowed
        page: page.toString(),
      };

      const response = await this.request<{
        data: any[];
        hasMore: boolean;
        totalCount?: number;
      }>('GET', `telecom/v2/tenant/${config.tenantId}/calls`, { params });

      if (response.totalCount) {
        totalCount = response.totalCount;
      }

      allCalls.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      // Safety limit
      if (page > 500) {
        console.warn(`[Backfill] Hit page limit for ${startDate} - ${endDate}`);
        break;
      }
    }

    return { calls: allCalls, totalCount };
  }
}

const stClient = new STCallsClient();

function parseDuration(duration: string | number | null): number | null {
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

/**
 * Transform ST API call to database record
 */
function transformCall(callWrapper: any): any {
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

/**
 * Save calls to Supabase in batches
 */
async function saveCalls(calls: any[]): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  // Process in batches of 100 for efficient upserts
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
      console.error(`[Backfill] Batch upsert error:`, error.message);
      errors += records.length;
    } else {
      synced += records.length;
    }
  }

  return { synced, errors };
}

/**
 * POST /api/leads/sync/st-calls/backfill
 *
 * Backfill ST calls for a specific month or full year.
 *
 * Query params:
 * - year: Year to backfill (default: 2025)
 * - month: Specific month (1-12) or 'all' for full year (default: 'all')
 * - startMonth: Starting month for partial backfill (default: 1)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (role !== 'owner' && !hasPermission(role, permissions, 'marketing_hub', 'can_sync_data')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  if (!stClient.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan API not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '2025');
  const monthParam = searchParams.get('month') || 'all';
  const startMonth = parseInt(searchParams.get('startMonth') || '1');

  const results: {
    month: string;
    callsFetched: number;
    callsSynced: number;
    errors: number;
    durationMs: number;
  }[] = [];

  let totalFetched = 0;
  let totalSynced = 0;
  let totalErrors = 0;

  try {
    // Determine which months to process
    const months: number[] = [];
    if (monthParam === 'all') {
      for (let m = startMonth; m <= 12; m++) {
        months.push(m);
      }
    } else {
      months.push(parseInt(monthParam));
    }

    console.log(`[Backfill] Starting backfill for ${year}, months: ${months.join(', ')}`);

    for (const month of months) {
      const monthStart = new Date();

      // Calculate date range for this month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      console.log(`[Backfill] Processing ${year}-${String(month).padStart(2, '0')}: ${startDate} to ${endDate}`);

      try {
        // Fetch all calls for this month
        const { calls, totalCount } = await stClient.getCallsForPeriod(startDate, endDate);
        console.log(`[Backfill] ${year}-${String(month).padStart(2, '0')}: Fetched ${calls.length} calls (API reports ${totalCount} total)`);

        // Save to database
        const { synced, errors } = await saveCalls(calls);

        const durationMs = Date.now() - monthStart.getTime();

        results.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          callsFetched: calls.length,
          callsSynced: synced,
          errors,
          durationMs,
        });

        totalFetched += calls.length;
        totalSynced += synced;
        totalErrors += errors;

        console.log(`[Backfill] ${year}-${String(month).padStart(2, '0')}: Synced ${synced}, errors ${errors}, took ${durationMs}ms`);

      } catch (monthError: any) {
        console.error(`[Backfill] Error processing ${year}-${String(month).padStart(2, '0')}:`, monthError.message);
        results.push({
          month: `${year}-${String(month).padStart(2, '0')}`,
          callsFetched: 0,
          callsSynced: 0,
          errors: 1,
          durationMs: Date.now() - monthStart.getTime(),
        });
        totalErrors++;
        // Continue to next month instead of failing entirely
      }
    }

    // Get updated stats
    const { count } = await supabase
      .from('st_calls')
      .select('*', { count: 'exact', head: true });

    const { data: dateRange } = await supabase
      .from('st_calls')
      .select('received_at')
      .order('received_at', { ascending: true })
      .limit(1);

    return NextResponse.json({
      success: true,
      summary: {
        year,
        monthsProcessed: results.length,
        totalCallsFetched: totalFetched,
        totalCallsSynced: totalSynced,
        totalErrors,
      },
      byMonth: results,
      currentStats: {
        totalCallsInDb: count,
        earliestCall: dateRange?.[0]?.received_at,
      },
    });

  } catch (error: any) {
    console.error('[Backfill] Failed:', error);
    return NextResponse.json({
      error: error.message || 'Backfill failed',
      partialResults: results,
    }, { status: 500 });
  }
}

/**
 * GET /api/leads/sync/st-calls/backfill
 *
 * Check backfill status - what data exists
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get call counts by month for 2025
    const { data: monthlyCounts } = await supabase.rpc('get_st_calls_by_month', {
      target_year: 2025
    }).select('*');

    // If RPC doesn't exist, do manual query
    let byMonth: { month: string; count: number }[] = [];

    if (!monthlyCounts) {
      // Manual month-by-month count
      for (let month = 1; month <= 12; month++) {
        const startDate = `2025-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? 2026 : 2025;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

        const { count } = await supabase
          .from('st_calls')
          .select('*', { count: 'exact', head: true })
          .gte('received_at', `${startDate}T00:00:00`)
          .lt('received_at', `${endDate}T00:00:00`);

        byMonth.push({
          month: `2025-${String(month).padStart(2, '0')}`,
          count: count || 0,
        });
      }
    } else {
      byMonth = monthlyCounts;
    }

    // Get overall stats
    const { count: totalCount } = await supabase
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

    return NextResponse.json({
      totalCalls: totalCount || 0,
      dateRange: {
        earliest: earliest?.[0]?.received_at || null,
        latest: latest?.[0]?.received_at || null,
      },
      byMonth2025: byMonth,
    });

  } catch (error: any) {
    console.error('[Backfill Status] Failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
