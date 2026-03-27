/**
 * ServiceTitan API client for Service Dashboard.
 * Adapted from AP Payments, focused on service tech performance data.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface STTechnician {
  id: number;
  name: string;
  active: boolean;
  businessUnitId?: number;
}

export interface STJob {
  id: number;
  jobNumber: string;
  businessUnitId: number;
  jobStatus: string;
  customerId: number;
  completedOn?: string;
  total?: number;
}

export interface STAppointmentAssignment {
  id: number;
  technicianId: number;
  technicianName?: string;
  appointmentId: number;
  jobId?: number;
  status?: string;
}

export interface STOpportunity {
  id: number;
  status?: number;
  createdOn?: string;
  createdById?: number;
  active?: boolean;
  holder?: { id: number; type: number };
  estimateIds?: number[];
}

export interface STTechGeneratedLead {
  generatedJobId: number;
  sourceJobId: number;
  employeeId: number;
  sourceJobCompletedOn: string | null;
}

export interface STEstimate {
  id: number;
  name?: string;
  subtotal: number;
  soldOn?: string;
  soldBy?: number;
  status?: { name?: string };
  jobId?: number;
}

export interface STMembership {
  id: number;
  status?: string;
  createdOn?: string;
  soldById?: number;
  membershipTypeName?: string;
}

export interface STInvoice {
  id: number;
  job?: { id: number; number?: string } | null;
  businessUnit?: { id: number; name?: string } | null;
  total: number;
  subTotal?: number;
  createdOn?: string;
  adjustmentToId?: number | null;
  items?: Array<{
    id: number;
    total?: number;
    type?: string;
  }>;
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

// Service business unit names to sync (HVAC only for now)
const SERVICE_BU_NAMES = [
  'hvac - service',
  'hvac - commercial',
  'hvac - maintenance',
  'mims - service',
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

  private async requestAllPages<T>(
    endpoint: string,
    params: Record<string, string> = {},
    maxPages: number = 50
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const response = await this.request<STPagedResponse<T>>(
        'GET',
        endpoint,
        { params: { ...params, pageSize: '200', page: page.toString() } }
      );
      all.push(...(response.data || []));
      hasMore = response.hasMore;
      page++;
    }

    return all;
  }

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

  /**
   * Get IDs of service business units.
   */
  async getServiceBusinessUnitIds(): Promise<number[]> {
    const bus = await this.getBusinessUnits();
    return bus
      .filter(bu => SERVICE_BU_NAMES.includes(bu.name.toLowerCase()))
      .map(bu => bu.id);
  }

  /**
   * Determine trade from business unit name.
   */
  getTradeFromBUName(buName: string): 'hvac' | 'plumbing' {
    const lower = buName.toLowerCase();
    if (lower.includes('plumb')) return 'plumbing';
    return 'hvac';
  }

  /**
   * Get all technicians.
   */
  async getTechnicians(): Promise<STTechnician[]> {
    return this.requestAllPages<STTechnician>(
      `settings/v2/tenant/${this.tenantId}/technicians`,
      { active: 'true' },
      20
    );
  }

  /**
   * Get completed jobs for a date range within specific business units.
   */
  async getCompletedJobs(startDate: string, endDate: string, businessUnitIds: number[]): Promise<STJob[]> {
    const all: STJob[] = [];

    // Fetch completed jobs — completedOnOrAfter/completedBefore
    // NO Z suffix — let ST interpret as tenant local time
    const jobs = await this.requestAllPages<STJob>(
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      {
        completedOnOrAfter: `${startDate}T00:00:00`,
        completedBefore: `${endDate}T23:59:59`,
        jobStatus: 'Completed',
      }
    );

    // Filter to service BUs
    const buSet = new Set(businessUnitIds);
    for (const job of jobs) {
      if (buSet.has(job.businessUnitId)) {
        all.push(job);
      }
    }

    return all;
  }

  /**
   * Get appointment assignments for a date range within specific business units.
   * Fetches appointments by date range per BU, then gets tech assignments.
   * Returns a map of jobId → technicianId (first assigned tech).
   */
  async getAppointmentAssignmentsForDateRange(
    startDate: string,
    endDate: string,
    businessUnitIds: number[]
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();

    // 1. Fetch appointments by date range for each service BU
    const allAppointments: { id: number; jobId: number }[] = [];

    for (const buId of businessUnitIds) {
      try {
        const appts = await this.requestAllPages<{ id: number; jobId: number }>(
          `jpm/v2/tenant/${this.tenantId}/appointments`,
          {
            startsOnOrAfter: `${startDate}T00:00:00`,
            startsBefore: `${endDate}T23:59:59`,
            businessUnitId: buId.toString(),
          },
          20
        );
        allAppointments.push(...appts);
      } catch (error) {
        console.error(`Failed to get appointments for BU ${buId}:`, error);
      }
    }

    if (allAppointments.length === 0) return map;

    // 2. Build apptId → jobId map
    const apptToJob = new Map<number, number>();
    for (const a of allAppointments) {
      if (a.jobId) apptToJob.set(a.id, a.jobId);
    }

    // 3. Fetch assignments in batches of 50 appointment IDs
    const apptIds = Array.from(apptToJob.keys());
    const BATCH = 50;

    for (let i = 0; i < apptIds.length; i += BATCH) {
      const batch = apptIds.slice(i, i + BATCH);
      try {
        const assignments = await this.requestAllPages<STAppointmentAssignment>(
          `dispatch/v2/tenant/${this.tenantId}/appointment-assignments`,
          { appointmentIds: batch.join(',') },
          5
        );

        for (const assignment of assignments) {
          const jobId = apptToJob.get(assignment.appointmentId);
          if (jobId && !map.has(jobId)) {
            map.set(jobId, assignment.technicianId);
          }
        }
      } catch (error) {
        console.error(`Failed to get assignments for appointment batch:`, error);
      }
    }

    console.log(`Mapped ${map.size} jobs to technicians from ${allAppointments.length} appointments`);
    return map;
  }

  /**
   * Get tech-generated leads (TGLs) for a date range.
   *
   * A TGL is when a tech on a service call creates a lead for a new job.
   * ServiceTitan stores this on the GENERATED job as `jobGeneratedLeadSource`:
   *   { jobId: <source_job_id>, employeeId: <tech_id> }
   *
   * Per ST's definition of "Leads Set":
   * - Count unique source jobs where the tech is the Lead Setting Employee
   * - Date filter applies to the completion date of the ORIGINAL (source) job
   *
   * This method:
   * 1. Fetches all jobs created in a wide window (60 days back from endDate)
   * 2. Filters to jobs with jobGeneratedLeadSource.employeeId set
   * 3. Looks up the source job completion dates
   * 4. Returns TGL records with source job completion dates for date filtering
   */
  async getTechGeneratedLeads(startDate: string, endDate: string): Promise<STTechGeneratedLead[]> {
    // Fetch jobs created in a wider window — generated jobs may be created
    // days/weeks after the source job was completed
    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - 30);
    const wideStartDate = `${searchStart.getFullYear()}-${String(searchStart.getMonth() + 1).padStart(2, '0')}-${String(searchStart.getDate()).padStart(2, '0')}`;

    console.log(`Fetching jobs created ${wideStartDate} to ${endDate} to find TGLs...`);
    const allJobs = await this.requestAllPages<{
      id: number;
      jobGeneratedLeadSource?: { jobId?: number; employeeId?: number } | null;
      createdOn?: string;
    }>(
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      {
        createdOnOrAfter: `${wideStartDate}T00:00:00`,
        createdBefore: `${endDate}T23:59:59`,
      }
    );

    // Filter to jobs with jobGeneratedLeadSource.employeeId set
    const tglJobs = allJobs.filter(
      j => j.jobGeneratedLeadSource?.employeeId
    );
    console.log(`Found ${tglJobs.length} jobs with jobGeneratedLeadSource out of ${allJobs.length} total`);

    // Collect unique source job IDs to look up their completion dates
    const sourceJobIds = new Set<number>();
    for (const j of tglJobs) {
      if (j.jobGeneratedLeadSource?.jobId) {
        sourceJobIds.add(j.jobGeneratedLeadSource.jobId);
      }
    }

    // Fetch source jobs in batches to get their completion dates
    const sourceJobCompletionMap = new Map<number, string | null>();
    const sourceIdArray = Array.from(sourceJobIds);
    const BATCH = 50;

    for (let i = 0; i < sourceIdArray.length; i += BATCH) {
      const batch = sourceIdArray.slice(i, i + BATCH);
      try {
        const jobs = await this.request<STPagedResponse<{
          id: number;
          completedOn?: string;
          jobStatus?: string;
        }>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          { params: { ids: batch.join(','), pageSize: '50' } }
        );
        for (const job of (jobs.data || [])) {
          sourceJobCompletionMap.set(job.id, job.completedOn || null);
        }
      } catch (error) {
        console.error(`Failed to fetch source jobs batch:`, error);
      }
    }

    // Build TGL records
    const results: STTechGeneratedLead[] = [];
    for (const j of tglJobs) {
      const sourceJobId = j.jobGeneratedLeadSource!.jobId;
      const employeeId = j.jobGeneratedLeadSource!.employeeId!;

      if (!sourceJobId) continue;

      const completedOn = sourceJobCompletionMap.get(sourceJobId) ?? null;

      results.push({
        generatedJobId: j.id,
        sourceJobId,
        employeeId,
        sourceJobCompletedOn: completedOn,
      });
    }

    console.log(`Mapped ${results.length} TGLs with ${sourceJobCompletionMap.size} source job completion dates`);
    return results;
  }

  /**
   * Get sold estimates for a date range.
   * "Total Sales" per tech = sum of subtotals of estimates sold by that tech.
   */
  async getSoldEstimates(startDate: string, endDate: string): Promise<STEstimate[]> {
    const estimates = await this.requestAllPages<STEstimate>(
      `sales/v2/tenant/${this.tenantId}/estimates`,
      {
        soldAfter: startDate,
        soldBefore: endDate,
      }
    );

    return estimates.filter(est => est.status?.name === 'Sold');
  }

  /**
   * Get invoices for a date range. Returns a map of jobId → subtotal (pre-tax revenue).
   * Uses subTotal if available, otherwise sums non-tax line items, falls back to total.
   */
  async getInvoiceSubtotalsByJob(startDate: string, endDate: string): Promise<Map<number, number>> {
    const invoices = await this.requestAllPages<STInvoice>(
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      {
        createdOnOrAfter: `${startDate}T00:00:00`,
        createdBefore: `${endDate}T23:59:59`,
      }
    );

    const map = new Map<number, number>();

    for (const inv of invoices) {
      const jobId = inv.job?.id;
      if (!jobId) continue;
      // Skip adjustment invoices
      if (inv.adjustmentToId) continue;

      // Prefer subTotal field, fall back to total (parse to number — ST sometimes returns strings)
      const subtotal = Number(inv.subTotal ?? inv.total ?? 0) || 0;

      map.set(jobId, (map.get(jobId) || 0) + subtotal);
    }

    console.log(`Fetched subtotals for ${map.size} jobs from ${invoices.length} invoices`);
    return map;
  }

  /**
   * Get estimate counts per job for a date range.
   * Fetches ALL estimates (not just sold) to count options presented per opportunity.
   * Returns a Map of jobId → number of estimates created on that job.
   */
  async getEstimateCountsByJob(startDate: string, endDate: string): Promise<Map<number, number>> {
    const estimates = await this.requestAllPages<{ id: number; jobId?: number }>(
      `sales/v2/tenant/${this.tenantId}/estimates`,
      {
        createdOnOrAfter: `${startDate}T00:00:00`,
        createdBefore: `${endDate}T23:59:59`,
      }
    );

    const map = new Map<number, number>();
    for (const est of estimates) {
      if (!est.jobId) continue;
      map.set(est.jobId, (map.get(est.jobId) || 0) + 1);
    }

    console.log(`Fetched estimate counts for ${map.size} jobs from ${estimates.length} total estimates`);
    return map;
  }

  async getMembershipsSold(startDate: string, endDate: string): Promise<STMembership[]> {
    return this.requestAllPages<STMembership>(
      `memberships/v2/tenant/${this.tenantId}/memberships`,
      {
        createdOnOrAfter: `${startDate}T00:00:00`,
        createdBefore: `${endDate}T23:59:59`,
        active: 'True',
      }
    );
  }
}

// Singleton
let _client: ServiceTitanClient | null = null;

export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) {
    _client = new ServiceTitanClient();
  }
  return _client;
}
