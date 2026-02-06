/**
 * ServiceTitan API client for Job Tracker.
 * Simplified version focused on job and customer lookups.
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
  type?: string;
  active?: boolean;
}

export interface STLocation {
  id: number;
  name?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
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

// Business units for install jobs
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
    this.clientId = process.env.ST_CLIENT_ID || '';
    this.clientSecret = process.env.ST_CLIENT_SECRET || '';
    this.tenantId = process.env.ST_TENANT_ID || '';
    this.appKey = process.env.ST_APP_KEY || '';

    if (!this.clientId || !this.clientSecret || !this.tenantId || !this.appKey) {
      console.warn('ServiceTitan credentials not fully configured');
    }
  }

  /**
   * Get or refresh access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferTime = new Date(this.tokenExpiresAt.getTime() - 60000); // 1 min buffer
      if (now < bufferTime) {
        return this.accessToken;
      }
    }

    // Request new token
    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

  /**
   * Make authenticated API request
   */
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

  // ============================================
  // BUSINESS UNITS
  // ============================================

  /**
   * Get all business units (cached)
   */
  async getBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.businessUnitsCache) {
      return this.businessUnitsCache;
    }

    const response = await this.request<STPagedResponse<STBusinessUnit>>(
      'GET',
      `settings/v2/tenant/${this.tenantId}/business-units`,
      { params: { pageSize: '100', active: 'true' } }
    );

    this.businessUnitsCache = response.data || [];
    return this.businessUnitsCache;
  }

  /**
   * Get business unit IDs for install jobs (HVAC - Install, Plumbing - Install)
   */
  async getInstallBusinessUnitIds(): Promise<number[]> {
    const businessUnits = await this.getBusinessUnits();
    return businessUnits
      .filter(bu => INSTALL_BUSINESS_UNITS.includes(bu.name))
      .map(bu => bu.id);
  }

  /**
   * Get business unit name by ID
   */
  async getBusinessUnitName(businessUnitId: number): Promise<string | null> {
    const businessUnits = await this.getBusinessUnits();
    const bu = businessUnits.find(b => b.id === businessUnitId);
    return bu?.name || null;
  }

  /**
   * Determine trade from business unit ID
   */
  async getTradeFromBusinessUnit(businessUnitId: number): Promise<'hvac' | 'plumbing'> {
    const buName = await this.getBusinessUnitName(businessUnitId);
    if (buName?.toLowerCase().includes('plumb')) {
      return 'plumbing';
    }
    return 'hvac';
  }

  // ============================================
  // JOB TRACKER METHODS
  // ============================================

  /**
   * Get a job by ID
   */
  async getJob(jobId: number): Promise<STJob | null> {
    try {
      const response = await this.request<STJob>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get job by job number
   */
  async getJobByNumber(jobNumber: string): Promise<STJob | null> {
    try {
      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        { params: { number: jobNumber, pageSize: '1' } }
      );
      return response.data?.[0] || null;
    } catch (error) {
      console.error(`Failed to get job by number ${jobNumber}:`, error);
      return null;
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: number): Promise<STCustomer | null> {
    try {
      const response = await this.request<STCustomer>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get customer ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Get location by ID
   */
  async getLocation(locationId: number): Promise<STLocation | null> {
    try {
      const response = await this.request<STLocation>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/locations/${locationId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get location ${locationId}:`, error);
      return null;
    }
  }

  /**
   * Get recently completed install jobs (for auto-tracker creation)
   * Looks at jobs completed in the last N hours
   * Filters by business unit (HVAC - Install, Plumbing - Install)
   */
  async getRecentInstallJobs(hoursAgo: number = 24): Promise<STJob[]> {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const sinceStr = since.toISOString();

    try {
      // Get install business unit IDs
      const installBuIds = await this.getInstallBusinessUnitIds();
      console.log(`Install business unit IDs: ${installBuIds.join(', ')}`);

      if (installBuIds.length === 0) {
        console.warn('No install business units found');
        return [];
      }

      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        {
          params: {
            completedOnOrAfter: sinceStr,
            jobStatus: 'Completed',
            pageSize: '100',
          },
        }
      );

      console.log(`Found ${response.data?.length || 0} completed jobs in last ${hoursAgo} hours`);

      // Filter to install jobs by business unit ID
      const installJobs = (response.data || []).filter(job =>
        installBuIds.includes(job.businessUnitId)
      );

      console.log(`Found ${installJobs.length} install jobs`);

      return installJobs;
    } catch (error) {
      console.error('Failed to get recent install jobs:', error);
      return [];
    }
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }
}

// Singleton instance
let _client: ServiceTitanClient | null = null;

export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) {
    _client = new ServiceTitanClient();
  }
  return _client;
}

/**
 * Determine trade based on business unit name
 */
export function determineTrade(job: STJob): 'hvac' | 'plumbing' {
  const buName = job.businessUnitName?.toLowerCase() || '';

  if (buName.includes('plumb')) {
    return 'plumbing';
  }

  return 'hvac'; // Default to HVAC
}

/**
 * Determine job type from ST job
 */
export function determineJobType(job: STJob): 'install' | 'repair' | 'maintenance' | 'service' {
  const typeName = job.type?.name?.toLowerCase() || '';

  if (typeName.includes('install')) {
    return 'install';
  }
  if (typeName.includes('maintenance') || typeName.includes('tune')) {
    return 'maintenance';
  }
  if (typeName.includes('repair')) {
    return 'repair';
  }

  return 'service'; // Default to service
}
