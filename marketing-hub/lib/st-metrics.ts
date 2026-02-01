/**
 * ServiceTitan metrics helper for GBP location performance.
 * Fetches call and revenue data from st_calls table and ServiceTitan API
 * to show actual business impact alongside GBP metrics.
 *
 * Matches calls by campaign_name (e.g., "GBP - Argyle") for accurate attribution.
 */

import { createClient } from '@supabase/supabase-js';

// Types
export interface STLocationMetrics {
  locationId: string;
  campaignName: string;
  callsBooked: number;
  callsTotal: number;
  revenue: number;
  avgTicket: number;
  jobCount: number;
}

interface STCall {
  id: string;
  job_id: number | null;
  call_type: string | null;
  campaign_name: string | null;
  received_at: string;
}

// ServiceTitan API client for fetching job data
class STClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  private get config() {
    return {
      clientId: (process.env.ST_CLIENT_ID || '').trim(),
      clientSecret: (process.env.ST_CLIENT_SECRET || '').trim(),
      tenantId: (process.env.ST_TENANT_ID || '').trim(),
      appKey: (process.env.ST_APP_KEY || '').trim(),
    };
  }

  isConfigured(): boolean {
    const { clientId, clientSecret, tenantId, appKey } = this.config;
    return !!(clientId && clientSecret && tenantId && appKey);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferTime = new Date(this.tokenExpiresAt.getTime() - 60000);
      if (now < bufferTime) {
        return this.accessToken;
      }
    }

    const { clientId, clientSecret } = this.config;
    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
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
        'ST-App-Key': this.config.appKey,
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
   * Get a single job by ID
   */
  async getJobById(jobId: number): Promise<{ id: number; total?: number; jobStatus?: string } | null> {
    try {
      const { tenantId } = this.config;
      return await this.request('GET', `jpm/v2/tenant/${tenantId}/jobs/${jobId}`);
    } catch {
      return null;
    }
  }

  /**
   * Get multiple jobs by IDs (batched)
   */
  async getJobsByIds(jobIds: number[]): Promise<Map<number, { id: number; total: number; jobStatus: string }>> {
    const jobMap = new Map<number, { id: number; total: number; jobStatus: string }>();

    // Fetch in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(id => this.getJobById(id))
      );
      results.forEach((job, idx) => {
        if (job) {
          jobMap.set(batch[idx], {
            id: job.id,
            total: job.total || 0,
            jobStatus: job.jobStatus || 'Unknown',
          });
        }
      });
    }

    return jobMap;
  }
}

// Singleton client
const stClient = new STClient();

/**
 * Get ServiceTitan call and revenue metrics for GBP locations.
 * Matches calls by campaign_name for accurate attribution.
 *
 * @param locations - Array of locations with their ST campaign names
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Map of locationId -> metrics
 */
export async function getSTMetricsForLocations(
  locations: Array<{ id: string; st_campaign_name: string | null }>,
  startDate: string,
  endDate: string
): Promise<Map<string, STLocationMetrics>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const metricsMap = new Map<string, STLocationMetrics>();

  // Filter to locations with campaign names
  const locationsWithCampaigns = locations.filter(loc => loc.st_campaign_name);

  if (locationsWithCampaigns.length === 0) {
    console.log('[ST Metrics] No locations have ST campaign names configured');
    return metricsMap;
  }

  // Build map of campaign name to location ID
  const campaignToLocationId = new Map<string, string>();
  for (const loc of locationsWithCampaigns) {
    campaignToLocationId.set(loc.st_campaign_name!, loc.id);
  }

  // Initialize metrics for all locations with campaigns
  for (const loc of locationsWithCampaigns) {
    metricsMap.set(loc.id, {
      locationId: loc.id,
      campaignName: loc.st_campaign_name!,
      callsBooked: 0,
      callsTotal: 0,
      revenue: 0,
      avgTicket: 0,
      jobCount: 0,
    });
  }

  // Get list of campaign names to query
  const campaignNames = locationsWithCampaigns.map(loc => loc.st_campaign_name!);

  // Query st_calls for inbound calls with matching campaign names in date range
  const { data: calls, error } = await supabase
    .from('st_calls')
    .select('id, job_id, call_type, campaign_name, received_at')
    .eq('direction', 'Inbound')
    .in('campaign_name', campaignNames)
    .gte('received_at', `${startDate}T00:00:00`)
    .lt('received_at', `${endDate}T23:59:59`);

  if (error) {
    console.error('[ST Metrics] Failed to fetch calls:', error);
    return metricsMap;
  }

  if (!calls || calls.length === 0) {
    console.log('[ST Metrics] No inbound calls found in date range for configured campaigns');
    return metricsMap;
  }

  console.log(`[ST Metrics] Found ${calls.length} inbound calls for ${campaignNames.length} campaigns`);

  // Group calls by location
  const callsByLocation = new Map<string, STCall[]>();

  for (const call of calls) {
    if (!call.campaign_name) continue;

    const locationId = campaignToLocationId.get(call.campaign_name);
    if (locationId) {
      const existing = callsByLocation.get(locationId) || [];
      existing.push(call);
      callsByLocation.set(locationId, existing);
    }
  }

  // Process each location's calls
  const allJobIds: number[] = [];
  const jobToLocationMap = new Map<number, string[]>();

  for (const [locationId, locationCalls] of callsByLocation.entries()) {
    const metrics = metricsMap.get(locationId)!;
    metrics.callsTotal = locationCalls.length;

    // Count booked calls and collect job IDs
    for (const call of locationCalls) {
      if (call.call_type === 'Booked') {
        metrics.callsBooked++;

        if (call.job_id) {
          allJobIds.push(call.job_id);
          const existing = jobToLocationMap.get(call.job_id) || [];
          existing.push(locationId);
          jobToLocationMap.set(call.job_id, existing);
        }
      }
    }
  }

  // Fetch job totals from ServiceTitan if we have job IDs and client is configured
  if (allJobIds.length > 0 && stClient.isConfigured()) {
    const uniqueJobIds = [...new Set(allJobIds)];
    console.log(`[ST Metrics] Fetching ${uniqueJobIds.length} jobs from ServiceTitan`);

    try {
      const jobsMap = await stClient.getJobsByIds(uniqueJobIds);

      // Sum revenue by location
      for (const [jobId, job] of jobsMap.entries()) {
        // Only count completed jobs for revenue
        if (job.jobStatus === 'Completed') {
          const locationIds = jobToLocationMap.get(jobId) || [];
          for (const locationId of locationIds) {
            const metrics = metricsMap.get(locationId);
            if (metrics) {
              metrics.revenue += job.total || 0;
              metrics.jobCount++;
            }
          }
        }
      }

      // Calculate average ticket for each location
      for (const metrics of metricsMap.values()) {
        if (metrics.jobCount > 0) {
          metrics.avgTicket = metrics.revenue / metrics.jobCount;
        }
      }
    } catch (err) {
      console.error('[ST Metrics] Failed to fetch jobs from ServiceTitan:', err);
    }
  } else if (allJobIds.length > 0) {
    console.log('[ST Metrics] ServiceTitan client not configured, skipping job fetch');
  }

  console.log(`[ST Metrics] Processed ${callsByLocation.size} locations with calls`);

  return metricsMap;
}
