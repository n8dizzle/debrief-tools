import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ServiceTitan client for calls
class STCallsClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  private clientId = process.env.ST_CLIENT_ID || '';
  private clientSecret = process.env.ST_CLIENT_SECRET || '';
  private tenantId = process.env.ST_TENANT_ID || '';
  private appKey = process.env.ST_APP_KEY || '';

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferTime = new Date(this.tokenExpiresAt.getTime() - 60000);
      if (now < bufferTime) {
        return this.accessToken;
      }
    }

    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
    const token = await this.getAccessToken();
    let url = `${this.BASE_URL}/${endpoint}`;
    if (options.params) {
      url += `?${new URLSearchParams(options.params).toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': this.appKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ST API error ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json();
  }

  async getCalls(
    receivedOnOrAfter: string,
    receivedBefore?: string
  ): Promise<any[]> {
    const allCalls: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        receivedOnOrAfter: `${receivedOnOrAfter}T00:00:00Z`,
        pageSize: '200',
        page: page.toString(),
      };

      if (receivedBefore) {
        params.receivedBefore = `${receivedBefore}T00:00:00Z`;
      }

      const response = await this.request<{
        data: any[];
        hasMore: boolean;
      }>('GET', `telecom/v2/tenant/${this.tenantId}/calls`, { params });

      allCalls.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      if (page > 100) break;
    }

    return allCalls;
  }
}

const stClient = new STCallsClient();

function parseDuration(duration: string | number | null): number | null {
  if (duration === null || duration === undefined) return null;
  if (typeof duration === 'number') return duration;

  // Handle PT format (e.g., PT5M30S)
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

  // Handle HH:MM:SS format
  const parts = duration.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }

  return parseInt(duration, 10) || null;
}

/**
 * POST /api/leads/sync/st-calls
 * Sync ServiceTitan calls to st_calls table
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

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '90');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const nextDay = new Date(endDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDateStrExclusive = nextDay.toISOString().split('T')[0];

  try {
    if (!stClient.isConfigured()) {
      return NextResponse.json(
        { error: 'ServiceTitan API not configured' },
        { status: 500 }
      );
    }

    console.log(`[ST Calls Sync] Fetching calls from ${startDateStr} to ${endDateStr}`);
    const calls = await stClient.getCalls(startDateStr, endDateStrExclusive);
    console.log(`[ST Calls Sync] Fetched ${calls.length} calls from ServiceTitan`);

    let synced = 0;
    let errors = 0;

    for (const call of calls) {
      const callData = {
        st_call_id: call.id?.toString(),
        direction: call.direction || 'Unknown',
        call_type: call.callType || call.type?.name || null,
        duration_seconds: parseDuration(call.duration),
        customer_id: call.customer?.id || null,
        job_id: call.job?.id || null,
        booking_id: call.booking?.id || null,
        from_phone: call.from || null,
        to_phone: call.to || null,
        tracking_number: call.to || null, // The "to" number is typically the tracking number
        campaign_id: call.campaign?.id || null,
        campaign_name: call.campaign?.name || null,
        agent_id: call.agent?.id || call.createdBy?.id || null,
        agent_name: call.agent?.name || call.createdBy?.name || null,
        recording_url: call.recordingUrl || null,
        business_unit_id: null, // Not directly available, would need job lookup
        business_unit_name: null,
        received_at: call.receivedOn,
        answered_at: null, // Would need additional calculation
        ended_at: null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!callData.st_call_id || !callData.received_at) {
        console.warn('[ST Calls Sync] Skipping call with missing ID or receivedOn');
        continue;
      }

      const { error } = await supabase
        .from('st_calls')
        .upsert(callData, { onConflict: 'st_call_id' });

      if (error) {
        console.error(`[ST Calls Sync] Error upserting call ${call.id}:`, error.message);
        errors++;
      } else {
        synced++;
      }
    }

    console.log(`[ST Calls Sync] Synced ${synced} calls, ${errors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        dateRange: { start: startDateStr, end: endDateStr },
        callsFromApi: calls.length,
        callsSynced: synced,
        errors,
      },
    });
  } catch (error: any) {
    console.error('[ST Calls Sync] Failed:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/sync/st-calls
 * Get ST calls sync status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [countResult, latestSync, dateRange] = await Promise.all([
      supabase.from('st_calls').select('id', { count: 'exact', head: true }),
      supabase
        .from('st_calls')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1),
      supabase
        .from('st_calls')
        .select('received_at')
        .order('received_at', { ascending: false })
        .limit(1),
    ]);

    const [earliest] = await Promise.all([
      supabase
        .from('st_calls')
        .select('received_at')
        .order('received_at', { ascending: true })
        .limit(1),
    ]);

    return NextResponse.json({
      totalCalls: countResult.count || 0,
      lastSyncedAt: latestSync.data?.[0]?.synced_at || null,
      dateRange: {
        earliest: earliest.data?.[0]?.received_at || null,
        latest: dateRange.data?.[0]?.received_at || null,
      },
    });
  } catch (error: any) {
    console.error('Failed to get ST calls sync status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
