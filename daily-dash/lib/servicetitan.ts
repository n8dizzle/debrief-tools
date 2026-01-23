/**
 * ServiceTitan API client for fetching KPI data.
 * Ported from Python implementation in debrief-qa.
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

interface STInvoice {
  id: number;
  invoiceNumber?: string;
  referenceNumber?: string;
  job?: { id: number; number?: string } | null;
  total: number;
  balance: number;
  summary?: string;
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
  // HUDDLE KPI METHODS
  // ============================================

  /**
   * Get jobs completed on a specific date
   */
  async getCompletedJobs(
    completedOnOrAfter: string, // YYYY-MM-DD
    completedBefore?: string,
    businessUnitId?: number
  ): Promise<STJob[]> {
    const params: Record<string, string> = {
      completedOnOrAfter: `${completedOnOrAfter}T00:00:00Z`,
      jobStatus: 'Completed',
      pageSize: '200',
    };

    if (completedBefore) {
      params.completedBefore = `${completedBefore}T00:00:00Z`;
    }

    if (businessUnitId) {
      params.businessUnitId = businessUnitId.toString();
    }

    const response = await this.request<STPagedResponse<STJob>>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      { params }
    );

    return response.data || [];
  }

  /**
   * Get jobs scheduled for a specific date
   */
  async getScheduledJobs(
    scheduledOnOrAfter: string,
    scheduledBefore?: string
  ): Promise<STJob[]> {
    const params: Record<string, string> = {
      scheduledOnOrAfter: `${scheduledOnOrAfter}T00:00:00Z`,
      pageSize: '200',
    };

    if (scheduledBefore) {
      params.scheduledBefore = `${scheduledBefore}T00:00:00Z`;
    }

    const response = await this.request<STPagedResponse<STJob>>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      { params }
    );

    return response.data || [];
  }

  /**
   * Get invoices created on a specific date
   */
  async getInvoices(
    createdOnOrAfter: string,
    createdBefore?: string
  ): Promise<STInvoice[]> {
    const params: Record<string, string> = {
      createdOnOrAfter: `${createdOnOrAfter}T00:00:00Z`,
      pageSize: '200',
    };

    if (createdBefore) {
      params.createdBefore = `${createdBefore}T00:00:00Z`;
    }

    const response = await this.request<STPagedResponse<STInvoice>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params }
    );

    return response.data || [];
  }

  /**
   * Get total revenue for a date (sum of completed job invoices)
   */
  async getDailyRevenue(date: string, businessUnitId?: number): Promise<number> {
    const nextDay = this.getNextDay(date);
    const jobs = await this.getCompletedJobs(date, nextDay, businessUnitId);
    return jobs.reduce((sum, job) => sum + (Number(job.total) || 0), 0);
  }

  /**
   * Get daily sales (sum of invoice totals created on date)
   */
  async getDailySales(date: string): Promise<number> {
    const nextDay = this.getNextDay(date);
    const invoices = await this.getInvoices(date, nextDay);
    return invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  }

  /**
   * Get non-job revenue - revenue from invoices NOT tied to completed jobs
   * This captures additional revenue like memberships, estimates converted to sales, etc.
   * Calculated as: (invoices created today) - (invoices for jobs completed today)
   */
  async getNonJobRevenue(date: string): Promise<number> {
    const nextDay = this.getNextDay(date);

    // Get all invoices created on date
    const invoices = await this.getInvoices(date, nextDay);
    const invoiceTotal = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

    // Get completed jobs and their IDs
    const completedJobs = await this.getCompletedJobs(date, nextDay);
    const completedJobIds = new Set(completedJobs.map((j) => j.id));

    // Sum invoices for completed jobs only
    const completedJobInvoiceTotal = invoices
      .filter((inv) => inv.job && completedJobIds.has(inv.job.id))
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

    // Non-job revenue = invoice total minus invoices for completed jobs
    return Math.max(0, invoiceTotal - completedJobInvoiceTotal);
  }

  /**
   * Get total revenue breakdown matching ServiceTitan's dashboard formula:
   * Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue
   *
   * - completedRevenue: sum of job.total for completed jobs (from jobs API)
   * - nonJobRevenue: sum of positive invoices NOT tied to any job (job is null)
   * - adjRevenue: sum of negative invoices (refunds, credits, adjustments)
   * - totalRevenue: completedRevenue + nonJobRevenue + adjRevenue
   */
  async getTotalRevenue(date: string, businessUnitId?: number): Promise<{
    completedRevenue: number;
    nonJobRevenue: number;
    adjRevenue: number;
    totalRevenue: number;
  }> {
    const nextDay = this.getNextDay(date);

    // Completed Revenue = sum of job.total for jobs completed on this date
    const jobs = await this.getCompletedJobs(date, nextDay, businessUnitId);
    const completedRevenue = jobs.reduce((sum, job) => sum + (Number(job.total) || 0), 0);

    // Get all invoices created on date for non-job and adj revenue
    const invoices = await this.getInvoices(date, nextDay);

    // Categorize invoices
    let nonJobRevenue = 0;
    let adjRevenue = 0;

    for (const inv of invoices) {
      const total = Number(inv.total) || 0;

      if (total < 0) {
        // Negative invoices are adjustments (refunds, credits)
        adjRevenue += total;
      } else if (!inv.job) {
        // Positive invoice with no job = non-job revenue (memberships, etc.)
        nonJobRevenue += total;
      }
      // Positive invoices tied to jobs are already counted in completedRevenue via job.total
    }

    return {
      completedRevenue,
      nonJobRevenue,
      adjRevenue,
      totalRevenue: completedRevenue + nonJobRevenue + adjRevenue,
    };
  }

  /**
   * Get count of jobs scheduled for a date
   */
  async getScheduledJobCount(date: string): Promise<number> {
    const nextDay = this.getNextDay(date);
    const jobs = await this.getScheduledJobs(date, nextDay);
    return jobs.length;
  }

  /**
   * Get count of completed jobs for a date, optionally filtered
   */
  async getCompletedJobCount(
    date: string,
    options: {
      businessUnitId?: number;
      jobTypeIds?: number[];
      tradeType?: 'HVAC' | 'Plumbing';
    } = {}
  ): Promise<number> {
    const nextDay = this.getNextDay(date);
    let jobs = await this.getCompletedJobs(date, nextDay, options.businessUnitId);

    // Filter by job type IDs if provided
    if (options.jobTypeIds && options.jobTypeIds.length > 0) {
      jobs = jobs.filter((j) => options.jobTypeIds!.includes(j.jobTypeId));
    }

    // Filter by trade type if provided
    if (options.tradeType) {
      jobs = jobs.filter((j) => {
        const typeName = j.jobTypeName?.toUpperCase() || '';
        if (options.tradeType === 'Plumbing') {
          return typeName.includes('PLUMBING') || typeName.includes('PLUMB');
        }
        // HVAC is default
        return !typeName.includes('PLUMBING');
      });
    }

    return jobs.length;
  }

  /**
   * Get average ticket for completed jobs on a date
   */
  async getAverageTicket(
    date: string,
    options: {
      businessUnitId?: number;
      tradeType?: 'HVAC' | 'Plumbing';
    } = {}
  ): Promise<number> {
    const nextDay = this.getNextDay(date);
    let jobs = await this.getCompletedJobs(date, nextDay, options.businessUnitId);

    // Filter by trade type if provided
    if (options.tradeType) {
      jobs = jobs.filter((j) => {
        const typeName = j.jobTypeName?.toUpperCase() || '';
        if (options.tradeType === 'Plumbing') {
          return typeName.includes('PLUMBING');
        }
        return !typeName.includes('PLUMBING');
      });
    }

    // Filter out zero-dollar jobs for average ticket calculation
    const paidJobs = jobs.filter((j) => (Number(j.total) || 0) > 0);
    if (paidJobs.length === 0) return 0;

    const total = paidJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    return total / paidJobs.length;
  }

  /**
   * Get zero-dollar ticket percentage
   */
  async getZeroDollarPercentage(
    date: string,
    tradeType?: 'HVAC' | 'Plumbing'
  ): Promise<number> {
    const nextDay = this.getNextDay(date);
    let jobs = await this.getCompletedJobs(date, nextDay);

    if (tradeType) {
      jobs = jobs.filter((j) => {
        const typeName = j.jobTypeName?.toUpperCase() || '';
        if (tradeType === 'Plumbing') {
          return typeName.includes('PLUMBING');
        }
        return !typeName.includes('PLUMBING');
      });
    }

    if (jobs.length === 0) return 0;

    const zeroJobs = jobs.filter((j) => (Number(j.total) || 0) === 0);
    return (zeroJobs.length / jobs.length) * 100;
  }

  /**
   * Get install-specific metrics
   */
  async getInstallMetrics(
    date: string
  ): Promise<{ scheduled: number; completed: number; revenue: number }> {
    const nextDay = this.getNextDay(date);

    // Get scheduled install jobs
    const scheduledJobs = await this.getScheduledJobs(date, nextDay);
    const installScheduled = scheduledJobs.filter((j) => {
      const typeName = j.jobTypeName?.toUpperCase() || '';
      return typeName.includes('INSTALL');
    });

    // Get completed install jobs
    const completedJobs = await this.getCompletedJobs(date, nextDay);
    const installCompleted = completedJobs.filter((j) => {
      const typeName = j.jobTypeName?.toUpperCase() || '';
      return typeName.includes('INSTALL');
    });

    const revenue = installCompleted.reduce((sum, j) => sum + (Number(j.total) || 0), 0);

    return {
      scheduled: installScheduled.length,
      completed: installCompleted.length,
      revenue,
    };
  }

  /**
   * Get plumbing-specific metrics
   */
  async getPlumbingMetrics(date: string): Promise<{
    sales: number;
    revenue: number;
    jobsRan: number;
  }> {
    const nextDay = this.getNextDay(date);

    // Get completed plumbing jobs
    const jobs = await this.getCompletedJobs(date, nextDay);
    const plumbingJobs = jobs.filter((j) => {
      const typeName = j.jobTypeName?.toUpperCase() || '';
      return typeName.includes('PLUMBING') || typeName.includes('PLUMB');
    });

    // Get plumbing invoices for sales
    const invoices = await this.getInvoices(date, nextDay);
    // Filter invoices that belong to plumbing jobs
    const plumbingJobIds = new Set(plumbingJobs.map((j) => j.id));
    const plumbingInvoices = invoices.filter((inv) => inv.job && plumbingJobIds.has(inv.job.id));

    return {
      sales: plumbingInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0),
      revenue: plumbingJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0),
      jobsRan: plumbingJobs.length,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

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
