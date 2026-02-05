import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to get env vars at runtime (not module load time)
function getSTConfig() {
  return {
    clientId: (process.env.ST_CLIENT_ID || '').trim(),
    clientSecret: (process.env.ST_CLIENT_SECRET || '').trim(),
    tenantId: (process.env.ST_TENANT_ID || '').trim(),
    appKey: (process.env.ST_APP_KEY || '').trim(),
  };
}

// ServiceTitan client for calls
class STCallsClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  isConfigured(): boolean {
    const config = getSTConfig();
    const configured = !!(config.clientId && config.clientSecret && config.tenantId && config.appKey);
    if (!configured) {
      console.log('[ST Calls] Missing config:', {
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasTenantId: !!config.tenantId,
        hasAppKey: !!config.appKey,
      });
    }
    return configured;
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
      const errorText = await response.text();
      console.error('[ST Auth] Failed:', response.status, errorText.slice(0, 200));
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

  async getCalls(
    receivedOnOrAfter: string,
    receivedBefore?: string,
    maxCalls: number = 5000 // Limit to prevent timeout
  ): Promise<any[]> {
    const config = getSTConfig();
    const allCalls: any[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`[ST Calls] Fetching calls from ${receivedOnOrAfter} to ${receivedBefore || 'now'}`);

    while (hasMore && allCalls.length < maxCalls) {
      const params: Record<string, string> = {
        createdOnOrAfter: `${receivedOnOrAfter}T00:00:00Z`,
        pageSize: '200',
        page: page.toString(),
      };

      if (receivedBefore) {
        params.createdBefore = `${receivedBefore}T00:00:00Z`;
      }

      console.log(`[ST Calls] Fetching page ${page}...`);
      const response = await this.request<{
        data: any[];
        hasMore: boolean;
        totalCount?: number;
      }>('GET', `telecom/v2/tenant/${config.tenantId}/calls`, { params });

      console.log(`[ST Calls] Page ${page}: got ${response.data?.length || 0} calls, hasMore=${response.hasMore}, total=${response.totalCount}`);

      allCalls.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      if (page > 100) break;
    }

    console.log(`[ST Calls] Total fetched: ${allCalls.length} calls`);
    return allCalls;
  }
}

const stClient = new STCallsClient();

// Normalize phone number to last 10 digits
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

// Determine trade from campaign name or call context
function getTradeFromCampaign(campaignName: string | null): string | null {
  if (!campaignName) return null;
  const lower = campaignName.toLowerCase();
  if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling') || lower.includes('ac ') || lower.includes('air')) {
    return 'HVAC';
  }
  if (lower.includes('plumb') || lower.includes('drain') || lower.includes('water')) {
    return 'Plumbing';
  }
  return null;
}

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
 * Supports both session auth (manual) and cron auth (scheduled)
 */
export async function POST(request: NextRequest) {
  // Check for cron secret (for scheduled jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // If not cron auth, check session
  if (!isCronAuth) {
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
  }

  const syncSource = isCronAuth ? 'cron' : 'manual';
  console.log(`[ST Calls Sync] Starting ${syncSource} sync at ${new Date().toISOString()}`);

  const { searchParams } = new URL(request.url);
  // Default to 7 days to avoid timeout (90 days = 98k+ calls = timeout)
  const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

  // Use local date components (Central Time) - not toISOString() which converts to UTC
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const startDateStr = formatLocalDate(startDate);
  const endDateStr = formatLocalDate(endDate);
  const nextDay = new Date(endDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDateStrExclusive = formatLocalDate(nextDay);

  console.log(`[ST Calls Sync] Date range: ${startDateStr} to ${endDateStrExclusive} (${days} days)`);

  try {
    if (!stClient.isConfigured()) {
      return NextResponse.json(
        { error: 'ServiceTitan API not configured' },
        { status: 500 }
      );
    }

    console.log(`[ST Calls Sync] Fetching calls from ${startDateStr} to ${endDateStrExclusive}`);

    let calls: any[];
    try {
      calls = await stClient.getCalls(startDateStr, endDateStrExclusive);
    } catch (fetchError: any) {
      console.error('[ST Calls Sync] Error fetching calls:', fetchError);
      return NextResponse.json({
        error: `Failed to fetch calls: ${fetchError.message}`,
        debug: { startDateStr, endDateStrExclusive, days }
      }, { status: 500 });
    }
    console.log(`[ST Calls Sync] Fetched ${calls.length} calls from ServiceTitan`);

    let synced = 0;
    let errors = 0;

    for (const callWrapper of calls) {
      // ST API v2 returns call data nested inside leadCall object
      const call = callWrapper.leadCall || callWrapper;

      const callData = {
        st_call_id: call.id?.toString(),
        direction: call.direction || 'Unknown',
        call_type: call.callType || callWrapper.type?.name || null,
        duration_seconds: parseDuration(call.duration),
        customer_id: call.customer?.id || null,
        job_id: callWrapper.jobNumber ? parseInt(callWrapper.jobNumber) : null,
        booking_id: call.booking?.id || null,
        from_phone: call.from || null,
        to_phone: call.to || null,
        tracking_number: call.to || null, // The "to" number is typically the tracking number
        campaign_id: call.campaign?.id || null,
        campaign_name: call.campaign?.name || null,
        agent_id: call.agent?.id || call.createdBy?.id || null,
        agent_name: call.agent?.name || call.createdBy?.name || null,
        recording_url: call.recordingUrl || null,
        business_unit_id: callWrapper.businessUnit?.id || null,
        business_unit_name: callWrapper.businessUnit?.name || null,
        received_at: call.receivedOn,
        answered_at: null, // Would need additional calculation
        ended_at: null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!callData.st_call_id || !callData.received_at) {
        console.warn('[ST Calls Sync] Skipping call with missing ID or receivedOn:', { id: call.id, receivedOn: call.receivedOn });
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

    // Phase 2: Reconcile ST calls into master_leads
    console.log('[ST Calls Sync] Starting reconciliation to master_leads...');

    let leadsCreated = 0;
    let leadsMatched = 0;
    let leadsSkipped = 0;

    // Get all synced inbound calls that aren't yet in master_leads
    const { data: unprocessedCalls } = await supabase
      .from('st_calls')
      .select('*')
      .eq('direction', 'Inbound')
      .gte('received_at', `${startDateStr}T00:00:00Z`)
      .lte('received_at', `${endDateStrExclusive}T00:00:00Z`);

    for (const call of unprocessedCalls || []) {
      // Check if this ST call is already linked to a master_lead
      const { data: existingLink } = await supabase
        .from('master_leads')
        .select('id')
        .eq('st_call_id', call.id)
        .single();

      if (existingLink) {
        leadsSkipped++;
        continue;
      }

      const normalizedPhone = normalizePhone(call.from_phone);
      const callTime = new Date(call.received_at);
      const timeBefore = new Date(callTime.getTime() - 15 * 60 * 1000); // 15 min before
      const timeAfter = new Date(callTime.getTime() + 15 * 60 * 1000);  // 15 min after

      // Try to match with existing LSA lead by phone + time correlation
      let matchedLead = null;
      if (normalizedPhone) {
        const { data: potentialMatches } = await supabase
          .from('master_leads')
          .select('*')
          .eq('phone_normalized', normalizedPhone)
          .is('st_call_id', null)
          .gte('lead_created_at', timeBefore.toISOString())
          .lte('lead_created_at', timeAfter.toISOString())
          .limit(1);

        if (potentialMatches && potentialMatches.length > 0) {
          matchedLead = potentialMatches[0];
        }
      }

      if (matchedLead) {
        // Link ST call to existing master_lead
        const { error: linkError } = await supabase
          .from('master_leads')
          .update({
            st_call_id: call.id,
            st_job_id: call.job_id,
            st_customer_id: call.customer_id,
            source_confidence: 95, // High confidence - phone + time match
            reconciliation_status: 'matched',
            is_booked: call.booking_id ? true : matchedLead.is_booked,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedLead.id);

        if (!linkError) {
          leadsMatched++;
          // Log the reconciliation
          await supabase.from('lead_reconciliation_log').insert({
            master_lead_id: matchedLead.id,
            st_call_id: call.id,
            match_type: 'phone_time',
            match_confidence: 95,
            matched_at: new Date().toISOString(),
          });
        }
      } else {
        // Create new master_lead from ST call
        const trade = getTradeFromCampaign(call.campaign_name);
        const isBooked = !!call.booking_id;

        const newLead = {
          st_call_id: call.id,
          original_source: 'st_call',
          original_source_id: call.st_call_id,
          primary_source: call.campaign_name ? 'campaign' : 'direct',
          primary_source_detail: call.campaign_name || 'Direct Call',
          source_confidence: 100,
          phone: call.from_phone,
          phone_normalized: normalizedPhone,
          lead_type: 'call',
          trade,
          lead_status: isBooked ? 'booked' : 'new',
          is_qualified: (call.duration_seconds || 0) >= 60, // Calls over 1 min are qualified
          is_booked: isBooked,
          is_completed: false,
          st_job_id: call.job_id,
          st_customer_id: call.customer_id,
          st_booking_id: call.booking_id,
          reconciliation_status: 'new',
          is_duplicate: false,
          lead_created_at: call.received_at,
        };

        const { error: insertError } = await supabase
          .from('master_leads')
          .insert(newLead);

        if (!insertError) {
          leadsCreated++;
        } else {
          console.error(`[ST Calls Sync] Error creating master_lead for call ${call.id}:`, insertError.message);
        }
      }
    }

    console.log(`[ST Calls Sync] Reconciliation: ${leadsCreated} created, ${leadsMatched} matched, ${leadsSkipped} skipped`);

    return NextResponse.json({
      success: true,
      summary: {
        dateRange: { start: startDateStr, end: endDateStrExclusive },
        callsFromApi: calls.length,
        callsSynced: synced,
        leadsCreated,
        leadsMatched,
        leadsSkipped,
        errors,
        debug: {
          days,
          configOk: stClient.isConfigured(),
        }
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
