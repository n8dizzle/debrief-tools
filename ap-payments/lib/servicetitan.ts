/**
 * ServiceTitan API client for AP Payments.
 * Adapted from job-tracker, focused on install job syncing.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface STJob {
  id: number;
  jobNumber: string;
  businessUnitId: number;
  businessUnitName?: string;
  jobTypeId: number;
  jobTypeName?: string;
  jobStatus: string;
  customerId: number;
  locationId: number;
  completedOn?: string;
  createdOn?: string;
  total?: number;
  summary?: string;
  type?: { name?: string };
  firstAppointmentId?: number;
}

export interface STAppointment {
  id: number;
  jobId: number;
  start?: string;
  end?: string;
  status?: string;
}

export interface STCustomer {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
}

export interface STLocation {
  id: number;
  name?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

export interface STBusinessUnit {
  id: number;
  name: string;
  active: boolean;
}

interface STPagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}


export class ServiceTitanClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';

  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private appKey: string;

  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private businessUnitsCache: STBusinessUnit[] | null = null;
  private jobTypesCache: Map<number, string> | null = null;

  constructor() {
    this.clientId = process.env.SERVICETITAN_CLIENT_ID || process.env.ST_CLIENT_ID || '';
    this.clientSecret = process.env.SERVICETITAN_CLIENT_SECRET || process.env.ST_CLIENT_SECRET || '';
    this.tenantId = process.env.SERVICETITAN_TENANT_ID || process.env.ST_TENANT_ID || '';
    this.appKey = process.env.SERVICETITAN_APP_KEY || process.env.ST_APP_KEY || '';
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

    const data: TokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 900) * 1000);
    return this.accessToken;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options: { params?: Record<string, string>; body?: unknown } = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    let url = `${this.BASE_URL}/${endpoint}`;
    if (options.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': this.appKey,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ST API error ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json();
  }

  async getBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.businessUnitsCache) return this.businessUnitsCache;

    const response = await this.request<STPagedResponse<STBusinessUnit>>(
      'GET',
      `settings/v2/tenant/${this.tenantId}/business-units`,
      { params: { pageSize: '100', active: 'true' } }
    );

    this.businessUnitsCache = response.data || [];
    return this.businessUnitsCache;
  }

  /**
   * Get all job types and build a lookup map (id → name).
   * Cached for the lifetime of the client instance.
   */
  async getJobTypes(): Promise<Map<number, string>> {
    if (this.jobTypesCache) return this.jobTypesCache;

    try {
      const response = await this.request<STPagedResponse<{ id: number; name: string }>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/job-types`,
        { params: { pageSize: '200' } }
      );

      const map = new Map<number, string>();
      for (const jt of response.data || []) {
        map.set(jt.id, jt.name);
      }
      console.log(`Fetched ${map.size} job types`);
      this.jobTypesCache = map;
      return map;
    } catch (error) {
      console.error('Failed to fetch job types:', error);
      return new Map();
    }
  }

  async getBusinessUnitName(businessUnitId: number): Promise<string | null> {
    const businessUnits = await this.getBusinessUnits();
    const bu = businessUnits.find(b => b.id === businessUnitId);
    return bu?.name || null;
  }

  async getTradeFromBusinessUnit(businessUnitId: number): Promise<'hvac' | 'plumbing'> {
    const buName = await this.getBusinessUnitName(businessUnitId);
    if (buName?.toLowerCase().includes('plumb')) return 'plumbing';
    return 'hvac';
  }

  async getJob(jobId: number): Promise<STJob | null> {
    try {
      return await this.request<STJob>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  async getInvoice(invoiceId: number): Promise<any | null> {
    try {
      return await this.request<any>(
        'GET',
        `accounting/v2/tenant/${this.tenantId}/invoices/${invoiceId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get invoice ${invoiceId}:`, error);
      return null;
    }
  }

  async getCustomer(customerId: number): Promise<STCustomer | null> {
    try {
      return await this.request<STCustomer>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get customer ${customerId}:`, error);
      return null;
    }
  }

  async getLocation(locationId: number): Promise<STLocation | null> {
    try {
      return await this.request<STLocation>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/locations/${locationId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get location ${locationId}:`, error);
      return null;
    }
  }

  /**
   * Get upcoming install appointments scheduled within the next N days,
   * then return the associated jobs. ST jobs don't have scheduledOn —
   * scheduled dates live on appointments.
   */
  async getUpcomingInstallJobs(daysAhead: number = 30): Promise<{ jobs: STJob[]; appointmentMap: Map<number, string> }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;
    const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T23:59:59`;

    try {
      // Fetch appointments from ALL active BUs (ST appointments API requires a BU param)
      const allBUs = await this.getBusinessUnits();
      const activeBuIds = allBUs.filter(bu => bu.active).map(bu => bu.id);
      if (activeBuIds.length === 0) {
        console.warn('No active business units found');
        return { jobs: [], appointmentMap: new Map() };
      }

      const results = await Promise.allSettled(
        activeBuIds.map(buId =>
          this.request<STPagedResponse<STAppointment>>(
            'GET',
            `jpm/v2/tenant/${this.tenantId}/appointments`,
            {
              params: {
                startsOnOrAfter: todayStr,
                startsBefore: futureStr,
                businessUnitId: buId.toString(),
                pageSize: '200',
              },
            }
          )
        )
      );

      // Build jobId → earliest appointment start map
      const appointmentMap = new Map<number, string>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const appt of (result.value.data || [])) {
            if (appt.jobId && appt.start) {
              const existing = appointmentMap.get(appt.jobId);
              if (!existing || appt.start < existing) {
                appointmentMap.set(appt.jobId, appt.start);
              }
            }
          }
        }
      }

      console.log(`Found ${appointmentMap.size} upcoming jobs from appointments across ${activeBuIds.length} BUs`);

      // Fetch the actual jobs for these appointment job IDs
      const jobIds = Array.from(appointmentMap.keys());
      if (jobIds.length === 0) return { jobs: [], appointmentMap };

      // Fetch jobs in batches of 50 using the ids param
      const jobs: STJob[] = [];
      const batchSize = 50;
      for (let i = 0; i < jobIds.length; i += batchSize) {
        const batch = jobIds.slice(i, i + batchSize);
        const response = await this.request<STPagedResponse<STJob>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          {
            params: {
              ids: batch.join(','),
              pageSize: '50',
            },
          }
        );
        const filtered = (response.data || []).filter(
          job => !['Canceled'].includes(job.jobStatus)
        );
        jobs.push(...filtered);
      }

      return { jobs, appointmentMap };
    } catch (error) {
      console.error('Failed to get upcoming install jobs:', error);
      return { jobs: [], appointmentMap: new Map() };
    }
  }

  /**
   * Get recently completed install jobs from last N days.
   * Used for backfill and catching newly completed jobs.
   */
  async getRecentInstallJobs(daysBehind: number = 7): Promise<STJob[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 0);

    const pastDate = new Date(today.getTime() - daysBehind * 24 * 60 * 60 * 1000);
    pastDate.setHours(0, 0, 0, 0);

    const pastStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}T00:00:00`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;

    try {
      // Fetch ALL completed jobs without BU filter, paginated
      const allJobs = await this.requestAllPages<STJob>(
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        {
          completedOnOrAfter: pastStr,
          completedOnOrBefore: todayStr,
        }
      );

      console.log(`Found ${allJobs.length} recent jobs (last ${daysBehind} days)`);
      return allJobs;
    } catch (error) {
      console.error('Failed to get recent install jobs:', error);
      return [];
    }
  }

  /**
   * Get all install jobs and appointments since a given date (for backfill).
   * Fetches both completed jobs and appointments to cover all jobs in the range.
   */
  async getInstallJobsSince(
    startDate: string,
    endDate?: string
  ): Promise<{ jobs: STJob[]; appointmentMap: Map<number, string> }> {
    const today = new Date();
    const endStr = endDate
      ? `${endDate}T23:59:59`
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;
    const startStr = `${startDate}T00:00:00`;

    // Fetch appointments from ALL active BUs (ST appointments API requires a BU param)
    const allBUs = await this.getBusinessUnits();
    const activeBuIds = allBUs.filter(bu => bu.active).map(bu => bu.id);

    const apptResults = await Promise.allSettled(
      activeBuIds.map(buId =>
        this.requestAllPages<STAppointment>(
          `jpm/v2/tenant/${this.tenantId}/appointments`,
          {
            startsOnOrAfter: startStr,
            startsBefore: endStr,
            businessUnitId: buId.toString(),
          }
        )
      )
    );

    const appointmentMap = new Map<number, string>();
    for (const result of apptResults) {
      if (result.status === 'fulfilled') {
        for (const appt of result.value) {
          if (appt.jobId && appt.start) {
            const existing = appointmentMap.get(appt.jobId);
            if (!existing || appt.start < existing) {
              appointmentMap.set(appt.jobId, appt.start);
            }
          }
        }
      }
    }

    // Fetch ALL completed jobs in the date range (no BU filter)
    const allJobs = await this.requestAllPages<STJob>(
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      {
        completedOnOrAfter: startStr,
        completedOnOrBefore: endStr,
      }
    );

    const jobMap = new Map<number, STJob>();
    for (const job of allJobs) {
      if (!['Canceled'].includes(job.jobStatus)) {
        jobMap.set(job.id, job);
      }
    }

    // Also fetch jobs referenced by appointments but not yet completed
    const apptJobIds = Array.from(appointmentMap.keys()).filter(id => !jobMap.has(id));
    if (apptJobIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < apptJobIds.length; i += batchSize) {
        const batch = apptJobIds.slice(i, i + batchSize);
        try {
          const response = await this.request<STPagedResponse<STJob>>(
            'GET',
            `jpm/v2/tenant/${this.tenantId}/jobs`,
            { params: { ids: batch.join(','), pageSize: '50' } }
          );
          for (const job of (response.data || [])) {
            if (!['Canceled'].includes(job.jobStatus)) {
              jobMap.set(job.id, job);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch job batch:`, err);
        }
      }
    }

    const jobs = Array.from(jobMap.values());
    console.log(`Backfill: Found ${jobs.length} jobs and ${appointmentMap.size} appointments since ${startDate}`);
    return { jobs, appointmentMap };
  }

  /**
   * Paginate through all results for an endpoint.
   */
  private async requestAllPages<T>(endpoint: string, params: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.request<STPagedResponse<T>>(
        'GET',
        endpoint,
        { params: { ...params, pageSize: '200', page: page.toString() } }
      );
      all.push(...(response.data || []));
      hasMore = response.hasMore === true;
      page++;
      if (page > 20) break; // Safety limit
    }

    return all;
  }

  /**
   * Get appointment details for a job (to extract scheduled date)
   */
  async getAppointment(appointmentId: number): Promise<STAppointment | null> {
    try {
      return await this.request<STAppointment>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/appointments/${appointmentId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get appointment ${appointmentId}:`, error);
      return null;
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }
}

let _client: ServiceTitanClient | null = null;

export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) {
    _client = new ServiceTitanClient();
  }
  return _client;
}

export function determineTrade(job: STJob): 'hvac' | 'plumbing' {
  const buName = job.businessUnitName?.toLowerCase() || '';
  if (buName.includes('plumb')) return 'plumbing';
  return 'hvac';
}

/**
 * Format location address into a single string
 */
export function formatAddress(location: STLocation): string {
  const addr = location.address;
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ');
}
