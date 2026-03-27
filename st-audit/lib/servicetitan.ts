/**
 * ServiceTitan API client for Daily Audit.
 * Focused on data cleanliness queries.
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
  modifiedOn?: string;
  total?: number;
  summary?: string;
  tagTypeIds?: number[];
}

export interface STInvoice {
  id: number;
  invoiceNumber?: string;
  referenceNumber?: string;
  job?: { id: number; number?: string } | null;
  customer?: { id: number; name?: string } | null;
  businessUnit?: { id: number; name?: string } | null;
  total: number;
  balance: number;
  status?: string;
  summary?: string;
  createdOn?: string;
  invoiceDate?: string;
  modifiedOn?: string;
  adjustmentToId?: number | null;
  invoiceType?: string;
}

export type InvoiceStatus = 'Pending' | 'Posted' | 'Exported';

export interface STCustomer {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
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

interface STBusinessUnit {
  id: number;
  name: string;
  active: boolean;
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
   * Get open jobs (In Progress, Dispatched, Hold) - handles pagination.
   * Fetches jobs by status, optionally filtered by createdBefore.
   */
  async getOpenJobs(createdBefore?: string): Promise<STJob[]> {
    const statuses = ['InProgress', 'Dispatched', 'Hold'];
    const allJobs: STJob[] = [];

    for (const status of statuses) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params: Record<string, string> = {
          jobStatus: status,
          pageSize: '200',
          page: page.toString(),
        };

        if (createdBefore) {
          params.createdBefore = createdBefore;
        }

        const response = await this.request<STPagedResponse<STJob>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          { params }
        );

        allJobs.push(...(response.data || []));
        hasMore = response.hasMore;
        page++;

        if (page > 50) break;
      }
    }

    return allJobs;
  }

  /**
   * Get a customer by ID
   */
  async getCustomerById(customerId: number): Promise<STCustomer | null> {
    try {
      return await this.request<STCustomer>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}`
      );
    } catch {
      return null;
    }
  }

  /**
   * Get invoices by status (handles pagination).
   * Optionally filter by date range (createdOnOrAfter / createdBefore).
   */
  async getInvoicesByStatus(
    status?: InvoiceStatus,
    options?: { createdOnOrAfter?: string; createdBefore?: string; maxPages?: number }
  ): Promise<STInvoice[]> {
    const allInvoices: STInvoice[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = options?.maxPages ?? 100;

    while (hasMore) {
      const params: Record<string, string> = {
        pageSize: '200',
        page: page.toString(),
      };

      if (status) {
        params.status = status;
      }

      if (options?.createdOnOrAfter) {
        params.createdOnOrAfter = `${options.createdOnOrAfter}T00:00:00`;
      }

      if (options?.createdBefore) {
        params.createdBefore = `${options.createdBefore}T00:00:00`;
      }

      const response = await this.request<STPagedResponse<STInvoice>>(
        'GET',
        `accounting/v2/tenant/${this.tenantId}/invoices`,
        { params }
      );

      allInvoices.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      if (page > maxPages) break;
    }

    return allInvoices;
  }

  /**
   * Get invoice summary (count + first page) without fetching all pages.
   * Returns totalCount from API and the first page of invoices for sampling.
   */
  async getInvoiceSummaryByStatus(
    status: InvoiceStatus
  ): Promise<{ totalCount: number; firstPage: STInvoice[] }> {
    const params: Record<string, string> = {
      status,
      pageSize: '200',
      page: '1',
    };

    const response = await this.request<STPagedResponse<STInvoice>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params }
    );

    return {
      totalCount: response.totalCount,
      firstPage: response.data || [],
    };
  }

  /**
   * Get all non-exported invoices (Pending + Posted) with totals > 0.
   */
  async getNonExportedInvoices(): Promise<STInvoice[]> {
    const [pending, posted] = await Promise.all([
      this.getInvoicesByStatus('Pending'),
      this.getInvoicesByStatus('Posted'),
    ]);
    return [...pending, ...posted];
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
