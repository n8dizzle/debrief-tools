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
  scheduledOn?: string;
  total?: number;
  summary?: string;
  type?: { name?: string };
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

const INSTALL_BUSINESS_UNITS = [
  'HVAC - Install',
  'Plumbing - Install',
];

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

  async getInstallBusinessUnitIds(): Promise<number[]> {
    const businessUnits = await this.getBusinessUnits();
    return businessUnits
      .filter(bu => INSTALL_BUSINESS_UNITS.includes(bu.name))
      .map(bu => bu.id);
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
   * Get upcoming install jobs scheduled within the next N days.
   * Excludes completed and canceled jobs.
   */
  async getUpcomingInstallJobs(daysAhead: number = 30): Promise<STJob[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Use local time formatting, NOT toISOString() which converts to UTC
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;
    const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T23:59:59`;

    try {
      const installBuIds = await this.getInstallBusinessUnitIds();
      if (installBuIds.length === 0) {
        console.warn('No install business units found');
        return [];
      }

      // Fetch a single large page and filter client-side (avoid slow pagination)
      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        {
          params: {
            scheduledOnOrAfter: todayStr,
            scheduledOnOrBefore: futureStr,
            pageSize: '200',
          },
        }
      );

      const installJobs = (response.data || []).filter(job =>
        installBuIds.includes(job.businessUnitId) &&
        !['Canceled'].includes(job.jobStatus)
      );

      console.log(`Found ${installJobs.length} upcoming install jobs (from ${response.data?.length || 0} total)`);
      return installJobs;
    } catch (error) {
      console.error('Failed to get upcoming install jobs:', error);
      return [];
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
      const installBuIds = await this.getInstallBusinessUnitIds();
      if (installBuIds.length === 0) return [];

      // Fetch a single large page and filter client-side (avoid slow pagination)
      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        {
          params: {
            completedOnOrAfter: pastStr,
            completedOnOrBefore: todayStr,
            pageSize: '200',
          },
        }
      );

      const installJobs = (response.data || []).filter(job =>
        installBuIds.includes(job.businessUnitId)
      );

      console.log(`Found ${installJobs.length} recent install jobs (from ${response.data?.length || 0} total, last ${daysBehind} days)`);
      return installJobs;
    } catch (error) {
      console.error('Failed to get recent install jobs:', error);
      return [];
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
