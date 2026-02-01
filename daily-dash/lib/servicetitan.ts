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
  businessUnit?: { id: number; name?: string } | null;
  total: number;
  balance: number;
  summary?: string;
  createdOn?: string;
  invoiceDate?: string;  // The actual invoice date (for revenue attribution)
  modifiedOn?: string;
  adjustmentToId?: number | null;  // If set, this is an adjustment invoice
  invoiceType?: string;  // Type of invoice (e.g., "Adjustment")
}

interface STEstimateItem {
  id: number;
  sku?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface STEstimate {
  id: number;
  jobId?: number;
  name?: string;
  status: {
    name: string;
    value: number;
  };
  summary?: string;
  subtotal: number;
  total: number;
  soldOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  items?: STEstimateItem[];
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

interface STTechnician {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  active: boolean;
  businessUnitId?: number;
}

interface STEmployee {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  active: boolean;
  role?: string;
}

// Call types for Telecom API
export interface STCall {
  id: number;
  receivedOn: string;
  duration: string;  // Format: "HH:MM:SS" or seconds
  from: string;
  to: string;
  direction: 'Inbound' | 'Outbound';
  callType: string;  // Unbooked, Booked, Excused, etc.
  reason?: {
    id: number;
    name: string;
  };
  recordingUrl?: string;
  voiceMailUrl?: string;
  createdBy?: {
    id: number;
    name: string;
  };
  customer?: {
    id: number;
    name: string;
  };
  campaign?: {
    id: number;
    name: string;
  };
  job?: {
    id: number;
    number: string;
  };
  booking?: {
    id: number;
  };
  agent?: {
    id: number;
    name: string;
  };
  modifiedOn?: string;
}

// Trade types for filtering
export type TradeName = 'HVAC' | 'Plumbing';

// HVAC department types
export type HVACDepartment = 'Install' | 'Service' | 'Maintenance';

// Business units that belong to each trade
const HVAC_BUSINESS_UNITS = [
  'HVAC - Install',
  'HVAC - Service',
  'HVAC - Maintenance',
  'HVAC - Commercial',              // Counted as Service
  'HVAC - Sales',                   // Sales team revenue
  'Mims - Service',                 // Counted as Service
  // Legacy DNU business units (still have historical revenue)
  'z-DNU - Christmas HVAC- Install',
  'z-DNU - Christmas HVAC- Service',
  'z DNU Imported Default Businessunit',
];

const PLUMBING_BUSINESS_UNITS = [
  'Plumbing - Install',
  'Plumbing - Service',
  'Plumbing - Maintenance',
  'Plumbing - Sales',
  'Plumbing - Commercial',
];

// Map HVAC business unit names to department
const HVAC_DEPT_MAPPING: Record<string, HVACDepartment> = {
  'HVAC - Install': 'Install',
  'HVAC - Service': 'Service',
  'HVAC - Maintenance': 'Maintenance',
  'HVAC - Commercial': 'Service',              // Commercial counts as Service
  'HVAC - Sales': 'Install',                   // Sales revenue counts as Install
  'Mims - Service': 'Service',                 // Mims counts as Service
  // Legacy DNU business units
  'z-DNU - Christmas HVAC- Install': 'Install',
  'z-DNU - Christmas HVAC- Service': 'Service',
  'z DNU Imported Default Businessunit': 'Service', // Default to Service
};

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
  // BUSINESS UNIT METHODS
  // ============================================

  /**
   * Get all business units (cached) - includes inactive for historical data
   */
  async getBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.businessUnitsCache) {
      return this.businessUnitsCache;
    }

    // Fetch both active and inactive business units for historical revenue
    const [activeResponse, inactiveResponse] = await Promise.all([
      this.request<STPagedResponse<STBusinessUnit>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: '100', active: 'true' } }
      ),
      this.request<STPagedResponse<STBusinessUnit>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: '100', active: 'false' } }
      ),
    ]);

    const allUnits = [...(activeResponse.data || []), ...(inactiveResponse.data || [])];
    this.businessUnitsCache = allUnits;
    return this.businessUnitsCache;
  }

  /**
   * Get all technicians (handles pagination)
   */
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

      // Safety limit
      if (page > 20) break;
    }

    return allTechnicians;
  }

  /**
   * Get all employees (handles pagination)
   */
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

      // Safety limit
      if (page > 20) break;
    }

    return allEmployees;
  }

  /**
   * Get business unit IDs for a specific trade (HVAC or Plumbing)
   * HVAC excludes "HVAC - Sales" (salespeople, not technicians)
   */
  async getBusinessUnitIdsForTrade(trade: TradeName): Promise<number[]> {
    const businessUnits = await this.getBusinessUnits();
    const validNames = trade === 'HVAC' ? HVAC_BUSINESS_UNITS : PLUMBING_BUSINESS_UNITS;

    return businessUnits
      .filter(bu => validNames.includes(bu.name))
      .map(bu => bu.id);
  }

  /**
   * Get business unit IDs for a specific HVAC department
   * - Install: HVAC - Install
   * - Service: HVAC - Service + HVAC - Commercial + Mims - Service
   * - Maintenance: HVAC - Maintenance
   */
  async getBusinessUnitIdsForHVACDepartment(department: HVACDepartment): Promise<number[]> {
    const businessUnits = await this.getBusinessUnits();

    return businessUnits
      .filter(bu => HVAC_DEPT_MAPPING[bu.name] === department)
      .map(bu => bu.id);
  }

  // ============================================
  // TRADE-LEVEL METRICS
  // ============================================

  /**
   * Get revenue for a trade (HVAC or Plumbing) for a date range
   * Revenue = sum of job.total for completed jobs in that trade's business units
   * @param startDate - Start date (inclusive) in YYYY-MM-DD format
   * @param endDate - End date (inclusive) in YYYY-MM-DD format, defaults to startDate
   */
  async getTradeRevenue(startDate: string, trade: TradeName, endDate?: string): Promise<number> {
    const effectiveEndDate = endDate || startDate;
    const dayAfterEnd = this.getNextDay(effectiveEndDate);
    const businessUnitIds = await this.getBusinessUnitIdsForTrade(trade);

    if (businessUnitIds.length === 0) return 0;

    // Fetch all completed jobs for the date range
    const jobs = await this.getCompletedJobs(startDate, dayAfterEnd);

    // Filter to jobs in this trade's business units
    const tradeJobs = jobs.filter(job => businessUnitIds.includes(job.businessUnitId));

    return tradeJobs.reduce((sum, job) => sum + (Number(job.total) || 0), 0);
  }

  /**
   * Get sales for a trade (HVAC or Plumbing) for a date range
   * Sales = sum of sold estimate subtotals where the estimate's job is in that trade's business units
   * @param startDate - Start date (inclusive) in YYYY-MM-DD format
   * @param endDate - End date (inclusive) in YYYY-MM-DD format, defaults to startDate
   */
  async getTradeSales(startDate: string, trade: TradeName, endDate?: string): Promise<number> {
    const effectiveEndDate = endDate || startDate;
    const dayAfterEnd = this.getNextDay(effectiveEndDate);
    const businessUnitIds = await this.getBusinessUnitIdsForTrade(trade);

    if (businessUnitIds.length === 0) return 0;

    // Fetch sold estimates for the date range
    const estimates = await this.getSoldEstimates(startDate, dayAfterEnd);

    // Get job IDs from estimates that have jobs
    const jobIds = estimates
      .filter(est => est.jobId)
      .map(est => est.jobId!);

    if (jobIds.length === 0) {
      // No jobs - sum all estimates (they might be standalone)
      return estimates.reduce((sum, est) => sum + (Number(est.subtotal) || 0), 0);
    }

    // Fetch jobs to get their business units
    const jobs = await this.getCompletedJobs(startDate, dayAfterEnd);
    const tradeJobIds = new Set(
      jobs
        .filter(job => businessUnitIds.includes(job.businessUnitId))
        .map(job => job.id)
    );

    // Sum estimates whose jobs are in this trade
    // Also include estimates without jobs (standalone estimates)
    return estimates
      .filter(est => !est.jobId || tradeJobIds.has(est.jobId))
      .reduce((sum, est) => sum + (Number(est.subtotal) || 0), 0);
  }

  /**
   * Get revenue for an HVAC department for a date range
   * @param startDate - Start date (inclusive) in YYYY-MM-DD format
   * @param endDate - End date (inclusive) in YYYY-MM-DD format, defaults to startDate
   */
  async getHVACDepartmentRevenue(startDate: string, department: HVACDepartment, endDate?: string): Promise<number> {
    const effectiveEndDate = endDate || startDate;
    const dayAfterEnd = this.getNextDay(effectiveEndDate);
    const businessUnitIds = await this.getBusinessUnitIdsForHVACDepartment(department);

    if (businessUnitIds.length === 0) return 0;

    const jobs = await this.getCompletedJobs(startDate, dayAfterEnd);
    const deptJobs = jobs.filter(job => businessUnitIds.includes(job.businessUnitId));

    return deptJobs.reduce((sum, job) => sum + (Number(job.total) || 0), 0);
  }

  /**
   * Get all trade metrics for a date range (optimized to reduce API calls)
   * Returns TOTAL REVENUE (Completed + Non-Job + Adj) for both HVAC and Plumbing,
   * plus HVAC department breakdown.
   *
   * Matches ServiceTitan's Total Revenue formula:
   * Total Revenue = Completed Revenue + Non-Job Revenue + Adj. Revenue
   *
   * - Completed Revenue: sum of job.total for completed jobs in that business unit
   * - Adj Revenue: negative invoices tied to jobs in that business unit
   * - Non-Job Revenue: positive invoices with no job - distributed proportionally by trade
   */
  async getTradeMetrics(startDate: string, endDate?: string): Promise<{
    hvac: {
      revenue: number;
      completedRevenue: number;
      nonJobRevenue: number;
      adjRevenue: number;
      departments: {
        install: { revenue: number; completedRevenue: number; nonJobRevenue: number; adjRevenue: number };
        service: { revenue: number; completedRevenue: number; nonJobRevenue: number; adjRevenue: number };
        maintenance: { revenue: number; completedRevenue: number; nonJobRevenue: number; adjRevenue: number };
      };
    };
    plumbing: {
      revenue: number;
      completedRevenue: number;
      nonJobRevenue: number;
      adjRevenue: number;
    };
  }> {
    const effectiveEndDate = endDate || startDate;
    const dayAfterEnd = this.getNextDay(effectiveEndDate);

    // Fetch business units once
    const hvacBuIds = await this.getBusinessUnitIdsForTrade('HVAC');
    const plumbingBuIds = await this.getBusinessUnitIdsForTrade('Plumbing');
    const hvacInstallBuIds = await this.getBusinessUnitIdsForHVACDepartment('Install');
    const hvacServiceBuIds = await this.getBusinessUnitIdsForHVACDepartment('Service');
    const hvacMaintenanceBuIds = await this.getBusinessUnitIdsForHVACDepartment('Maintenance');

    // Fetch all completed jobs once
    const jobs = await this.getCompletedJobs(startDate, dayAfterEnd);

    // Create a map of jobId -> businessUnitId for quick lookup
    const jobToBuMap = new Map<number, number>();
    jobs.forEach(j => jobToBuMap.set(j.id, j.businessUnitId));

    // Fetch invoices - use broader range to catch invoices created before but with invoiceDate in range
    // We filter by invoiceDate in the processing loop to match ST's revenue attribution
    // Go back 60 days to catch invoices created earlier with invoiceDate in our target range
    const fetchStartDate = this.subtractDays(startDate, 60);
    const invoices = await this.getInvoicesDateRange(fetchStartDate, dayAfterEnd);

    // === Calculate Completed Revenue from job.total ===
    // This matches ST's "Completed Revenue" = sum of job totals for completed jobs
    const hvacJobs = jobs.filter(j => hvacBuIds.includes(j.businessUnitId));
    const plumbingJobs = jobs.filter(j => plumbingBuIds.includes(j.businessUnitId));
    const hvacInstallJobs = jobs.filter(j => hvacInstallBuIds.includes(j.businessUnitId));
    const hvacServiceJobs = jobs.filter(j => hvacServiceBuIds.includes(j.businessUnitId));
    const hvacMaintenanceJobs = jobs.filter(j => hvacMaintenanceBuIds.includes(j.businessUnitId));

    const hvacCompletedRevenue = hvacJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const plumbingCompletedRevenue = plumbingJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const hvacInstallCompletedRevenue = hvacInstallJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const hvacServiceCompletedRevenue = hvacServiceJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);
    const hvacMaintenanceCompletedRevenue = hvacMaintenanceJobs.reduce((sum, j) => sum + (Number(j.total) || 0), 0);

    // === Initialize Non-Job and Adj Revenue Accumulators ===
    let hvacAdjRevenue = 0;
    let plumbingAdjRevenue = 0;
    let hvacInstallAdjRevenue = 0;
    let hvacServiceAdjRevenue = 0;
    let hvacMaintenanceAdjRevenue = 0;

    let hvacMaintenanceNonJobRevenue = 0;
    let plumbingMaintenanceNonJobRevenue = 0;
    let otherNonJobRevenue = 0;

    // Create set of completed job IDs for quick lookup
    const completedJobIds = new Set(jobs.map(j => j.id));

    // Find invoices that reference jobs NOT in our completed jobs list
    // to get their business units for attribution
    const missingJobIds: number[] = [];
    for (const inv of invoices) {
      if (inv.job?.id && !jobToBuMap.has(inv.job.id) && !inv.businessUnit?.id) {
        missingJobIds.push(inv.job.id);
      }
    }

    // Fetch details for missing jobs to get their business units
    const allJobBuMap = new Map<number, number>(jobToBuMap);
    if (missingJobIds.length > 0) {
      const uniqueMissingIds = [...new Set(missingJobIds)];
      const missingJobs = await this.getJobsByIds(uniqueMissingIds);
      missingJobs.forEach((job, jobId) => {
        allJobBuMap.set(jobId, job.businessUnitId);
      });
    }

    // Process invoices for Non-Job and Adj Revenue only
    // Completed Revenue comes from job.total above
    for (const inv of invoices) {
      const total = Number(inv.total) || 0;

      // Filter by invoiceDate to match ST's revenue attribution for Non-Job and Adj
      const invDate = inv.invoiceDate?.split('T')[0];
      if (invDate && (invDate < startDate || invDate >= dayAfterEnd)) {
        continue; // Invoice date outside range
      }

      // Determine business unit
      let invoiceBuId: number | undefined;
      if (inv.businessUnit?.id) {
        invoiceBuId = inv.businessUnit.id;
      } else if (inv.job?.id) {
        invoiceBuId = allJobBuMap.get(inv.job.id);
      }

      // Only count as adjustment if adjustmentToId is set (not just negative totals)
      // Negative invoices without adjustmentToId are refunds already reflected in job.total
      const isAdjustmentInvoice = inv.adjustmentToId != null;
      const hasJob = inv.job?.id != null;

      if (!hasJob) {
        // === NON-JOB REVENUE ===
        // Invoices NOT tied to a job (memberships, counter sales, etc.)
        if (invoiceBuId) {
          if (hvacMaintenanceBuIds.includes(invoiceBuId)) {
            hvacMaintenanceNonJobRevenue += total;
          } else if (plumbingBuIds.includes(invoiceBuId)) {
            plumbingMaintenanceNonJobRevenue += total;
          } else if (hvacBuIds.includes(invoiceBuId)) {
            hvacMaintenanceNonJobRevenue += total;
          } else {
            otherNonJobRevenue += total;
          }
        } else {
          hvacMaintenanceNonJobRevenue += total;
        }
      } else if (isAdjustmentInvoice) {
        // === ADJ REVENUE ===
        // Adjustment invoices tied to jobs (refunds, credits)
        if (invoiceBuId) {
          if (hvacBuIds.includes(invoiceBuId)) {
            hvacAdjRevenue += total;
            if (hvacInstallBuIds.includes(invoiceBuId)) hvacInstallAdjRevenue += total;
            else if (hvacServiceBuIds.includes(invoiceBuId)) hvacServiceAdjRevenue += total;
            else if (hvacMaintenanceBuIds.includes(invoiceBuId)) hvacMaintenanceAdjRevenue += total;
          } else if (plumbingBuIds.includes(invoiceBuId)) {
            plumbingAdjRevenue += total;
          }
        }
      }
      // Skip: positive invoices tied to jobs (already in Completed Revenue via job.total)
    }

    // === Sum up Non-Job Revenue ===
    const hvacNonJobRevenue = hvacMaintenanceNonJobRevenue;
    const plumbingNonJobRevenue = plumbingMaintenanceNonJobRevenue;

    // Department non-job revenue (all goes to Maintenance)
    const hvacInstallNonJobRevenue = 0;
    const hvacServiceNonJobRevenue = 0;

    // Calculate Total Revenue = Completed + Non-Job + Adj (matches ServiceTitan "Total Revenue")
    const hvacTotalRevenue = hvacCompletedRevenue + hvacNonJobRevenue + hvacAdjRevenue;
    const plumbingTotalRevenue = plumbingCompletedRevenue + plumbingNonJobRevenue + plumbingAdjRevenue;
    const hvacInstallTotalRevenue = hvacInstallCompletedRevenue + hvacInstallNonJobRevenue + hvacInstallAdjRevenue;
    const hvacServiceTotalRevenue = hvacServiceCompletedRevenue + hvacServiceNonJobRevenue + hvacServiceAdjRevenue;
    const hvacMaintenanceTotalRevenue = hvacMaintenanceCompletedRevenue + hvacMaintenanceNonJobRevenue + hvacMaintenanceAdjRevenue;

    return {
      hvac: {
        completedRevenue: hvacCompletedRevenue,
        nonJobRevenue: hvacNonJobRevenue,
        adjRevenue: hvacAdjRevenue,
        revenue: hvacTotalRevenue, // Total Revenue = Completed + Non-Job + Adj
        departments: {
          install: {
            completedRevenue: hvacInstallCompletedRevenue,
            nonJobRevenue: hvacInstallNonJobRevenue,
            adjRevenue: hvacInstallAdjRevenue,
            revenue: hvacInstallTotalRevenue,
          },
          service: {
            completedRevenue: hvacServiceCompletedRevenue,
            nonJobRevenue: hvacServiceNonJobRevenue,
            adjRevenue: hvacServiceAdjRevenue,
            revenue: hvacServiceTotalRevenue,
          },
          maintenance: {
            completedRevenue: hvacMaintenanceCompletedRevenue,
            nonJobRevenue: hvacMaintenanceNonJobRevenue,
            adjRevenue: hvacMaintenanceAdjRevenue,
            revenue: hvacMaintenanceTotalRevenue,
          },
        },
      },
      plumbing: {
        completedRevenue: plumbingCompletedRevenue,
        nonJobRevenue: plumbingNonJobRevenue,
        adjRevenue: plumbingAdjRevenue,
        revenue: plumbingTotalRevenue, // Total Revenue = Completed + Non-Job + Adj
      },
    };
  }

  /**
   * Get a single job by ID to retrieve its business unit
   */
  async getJobById(jobId: number): Promise<STJob | null> {
    try {
      const response = await this.request<STJob>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`
      );
      return response || null;
    } catch {
      return null;
    }
  }

  /**
   * Get multiple jobs by IDs (batched)
   */
  async getJobsByIds(jobIds: number[]): Promise<Map<number, STJob>> {
    const jobMap = new Map<number, STJob>();

    // Fetch in batches to avoid too many concurrent requests
    const batchSize = 10;
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(id => this.getJobById(id))
      );
      results.forEach((job, idx) => {
        if (job) {
          jobMap.set(batch[idx], job);
        }
      });
    }

    return jobMap;
  }

  /**
   * Get invoices for a date range (handles pagination)
   */
  async getInvoicesDateRange(
    startDate: string,
    endDate: string
  ): Promise<STInvoice[]> {
    const allInvoices: STInvoice[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      // Fetch invoices created in date range
      // ST says non-job/adj revenue uses "invoice date" but most invoices
      // have invoiceDate = createdOn, so this should capture them
      const params: Record<string, string> = {
        createdOnOrAfter: `${startDate}T00:00:00`,
        createdBefore: `${endDate}T00:00:00`,
        pageSize: '200',
        page: page.toString(),
      };

      const response = await this.request<STPagedResponse<STInvoice>>(
        'GET',
        `accounting/v2/tenant/${this.tenantId}/invoices`,
        { params }
      );

      allInvoices.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 50) break;
    }

    return allInvoices;
  }

  // ============================================
  // HUDDLE KPI METHODS
  // ============================================

  /**
   * Get jobs completed in a date range (handles pagination)
   */
  async getCompletedJobs(
    completedOnOrAfter: string, // YYYY-MM-DD
    completedBefore?: string,
    businessUnitId?: number
  ): Promise<STJob[]> {
    const allJobs: STJob[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        completedOnOrAfter: `${completedOnOrAfter}T00:00:00`,
        jobStatus: 'Completed',
        pageSize: '200',
        page: page.toString(),
      };

      if (completedBefore) {
        params.completedBefore = `${completedBefore}T00:00:00`;
      }

      if (businessUnitId) {
        params.businessUnitId = businessUnitId.toString();
      }

      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        { params }
      );

      allJobs.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 50) break;
    }

    return allJobs;
  }

  /**
   * Get jobs scheduled for a specific date
   */
  async getScheduledJobs(
    scheduledOnOrAfter: string,
    scheduledBefore?: string
  ): Promise<STJob[]> {
    const params: Record<string, string> = {
      scheduledOnOrAfter: `${scheduledOnOrAfter}T00:00:00`,
      pageSize: '200',
    };

    if (scheduledBefore) {
      params.scheduledBefore = `${scheduledBefore}T00:00:00`;
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
      createdOnOrAfter: `${createdOnOrAfter}T00:00:00`,
      pageSize: '200',
    };

    if (createdBefore) {
      params.createdBefore = `${createdBefore}T00:00:00`;
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
  // ESTIMATES / SALES METHODS
  // ============================================

  /**
   * Get sold estimates for a date range
   * Uses soldAfter/soldBefore parameters (not soldOnOrAfter)
   */
  async getSoldEstimates(
    soldAfterDate: string,
    soldBeforeDate?: string
  ): Promise<STEstimate[]> {
    const params: Record<string, string> = {
      soldAfter: `${soldAfterDate}T00:00:00`,
      pageSize: '200',
    };

    if (soldBeforeDate) {
      params.soldBefore = `${soldBeforeDate}T00:00:00`;
    }

    const response = await this.request<STPagedResponse<STEstimate>>(
      'GET',
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { params }
    );

    return response.data || [];
  }

  /**
   * Get total sales (sum of sold estimate subtotals) for a date
   * Matches ServiceTitan's "Total Sales" metric
   */
  async getTotalSales(date: string): Promise<number> {
    const nextDay = this.getNextDay(date);
    const estimates = await this.getSoldEstimates(date, nextDay);
    // Sum subtotals (before tax) to match ST's "Total Sales" definition
    return estimates.reduce((sum, est) => sum + (Number(est.subtotal) || 0), 0);
  }

  // ============================================
  // TELECOM / CALLS METHODS
  // ============================================

  /**
   * Get calls for a date range (handles pagination)
   * Uses Telecom API: GET /telecom/v2/tenant/{tenant}/calls
   * @param receivedOnOrAfter - Start date (inclusive) in YYYY-MM-DD format
   * @param receivedBefore - End date (exclusive) in YYYY-MM-DD format
   * @param options - Additional filter options
   */
  async getCalls(
    receivedOnOrAfter: string,
    receivedBefore?: string,
    options: {
      direction?: 'Inbound' | 'Outbound';
      callType?: string;
      hasRecording?: boolean;
    } = {}
  ): Promise<STCall[]> {
    const allCalls: STCall[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params: Record<string, string> = {
        receivedOnOrAfter: `${receivedOnOrAfter}T00:00:00`,
        pageSize: '200',
        page: page.toString(),
      };

      if (receivedBefore) {
        params.receivedBefore = `${receivedBefore}T00:00:00`;
      }

      if (options.direction) {
        params.direction = options.direction;
      }

      if (options.callType) {
        params.callType = options.callType;
      }

      if (options.hasRecording !== undefined) {
        params.hasRecording = options.hasRecording.toString();
      }

      const response = await this.request<STPagedResponse<STCall>>(
        'GET',
        `telecom/v2/tenant/${this.tenantId}/calls`,
        { params }
      );

      allCalls.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) break;
    }

    return allCalls;
  }

  /**
   * Get a single call by ID
   */
  async getCallById(callId: number): Promise<STCall | null> {
    try {
      const response = await this.request<STCall>(
        'GET',
        `telecom/v2/tenant/${this.tenantId}/calls/${callId}`
      );
      return response || null;
    } catch {
      return null;
    }
  }

  /**
   * Get inbound calls for a date range
   */
  async getInboundCalls(
    receivedOnOrAfter: string,
    receivedBefore?: string
  ): Promise<STCall[]> {
    return this.getCalls(receivedOnOrAfter, receivedBefore, { direction: 'Inbound' });
  }

  /**
   * Get outbound calls for a date range
   */
  async getOutboundCalls(
    receivedOnOrAfter: string,
    receivedBefore?: string
  ): Promise<STCall[]> {
    return this.getCalls(receivedOnOrAfter, receivedBefore, { direction: 'Outbound' });
  }

  /**
   * Parse call duration from ST format to seconds
   * ST returns duration in various formats (HH:MM:SS or just seconds)
   */
  parseCallDuration(duration: string | number): number {
    if (typeof duration === 'number') {
      return duration;
    }

    // Try parsing HH:MM:SS format
    const parts = duration.split(':');
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // Try parsing as seconds
    return parseInt(duration, 10) || 0;
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
   * Subtract days from a date string
   */
  private subtractDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z');
    date.setDate(date.getDate() - days);
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
