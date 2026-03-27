/**
 * ServiceTitan API client for Labor Dashboard.
 * Focused on payroll data: gross pay items, adjustments, and employees.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface STPagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export interface STGrossPayItem {
  id: number | null;
  payrollId?: number;
  employeeId: number;
  employeeName?: string;
  employeeType?: string;
  grossPayItemType?: string; // 'TimesheetTime', 'InvoiceRelatedBonus', etc.
  date?: string;
  startedOn?: string;
  endedOn?: string;
  amount?: number;
  paidDurationHours?: number;
  paidTimeType?: string; // 'Regular', 'Overtime'
  activity?: string;
  jobId?: number;
  jobNumber?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  customerId?: number;
  customerName?: string;
  jobTypeName?: string;
  businessUnitId?: number;
  businessUnitName?: string;
}

export interface STPayrollAdjustment {
  id: number;
  employeeId: number;
  employeeName?: string;
  type?: string;
  amount?: number;
  date?: string;
  memo?: string;
}

export interface STTechnician {
  id: number;
  name: string;
  active: boolean;
  businessUnitId?: number;
}

export interface STBusinessUnit {
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
      if (page > 50) break; // Safety limit (higher for payroll data which can be large)
    }

    return all;
  }

  async getAllBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.businessUnitsCache) return this.businessUnitsCache;

    const [activeRes, inactiveRes] = await Promise.all([
      this.request<STPagedResponse<STBusinessUnit>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: '200', active: 'true' } }
      ),
      this.request<STPagedResponse<STBusinessUnit>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: '200', active: 'false' } }
      ),
    ]);

    const all = [...(activeRes.data || []), ...(inactiveRes.data || [])];
    this.businessUnitsCache = all;
    return all;
  }

  /**
   * Fetch ALL gross pay items for a date range.
   * This is the primary data source — contains hourly pay, overtime, and commission data.
   */
  async getGrossPayItemsFull(startDate: string, endDate: string): Promise<STGrossPayItem[]> {
    const items = await this.requestAllPages<STGrossPayItem>(
      `payroll/v2/tenant/${this.tenantId}/gross-pay-items`,
      {
        startedOnOrAfter: `${startDate}T00:00:00`,
        startedOnOrBefore: `${endDate}T23:59:59`,
      }
    );

    console.log(`Fetched ${items.length} gross pay items (${startDate} to ${endDate})`);
    return items;
  }

  /**
   * Fetch payroll adjustments (spiffs, bonuses) for a date range.
   */
  async getPayrollAdjustments(startDate: string, endDate: string): Promise<STPayrollAdjustment[]> {
    try {
      const items = await this.requestAllPages<STPayrollAdjustment>(
        `payroll/v2/tenant/${this.tenantId}/payroll-adjustments`,
        {
          startedOnOrAfter: `${startDate}T00:00:00`,
          startedOnOrBefore: `${endDate}T23:59:59`,
        }
      );

      console.log(`Fetched ${items.length} payroll adjustments (${startDate} to ${endDate})`);
      return items;
    } catch (error) {
      console.error('Failed to fetch payroll adjustments:', error);
      return [];
    }
  }

  /**
   * Fetch all technicians (employees).
   */
  async getTechnicians(activeOnly: boolean = false): Promise<STTechnician[]> {
    const allTechnicians: STTechnician[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        pageSize: '200',
        page: page.toString(),
      };

      if (activeOnly) {
        params.active = 'true';
      }

      const response = await this.request<STPagedResponse<STTechnician>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/technicians`,
        { params }
      );

      allTechnicians.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      if (page > 20) break;
    }

    return allTechnicians;
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
