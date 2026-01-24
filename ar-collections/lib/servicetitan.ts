/**
 * ServiceTitan API client for AR Collections.
 * Extended from daily-dash implementation with AR-specific methods.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface STJob {
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
  tagTypeIds?: number[];
}

export interface STInvoice {
  id: number;
  invoiceNumber?: string;
  referenceNumber?: string;
  job?: { id: number; number?: string; type?: { name?: string } } | null;
  customer?: { id: number; name?: string; type?: string } | null;
  businessUnit?: { id: number; name?: string } | null;
  total: number;
  balance: number;
  summary?: string;
  createdOn?: string;
  dueDate?: string;
  status?: string;
  items?: STInvoiceItem[];
}

interface STInvoiceItem {
  id: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface STPayment {
  id: number;
  invoiceId?: number;
  customerId?: number;
  amount: number;
  date?: string;
  type?: { name?: string };
  status?: string;
}

export interface STCustomer {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  type?: string;
  balance?: number;
  doNotService?: boolean;
  active?: boolean;
  createdOn?: string;
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
    // Token expires in 15 minutes per ST docs
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
  // AR COLLECTIONS METHODS
  // ============================================

  /**
   * Get invoices with open balance
   * Fetches all invoices where balance > 0
   */
  async getOpenInvoices(options: {
    minBalance?: number;
    page?: number;
    pageSize?: number;
    createdOnOrAfter?: string;
  } = {}): Promise<{ invoices: STInvoice[]; hasMore: boolean; totalCount: number }> {
    const params: Record<string, string> = {
      page: (options.page || 1).toString(),
      pageSize: (options.pageSize || 100).toString(),
    };

    // Add date filter if provided
    if (options.createdOnOrAfter) {
      params.createdOnOrAfter = options.createdOnOrAfter;
    }

    const response = await this.request<STPagedResponse<STInvoice>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params }
    );

    const allInvoices = response.data || [];

    // Filter for invoices with balance > 0 (using parseFloat for safety)
    let invoices = allInvoices.filter(inv => parseFloat(String(inv.balance)) > 0);

    // Log counts for debugging
    console.log(`Page ${options.page || 1}: ${allInvoices.length} invoices, ${invoices.length} with balance > 0`);

    // Additional filter by minimum balance if specified
    if (options.minBalance && options.minBalance > 0) {
      invoices = invoices.filter(inv => parseFloat(String(inv.balance)) >= options.minBalance!);
    }

    return {
      invoices,
      hasMore: response.hasMore,
      totalCount: response.totalCount,
    };
  }

  /**
   * Get all open invoices (paginated fetch)
   * Handles pagination automatically to get all invoices
   * Fetches invoices from the last 90 days where open AR balances typically exist
   */
  async getAllOpenInvoices(minBalance: number = 0): Promise<STInvoice[]> {
    const allInvoices: STInvoice[] = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    // Fetch invoices from last 90 days (where open balances are likely)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateFilter = ninetyDaysAgo.toISOString().split('T')[0];

    console.log(`Fetching invoices since ${dateFilter}...`);

    while (hasMore) {
      const result = await this.getOpenInvoices({
        page,
        pageSize,
        minBalance,
        createdOnOrAfter: dateFilter,
      });
      allInvoices.push(...result.invoices);
      hasMore = result.hasMore;
      page++;

      // Safety limit - max 30 pages (3,000 invoices)
      if (page > 30) {
        console.warn('Hit pagination limit of 30 pages');
        break;
      }

      // Rate limiting between pages
      if (hasMore) {
        await this.delay(200);
      }
    }

    console.log(`Total invoices with balance > 0: ${allInvoices.length}`);
    return allInvoices;
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(invoiceId: number): Promise<STInvoice | null> {
    try {
      const response = await this.request<STInvoice>(
        'GET',
        `accounting/v2/tenant/${this.tenantId}/invoices/${invoiceId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Get payments for a customer
   */
  async getCustomerPayments(
    customerId: number,
    options: {
      fromDate?: string;
      toDate?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{ payments: STPayment[]; hasMore: boolean }> {
    const params: Record<string, string> = {
      customerId: customerId.toString(),
      page: (options.page || 1).toString(),
      pageSize: (options.pageSize || 100).toString(),
    };

    if (options.fromDate) {
      params.createdOnOrAfter = `${options.fromDate}T00:00:00Z`;
    }
    if (options.toDate) {
      params.createdBefore = `${options.toDate}T23:59:59Z`;
    }

    const response = await this.request<STPagedResponse<STPayment>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/payments`,
      { params }
    );

    return {
      payments: response.data || [],
      hasMore: response.hasMore,
    };
  }

  /**
   * Get payments for an invoice
   */
  async getInvoicePayments(invoiceId: number): Promise<STPayment[]> {
    const params: Record<string, string> = {
      invoiceId: invoiceId.toString(),
      pageSize: '100',
    };

    const response = await this.request<STPagedResponse<STPayment>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/payments`,
      { params }
    );

    return response.data || [];
  }

  /**
   * Get a customer by ID
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
   * Get multiple customers by IDs
   */
  async getCustomers(customerIds: number[]): Promise<STCustomer[]> {
    if (customerIds.length === 0) return [];

    // ServiceTitan supports comma-separated IDs
    const params: Record<string, string> = {
      ids: customerIds.join(','),
      pageSize: '200',
    };

    try {
      const response = await this.request<STPagedResponse<STCustomer>>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/customers`,
        { params }
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to get customers:', error);
      return [];
    }
  }

  /**
   * Get job details
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
   * Post a note to a job in ServiceTitan
   * Used for syncing AR collection notes back to ST
   */
  async postJobNote(jobId: number, noteText: string): Promise<boolean> {
    try {
      await this.request(
        'POST',
        `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}/notes`,
        {
          body: {
            text: noteText,
          },
        }
      );
      return true;
    } catch (error) {
      console.error(`Failed to post note to job ${jobId}:`, error);
      return false;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get next day in YYYY-MM-DD format
   */
  private getNextDay(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
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
