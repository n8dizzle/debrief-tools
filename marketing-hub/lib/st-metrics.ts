/**
 * ServiceTitan metrics helper for GBP location performance.
 * Fetches call and revenue data from st_calls table and ServiceTitan API
 * to show actual business impact alongside GBP metrics.
 */

import { createClient } from '@supabase/supabase-js';

// Types
export interface STLocationMetrics {
  locationId: string;
  trackingPhone: string;
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
  tracking_number: string | null;
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
 * Normalize phone number to digits only for matching
 */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}

/**
 * Format date for Supabase queries (YYYY-MM-DD)
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get ServiceTitan call and revenue metrics for GBP locations.
 *
 * @param locations - Array of locations with their tracking phone numbers
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Map of locationId -> metrics
 */
export async function getSTMetricsForLocations(
  locations: Array<{ id: string; tracking_phone: string | null }>,
  startDate: string,
  endDate: string
): Promise<Map<string, STLocationMetrics>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const metricsMap = new Map<string, STLocationMetrics>();

  // Filter to locations with tracking phones
  const locationsWithPhones = locations.filter(loc => loc.tracking_phone);

  if (locationsWithPhones.length === 0) {
    console.log('[ST Metrics] No locations have tracking phones configured');
    return metricsMap;
  }

  // Build map of normalized tracking numbers to location IDs
  const phoneToLocationId = new Map<string, string>();
  for (const loc of locationsWithPhones) {
    const normalized = normalizePhone(loc.tracking_phone);
    if (normalized) {
      phoneToLocationId.set(normalized, loc.id);
      // Also map last 10 digits in case tracking_number in st_calls is stored differently
      if (normalized.length > 10) {
        phoneToLocationId.set(normalized.slice(-10), loc.id);
      }
    }
  }

  // Initialize metrics for all locations with phones
  for (const loc of locationsWithPhones) {
    metricsMap.set(loc.id, {
      locationId: loc.id,
      trackingPhone: loc.tracking_phone!,
      callsBooked: 0,
      callsTotal: 0,
      revenue: 0,
      avgTicket: 0,
      jobCount: 0,
    });
  }

  // Build list of tracking numbers to query
  const trackingNumbers = Array.from(phoneToLocationId.keys());

  // Query st_calls for inbound calls to these tracking numbers in date range
  const { data: calls, error } = await supabase
    .from('st_calls')
    .select('id, job_id, call_type, tracking_number, received_at')
    .eq('direction', 'Inbound')
    .gte('received_at', `${startDate}T00:00:00`)
    .lt('received_at', `${endDate}T23:59:59`);

  if (error) {
    console.error('[ST Metrics] Failed to fetch calls:', error);
    return metricsMap;
  }

  if (!calls || calls.length === 0) {
    console.log('[ST Metrics] No inbound calls found in date range');
    return metricsMap;
  }

  // Group calls by location
  const callsByLocation = new Map<string, STCall[]>();

  for (const call of calls) {
    const normalizedTracking = normalizePhone(call.tracking_number);
    if (!normalizedTracking) continue;

    // Try to find matching location ID
    let locationId = phoneToLocationId.get(normalizedTracking);
    if (!locationId && normalizedTracking.length > 10) {
      locationId = phoneToLocationId.get(normalizedTracking.slice(-10));
    }
    if (!locationId && normalizedTracking.length === 10) {
      // Also check if any tracking number ends with this
      for (const [phone, locId] of phoneToLocationId.entries()) {
        if (phone.endsWith(normalizedTracking)) {
          locationId = locId;
          break;
        }
      }
    }

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
