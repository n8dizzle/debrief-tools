/**
 * ServiceTitan API client for Membership Manager.
 * Adapted from AP Payments, focused on membership data syncing.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface STMembershipType {
  id: number;
  name: string;
  status: string;
  billingFrequency?: string;
  durationBillingPeriods?: number;
  serviceCount?: number;
}

export interface STMembership {
  id: number;
  membershipTypeId: number;
  membershipTypeName?: string;
  status: string;
  from?: string;
  to?: string;
  nextScheduledBillingDate?: string;
  billingFrequency?: string;
  customerId: number;
  locationId: number;
  businessUnitId?: number;
}

export interface STRecurringService {
  id: number;
  membershipId: number;
  name: string;
  status: string;
  recurrenceType?: string;
  recurrenceInterval?: number;
  durationType?: string;
  nextServiceDate?: string;
  locationId: number;
}

export interface STRecurringServiceEvent {
  id: number;
  recurringServiceId: number;
  membershipId?: number;
  jobId?: number;
  name?: string;
  status: string;
  startsOn?: string;
  completedOn?: string;
  locationId?: number;
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

  /**
   * Fetch all pages of a paginated endpoint
   */
  private async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, string> = {},
    maxPages: number = 50
  ): Promise<T[]> {
    const allData: T[] = [];
    let page = 1;

    while (page <= maxPages) {
      const response = await this.request<STPagedResponse<T>>('GET', endpoint, {
        params: { ...params, page: String(page), pageSize: '200' },
      });

      allData.push(...(response.data || []));

      if (!response.hasMore) break;
      page++;
    }

    return allData;
  }

  /**
   * Get membership types (reference data)
   */
  async getMembershipTypes(): Promise<STMembershipType[]> {
    return this.fetchAllPages<STMembershipType>(
      `memberships/v2/tenant/${this.tenantId}/membership-types`
    );
  }

  /**
   * Get active memberships
   */
  async getMemberships(activeOnly: boolean = true): Promise<STMembership[]> {
    const params: Record<string, string> = {};
    if (activeOnly) {
      params.active = 'true';
    }
    return this.fetchAllPages<STMembership>(
      `memberships/v2/tenant/${this.tenantId}/memberships`,
      params
    );
  }

  /**
   * Get recurring services (what visits are included)
   */
  async getRecurringServices(activeOnly: boolean = true): Promise<STRecurringService[]> {
    const params: Record<string, string> = {};
    if (activeOnly) {
      params.active = 'true';
    }
    return this.fetchAllPages<STRecurringService>(
      `memberships/v2/tenant/${this.tenantId}/recurring-services`,
      params
    );
  }

  /**
   * Get recurring service events (individual visit instances)
   */
  async getRecurringServiceEvents(startsOnOrAfter?: string, startsOnOrBefore?: string): Promise<STRecurringServiceEvent[]> {
    const params: Record<string, string> = {};
    if (startsOnOrAfter) params.startsOnOrAfter = startsOnOrAfter;
    if (startsOnOrBefore) params.startsOnOrBefore = startsOnOrBefore;
    return this.fetchAllPages<STRecurringServiceEvent>(
      `memberships/v2/tenant/${this.tenantId}/recurring-service-events`,
      params
    );
  }

  /**
   * Get customer details
   */
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

  /**
   * Bulk fetch customers by IDs (up to 200 per page)
   */
  async getCustomersByIds(ids: number[]): Promise<STCustomer[]> {
    if (ids.length === 0) return [];
    const allCustomers: STCustomer[] = [];
    // ST API accepts comma-separated IDs, max ~50 per request to avoid URL length issues
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      try {
        const results = await this.fetchAllPages<STCustomer>(
          `crm/v2/tenant/${this.tenantId}/customers`,
          { ids: chunk.join(',') },
          5
        );
        allCustomers.push(...results);
      } catch (error) {
        console.error(`Failed to bulk fetch customers batch ${i}:`, error);
      }
    }
    return allCustomers;
  }

  /**
   * Get location details
   */
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
   * Bulk fetch locations by IDs
   */
  async getLocationsByIds(ids: number[]): Promise<STLocation[]> {
    if (ids.length === 0) return [];
    const allLocations: STLocation[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      try {
        const results = await this.fetchAllPages<STLocation>(
          `crm/v2/tenant/${this.tenantId}/locations`,
          { ids: chunk.join(',') },
          5
        );
        allLocations.push(...results);
      } catch (error) {
        console.error(`Failed to bulk fetch locations batch ${i}:`, error);
      }
    }
    return allLocations;
  }

  /**
   * Bulk fetch employees by IDs
   */
  async getEmployeesByIds(ids: number[]): Promise<{ id: number; name: string }[]> {
    if (ids.length === 0) return [];
    const allEmployees: { id: number; name: string }[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      try {
        const results = await this.fetchAllPages<{ id: number; name: string }>(
          `settings/v2/tenant/${this.tenantId}/employees`,
          { ids: chunk.join(',') },
          5
        );
        allEmployees.push(...results);
      } catch (error) {
        console.error(`Failed to bulk fetch employees batch ${i}:`, error);
      }
    }
    return allEmployees;
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

/**
 * Format location address into a single string
 */
export function formatAddress(location: STLocation): string {
  const addr = location.address;
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ');
}
