/**
 * ServiceTitan API client for Payroll Tracker.
 * Focused on payroll/timesheet data syncing.
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

export interface STTechnician {
  id: number;
  name: string;
  active: boolean;
  businessUnitId?: number;
}

export interface STEmployee {
  id: number;
  name: string;
  email?: string;
  active: boolean;
  role?: string;
  businessUnitId?: number;
}

export interface STBusinessUnit {
  id: number;
  name: string;
  active: boolean;
}

export interface STPayrollPeriod {
  id: number;
  startedOn: string;
  endedOn: string;
  employeeId: number;
  employeeType?: string;
  status: string;
  burdenRate?: number;
  managerApprovedOn?: string | null;
  createdOn?: string;
  modifiedOn?: string;
  active?: boolean;
}

export interface STGrossPayItemFlat {
  id: number | null;
  employeeId: number;
  employeeType?: string;
  businessUnitName?: string;
  payrollId?: number;
  employeePayrollId?: number | null;
  date: string;
  activity?: string;
  activityCodeId?: number | null;
  activityCode?: string | null;
  amount: number;
  grossPayItemType?: string;
  startedOn?: string;
  endedOn?: string;
  paidDurationHours: number;
  paidTimeType: string;
  jobId?: number;
  jobNumber?: string | null;
  jobTypeName?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  memo?: string | null;
  createdOn?: string;
  modifiedOn?: string;
}

export interface STJobTimesheet {
  id: number;
  employeeId: number;
  employeeType?: string;
  jobId?: number;
  jobNumber?: string;
  startedOn: string;
  endedOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  active?: boolean;
}

export interface STNonJobTimesheet {
  id: number;
  employeeId: number;
  employeeType?: string;
  timesheetCodeId?: number;
  startedOn: string;
  endedOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  active?: boolean;
}

export interface STTimesheetCode {
  id: number;
  name: string;
  description?: string;
}

export interface STPayrollAdjustment {
  id: number;
  employeeId: number;
  payrollId?: number;
  adjustmentTypeId?: number;
  adjustmentTypeName?: string;
  amount: number;
  memo?: string;
  date?: string;
  activity?: string;
}

export interface STJobSplit {
  id: number;
  jobId: number;
  jobNumber?: string;
  employeeId: number;
  splitPercentage?: number;
  splitAmount?: number;
  date?: string;
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

  private async requestAllPages<T>(endpoint: string, params: Record<string, string>, maxPages = 250): Promise<T[]> {
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
      if (page > maxPages) break;
    }

    return all;
  }

  // ============================================
  // EMPLOYEE / BU METHODS
  // ============================================

  async getBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.businessUnitsCache) return this.businessUnitsCache;

    const response = await this.request<STPagedResponse<STBusinessUnit>>(
      'GET',
      `settings/v2/tenant/${this.tenantId}/business-units`,
      { params: { pageSize: '200', active: 'true' } }
    );

    this.businessUnitsCache = response.data || [];
    return this.businessUnitsCache;
  }

  async getTechnicians(activeOnly: boolean = true): Promise<STTechnician[]> {
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

  async getEmployees(activeOnly: boolean = true): Promise<STEmployee[]> {
    const allEmployees: STEmployee[] = [];
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

      const response = await this.request<STPagedResponse<STEmployee>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/employees`,
        { params }
      );

      allEmployees.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;
      if (page > 20) break;
    }

    return allEmployees;
  }

  // ============================================
  // PAYROLL METHODS
  // ============================================

  /**
   * Get payroll periods from ServiceTitan.
   */
  async getPayrollPeriods(startDate?: string): Promise<STPayrollPeriod[]> {
    try {
      const params: Record<string, string> = {};
      if (startDate) params.modifiedOnOrAfter = `${startDate}T00:00:00`;
      const items = await this.requestAllPages<STPayrollPeriod>(
        `payroll/v2/tenant/${this.tenantId}/payrolls`,
        params
      );
      console.log(`Fetched ${items.length} payroll records`);
      return items;
    } catch (error) {
      console.error('Failed to fetch payroll periods:', error);
      return [];
    }
  }

  /**
   * Get gross pay items using modifiedOnOrAfter filter.
   * Returns detailed activity breakdown with hours, amounts, job info.
   */
  async getGrossPayItems(startDate: string): Promise<STGrossPayItemFlat[]> {
    try {
      const items = await this.requestAllPages<STGrossPayItemFlat>(
        `payroll/v2/tenant/${this.tenantId}/gross-pay-items`,
        { modifiedOnOrAfter: `${startDate}T00:00:00` }
      );
      console.log(`Fetched ${items.length} gross pay items (modified since ${startDate})`);
      return items;
    } catch (error) {
      console.error('Failed to fetch gross pay items:', error);
      return [];
    }
  }

  /**
   * Get job timesheets (clock in/out on jobs).
   */
  async getJobTimesheets(startDate: string, endDate: string): Promise<STJobTimesheet[]> {
    try {
      const items = await this.requestAllPages<STJobTimesheet>(
        `payroll/v2/tenant/${this.tenantId}/job-timesheets`,
        {
          modifiedOnOrAfter: `${startDate}T00:00:00`,
        }
      );
      // Filter to date range client-side (API only supports modifiedOnOrAfter)
      const filtered = items.filter(ts => {
        const d = ts.startedOn?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });
      console.log(`Fetched ${items.length} job timesheets, ${filtered.length} in range (${startDate} to ${endDate})`);
      return filtered;
    } catch (error) {
      console.error('Failed to fetch job timesheets:', error);
      return [];
    }
  }

  /**
   * Get non-job timesheets (meetings, training, shop time).
   */
  async getNonJobTimesheets(startDate: string, endDate: string): Promise<STNonJobTimesheet[]> {
    try {
      const items = await this.requestAllPages<STNonJobTimesheet>(
        `payroll/v2/tenant/${this.tenantId}/non-job-timesheets`,
        {
          modifiedOnOrAfter: `${startDate}T00:00:00`,
        }
      );
      // Filter to date range client-side
      const filtered = items.filter(ts => {
        const d = ts.startedOn?.split('T')[0];
        return d && d >= startDate && d <= endDate;
      });
      console.log(`Fetched ${items.length} non-job timesheets, ${filtered.length} in range (${startDate} to ${endDate})`);
      return filtered;
    } catch (error) {
      console.error('Failed to fetch non-job timesheets:', error);
      return [];
    }
  }

  /**
   * Get timesheet codes (categories for non-job time).
   */
  async getTimesheetCodes(): Promise<STTimesheetCode[]> {
    try {
      const items = await this.requestAllPages<STTimesheetCode>(
        `payroll/v2/tenant/${this.tenantId}/timesheet-codes`,
        {}
      );
      console.log(`Fetched ${items.length} timesheet codes`);
      return items;
    } catch (error) {
      console.error('Failed to fetch timesheet codes:', error);
      return [];
    }
  }

  /**
   * Get payroll adjustments for a payroll period.
   */
  async getPayrollAdjustments(payrollId: number): Promise<STPayrollAdjustment[]> {
    try {
      const items = await this.requestAllPages<STPayrollAdjustment>(
        `payroll/v2/tenant/${this.tenantId}/payroll/${payrollId}/adjustments`,
        {}
      );
      console.log(`Fetched ${items.length} adjustments for payroll ${payrollId}`);
      return items;
    } catch (error) {
      console.error(`Failed to fetch adjustments for payroll ${payrollId}:`, error);
      return [];
    }
  }

  /**
   * Get job splits (revenue/bonus splits among techs).
   */
  async getJobSplits(startDate: string, endDate: string): Promise<STJobSplit[]> {
    try {
      const items = await this.requestAllPages<STJobSplit>(
        `payroll/v2/tenant/${this.tenantId}/job-splits`,
        {
          dateOnOrAfter: startDate,
          dateOnOrBefore: endDate,
        }
      );
      console.log(`Fetched ${items.length} job splits (${startDate} to ${endDate})`);
      return items;
    } catch (error) {
      console.error('Failed to fetch job splits:', error);
      return [];
    }
  }

  async debugRawRequest(endpoint: string, params: Record<string, string>): Promise<unknown> {
    return this.request<unknown>('GET', endpoint, { params });
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

