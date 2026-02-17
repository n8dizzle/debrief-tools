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
  total?: number;
  summary?: string;
  type?: { name?: string };
  firstAppointmentId?: number;
  invoiceId?: number;
}

export interface STInvoice {
  id: number;
  invoiceNumber?: string;
  referenceNumber?: string;
  syncStatus?: string;
  invoiceDate?: string;
  status?: string;
  total?: number;
  balance?: number;
  job?: { id: number; number?: string };
  items?: Array<{
    id: number;
    displayName?: string;
    skuName?: string;
    description?: string;
    quantity?: number;
    price?: number;
    total?: number;
    type?: string;
  }>;
  employeeInfo?: { name?: string };
  exportStatus?: string;
}

export interface STTechnician {
  id: number;
  name: string;
  active: boolean;
  businessUnitId?: number;
}

export interface STAppointment {
  id: number;
  jobId: number;
  start?: string;
  end?: string;
  status?: string;
  // Populated by merging dispatch appointment-assignments data
  technicianId?: number;
}

export interface STAppointmentAssignment {
  id: number;
  technicianId: number;
  technicianName?: string;
  appointmentId: number;
  jobId?: number;
  status?: string;
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

export interface STGrossPayItem {
  id: number;
  employeeId: number;
  employeeType: string;
  jobId: number;
  jobNumber: string;
  paidDurationHours: number;
  paidTimeType: string;
  activity: string;
  startedOn: string;
  endedOn: string;
  date: string;
  amount: number;
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
  private businessUnitsCache: STBusinessUnit[] | null = null;
  private allBusinessUnitsCache: STBusinessUnit[] | null = null;
  private jobTypesCache: Map<number, string> | null = null;

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

  /** Fetch ALL business units (including inactive) for name/trade lookups. */
  async getAllBusinessUnits(): Promise<STBusinessUnit[]> {
    if (this.allBusinessUnitsCache) return this.allBusinessUnitsCache;

    // Fetch active and inactive separately, then merge (API defaults to active-only)
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
    this.allBusinessUnitsCache = all;
    return all;
  }

  /**
   * Get all job types and build a lookup map (id → name).
   * Cached for the lifetime of the client instance.
   */
  async getJobTypes(): Promise<Map<number, string>> {
    if (this.jobTypesCache) return this.jobTypesCache;

    try {
      const response = await this.request<STPagedResponse<{ id: number; name: string }>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/job-types`,
        { params: { pageSize: '200' } }
      );

      const map = new Map<number, string>();
      for (const jt of response.data || []) {
        map.set(jt.id, jt.name);
      }
      console.log(`Fetched ${map.size} job types`);
      this.jobTypesCache = map;
      return map;
    } catch (error) {
      console.error('Failed to fetch job types:', error);
      return new Map();
    }
  }

  /**
   * Get all technicians from ServiceTitan.
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

      if (page > 20) break;
    }

    return allTechnicians;
  }

  /** Get a single BU by ID (works for deleted/inactive BUs too). */
  async getBusinessUnitById(id: number): Promise<STBusinessUnit | null> {
    try {
      return await this.request<STBusinessUnit>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units/${id}`,
      );
    } catch {
      return null;
    }
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

  /**
   * Batch fetch jobs by their IDs. Returns a Map of jobId → STJob.
   */
  async getJobsByIds(jobIds: number[]): Promise<Map<number, STJob>> {
    const map = new Map<number, STJob>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
      const batch = jobIds.slice(i, i + BATCH_SIZE);
      try {
        const response = await this.request<STPagedResponse<STJob>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          { params: { ids: batch.join(','), pageSize: '50' } }
        );
        for (const job of (response.data || [])) {
          map.set(job.id, job);
        }
      } catch (error) {
        console.error(`Failed to fetch job batch:`, error);
      }
    }

    return map;
  }

  async getInvoice(invoiceId: number): Promise<STInvoice | null> {
    try {
      return await this.request<STInvoice>(
        'GET',
        `accounting/v2/tenant/${this.tenantId}/invoices/${invoiceId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get invoice ${invoiceId}:`, error);
      return null;
    }
  }

  /**
   * Batch fetch invoices by their IDs.
   * Returns a Map of invoiceId → STInvoice for successful fetches.
   */
  async getInvoicesByIds(invoiceIds: number[]): Promise<Map<number, STInvoice>> {
    const map = new Map<number, STInvoice>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < invoiceIds.length; i += BATCH_SIZE) {
      const batch = invoiceIds.slice(i, i + BATCH_SIZE);
      try {
        const response = await this.request<STPagedResponse<STInvoice>>(
          'GET',
          `accounting/v2/tenant/${this.tenantId}/invoices`,
          { params: { ids: batch.join(','), pageSize: '50' } }
        );
        for (const inv of (response.data || [])) {
          map.set(inv.id, inv);
        }
      } catch {
        // Fallback to individual fetches if bulk doesn't work
        const results = await Promise.allSettled(batch.map(id => this.getInvoice(id)));
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            map.set(batch[idx], result.value);
          }
        });
      }
    }

    return map;
  }

  /**
   * Fetch invoice data using Report 246 (AR Transactions Report).
   * This is the reliable way to get job-to-invoice mappings — the invoices
   * list endpoint doesn't support filtering by jobId or date range.
   *
   * Returns a Map of jobNumber → { invoiceId, invoiceNumber }.
   * Set includeZeroBalance=true to include fully paid invoices (needed for AP Payments).
   */
  async getInvoiceReport(includeZeroBalance: boolean = true): Promise<Map<string, { invoiceId: number; invoiceNumber: string }>> {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const map = new Map<string, { invoiceId: number; invoiceNumber: string }>();
    let page = 1;
    let hasMore = true;
    let jobNumberIdx = 2;
    let invoiceNumberIdx = 5;
    let invoiceIdIdx = 14;

    while (hasMore && page <= 50) {
      const response = await this.request<{
        fields: { name: string; label: string }[];
        data: any[][];
        hasMore: boolean;
        page: number;
        pageSize: number;
      }>(
        'POST',
        `reporting/v2/tenant/${this.tenantId}/report-category/accounting/reports/246/data`,
        {
          body: {
            parameters: [
              { name: 'AsOfDate', value: today },
              { name: 'ExcludeZeroNetBalanceInvoices', value: includeZeroBalance ? 'False' : 'True' },
            ],
            pageSize: 2000,
            page,
          },
        }
      );

      // Build field index map from first page
      if (page === 1) {
        const fieldMap = new Map<string, number>();
        (response.fields || []).forEach((f, i) => fieldMap.set(f.name, i));
        jobNumberIdx = fieldMap.get('JobNumber') ?? 2;
        invoiceNumberIdx = fieldMap.get('InvoiceNumber') ?? 5;
        invoiceIdIdx = fieldMap.get('TransactionId') ?? 14;
        console.log(`Invoice Report 246 fields: ${response.fields?.map(f => f.name).join(', ')}`);
      }

      for (const row of (response.data || [])) {
        const jobNumber = row[jobNumberIdx] ? String(row[jobNumberIdx]) : null;
        const invoiceNumber = (row[invoiceNumberIdx] || '').toString();
        const invoiceId = parseInt(row[invoiceIdIdx]) || 0;

        if (jobNumber && invoiceId > 0 && !map.has(jobNumber)) {
          map.set(jobNumber, { invoiceId, invoiceNumber });
        }
      }

      hasMore = response.hasMore === true;
      page++;
    }

    console.log(`Invoice Report: ${map.size} job→invoice mappings across ${page - 1} pages`);
    return map;
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
   * Get recent appointments (past N days) — used to capture labor hours for completed jobs.
   * Returns appointment maps only (no jobs), to be merged with job data from getRecentInstallJobs.
   */
  async getRecentAppointments(daysBehind: number = 14): Promise<{ appointmentMap: Map<number, string>; appointmentDetails: Map<number, STAppointment> }> {
    const today = new Date();
    const pastDate = new Date(today.getTime() - daysBehind * 24 * 60 * 60 * 1000);

    const pastStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}T00:00:00`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;

    try {
      const allBUs = await this.getBusinessUnits();
      const activeBuIds = allBUs.filter(bu => bu.active).map(bu => bu.id);

      const results = await Promise.allSettled(
        activeBuIds.map(buId =>
          this.requestAllPages<STAppointment>(
            `jpm/v2/tenant/${this.tenantId}/appointments`,
            {
              startsOnOrAfter: pastStr,
              startsBefore: todayStr,
              businessUnitId: buId.toString(),
            }
          )
        )
      );

      const appointmentMap = new Map<number, string>();
      const appointmentDetails = new Map<number, STAppointment>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const appt of result.value) {
            if (appt.jobId && appt.start) {
              const existing = appointmentMap.get(appt.jobId);
              if (!existing || appt.start < existing) {
                appointmentMap.set(appt.jobId, appt.start);
                appointmentDetails.set(appt.jobId, appt);
              }
            }
          }
        }
      }

      console.log(`Found ${appointmentMap.size} recent appointments (past ${daysBehind} days)`);
      return { appointmentMap, appointmentDetails };
    } catch (error) {
      console.error('Failed to get recent appointments:', error);
      return { appointmentMap: new Map(), appointmentDetails: new Map() };
    }
  }

  /**
   * Get upcoming install appointments scheduled within the next N days,
   * then return the associated jobs. ST jobs don't have scheduledOn —
   * scheduled dates live on appointments.
   */
  async getUpcomingInstallJobs(daysAhead: number = 30): Promise<{ jobs: STJob[]; appointmentMap: Map<number, string>; appointmentDetails: Map<number, STAppointment> }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`;
    const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T23:59:59`;

    try {
      // Fetch appointments from ALL active BUs (ST appointments API requires a BU param)
      const allBUs = await this.getBusinessUnits();
      const activeBuIds = allBUs.filter(bu => bu.active).map(bu => bu.id);
      if (activeBuIds.length === 0) {
        console.warn('No active business units found');
        return { jobs: [], appointmentMap: new Map(), appointmentDetails: new Map() };
      }

      const results = await Promise.allSettled(
        activeBuIds.map(buId =>
          this.request<STPagedResponse<STAppointment>>(
            'GET',
            `jpm/v2/tenant/${this.tenantId}/appointments`,
            {
              params: {
                startsOnOrAfter: todayStr,
                startsBefore: futureStr,
                businessUnitId: buId.toString(),
                pageSize: '200',
              },
            }
          )
        )
      );

      // Build jobId → earliest appointment start map + full appointment details
      const appointmentMap = new Map<number, string>();
      const appointmentDetails = new Map<number, STAppointment>();
      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const appt of (result.value.data || [])) {
            if (appt.jobId && appt.start) {
              const existing = appointmentMap.get(appt.jobId);
              if (!existing || appt.start < existing) {
                appointmentMap.set(appt.jobId, appt.start);
                appointmentDetails.set(appt.jobId, appt);
              }
            }
          }
        }
      }

      console.log(`Found ${appointmentMap.size} upcoming jobs from appointments across ${activeBuIds.length} BUs`);

      // Fetch the actual jobs for these appointment job IDs
      const jobIds = Array.from(appointmentMap.keys());
      if (jobIds.length === 0) return { jobs: [], appointmentMap, appointmentDetails };

      // Fetch jobs in batches of 50 using the ids param
      const jobs: STJob[] = [];
      const batchSize = 50;
      for (let i = 0; i < jobIds.length; i += batchSize) {
        const batch = jobIds.slice(i, i + batchSize);
        const response = await this.request<STPagedResponse<STJob>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          {
            params: {
              ids: batch.join(','),
              pageSize: '50',
            },
          }
        );
        const filtered = (response.data || []).filter(
          job => !['Canceled'].includes(job.jobStatus)
        );
        jobs.push(...filtered);
      }

      return { jobs, appointmentMap, appointmentDetails };
    } catch (error) {
      console.error('Failed to get upcoming install jobs:', error);
      return { jobs: [], appointmentMap: new Map(), appointmentDetails: new Map() };
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
      // Fetch ALL completed jobs without BU filter, paginated
      const allJobs = await this.requestAllPages<STJob>(
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        {
          completedOnOrAfter: pastStr,
          completedOnOrBefore: todayStr,
        }
      );

      console.log(`Found ${allJobs.length} recent jobs (last ${daysBehind} days)`);
      return allJobs;
    } catch (error) {
      console.error('Failed to get recent install jobs:', error);
      return [];
    }
  }

  /**
   * Get all install jobs and appointments since a given date (for backfill).
   * Fetches both completed jobs and appointments to cover all jobs in the range.
   */
  async getInstallJobsSince(
    startDate: string,
    endDate?: string
  ): Promise<{ jobs: STJob[]; appointmentMap: Map<number, string>; appointmentDetails: Map<number, STAppointment> }> {
    const today = new Date();
    const endStr = endDate
      ? `${endDate}T23:59:59`
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59`;
    const startStr = `${startDate}T00:00:00`;

    // Fetch appointments from ALL active BUs (ST appointments API requires a BU param)
    const allBUs = await this.getBusinessUnits();
    const activeBuIds = allBUs.filter(bu => bu.active).map(bu => bu.id);

    const apptResults = await Promise.allSettled(
      activeBuIds.map(buId =>
        this.requestAllPages<STAppointment>(
          `jpm/v2/tenant/${this.tenantId}/appointments`,
          {
            startsOnOrAfter: startStr,
            startsBefore: endStr,
            businessUnitId: buId.toString(),
          }
        )
      )
    );

    const appointmentMap = new Map<number, string>();
    const appointmentDetails = new Map<number, STAppointment>();
    for (const result of apptResults) {
      if (result.status === 'fulfilled') {
        for (const appt of result.value) {
          if (appt.jobId && appt.start) {
            const existing = appointmentMap.get(appt.jobId);
            if (!existing || appt.start < existing) {
              appointmentMap.set(appt.jobId, appt.start);
              appointmentDetails.set(appt.jobId, appt);
            }
          }
        }
      }
    }

    // Fetch ALL completed jobs in the date range (no BU filter)
    const allJobs = await this.requestAllPages<STJob>(
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      {
        completedOnOrAfter: startStr,
        completedOnOrBefore: endStr,
      }
    );

    const jobMap = new Map<number, STJob>();
    for (const job of allJobs) {
      if (!['Canceled'].includes(job.jobStatus)) {
        jobMap.set(job.id, job);
      }
    }

    // Also fetch jobs referenced by appointments but not yet completed
    const apptJobIds = Array.from(appointmentMap.keys()).filter(id => !jobMap.has(id));
    if (apptJobIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < apptJobIds.length; i += batchSize) {
        const batch = apptJobIds.slice(i, i + batchSize);
        try {
          const response = await this.request<STPagedResponse<STJob>>(
            'GET',
            `jpm/v2/tenant/${this.tenantId}/jobs`,
            { params: { ids: batch.join(','), pageSize: '50' } }
          );
          for (const job of (response.data || [])) {
            if (!['Canceled'].includes(job.jobStatus)) {
              jobMap.set(job.id, job);
            }
          }
        } catch (err) {
          console.error(`Failed to fetch job batch:`, err);
        }
      }
    }

    const jobs = Array.from(jobMap.values());
    console.log(`Backfill: Found ${jobs.length} jobs and ${appointmentMap.size} appointments since ${startDate}`);
    return { jobs, appointmentMap, appointmentDetails };
  }

  /**
   * Paginate through all results for an endpoint.
   */
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
      if (page > 20) break; // Safety limit
    }

    return all;
  }

  /**
   * Get appointment details for a job (to extract scheduled date)
   */
  async getAppointment(appointmentId: number): Promise<STAppointment | null> {
    try {
      return await this.request<STAppointment>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/appointments/${appointmentId}`,
        {}
      );
    } catch (error) {
      console.error(`Failed to get appointment ${appointmentId}:`, error);
      return null;
    }
  }

  /**
   * Fetch appointment assignments from the dispatch API.
   * Returns a map of appointmentId → array of technicianIds (supports multiple techs per job).
   */
  async getAppointmentAssignments(appointmentIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (appointmentIds.length === 0) return map;

    try {
      // Fetch in batches
      const batchSize = 50;
      for (let i = 0; i < appointmentIds.length; i += batchSize) {
        const batch = appointmentIds.slice(i, i + batchSize);
        const response = await this.request<STPagedResponse<STAppointmentAssignment>>(
          'GET',
          `dispatch/v2/tenant/${this.tenantId}/appointment-assignments`,
          { params: { appointmentIds: batch.join(','), pageSize: '200' } }
        );
        for (const assignment of (response.data || [])) {
          if (assignment.appointmentId && assignment.technicianId) {
            const existing = map.get(assignment.appointmentId) || [];
            if (!existing.includes(assignment.technicianId)) {
              existing.push(assignment.technicianId);
            }
            map.set(assignment.appointmentId, existing);
          }
        }
      }
      const totalAssignments = Array.from(map.values()).reduce((s, a) => s + a.length, 0);
      console.log(`Fetched ${totalAssignments} technician assignments across ${map.size} appointments`);
    } catch (error) {
      console.error('Failed to fetch appointment assignments:', error);
    }

    return map;
  }

  /**
   * Fetch gross pay items (timesheet data) from the Payroll API.
   * Returns a Map of jobId → array of pay items (multiple entries per job — one per tech per time type).
   * This gives actual hours worked, not scheduled appointment windows.
   */
  async getGrossPayItems(startDate: string, endDate: string): Promise<Map<number, STGrossPayItem[]>> {
    const map = new Map<number, STGrossPayItem[]>();

    try {
      const allItems = await this.requestAllPages<STGrossPayItem>(
        `payroll/v2/tenant/${this.tenantId}/gross-pay-items`,
        {
          dateOnOrAfter: startDate,
          dateOnOrBefore: endDate,
        }
      );

      for (const item of allItems) {
        if (item.jobId && item.paidDurationHours > 0) {
          const existing = map.get(item.jobId) || [];
          existing.push(item);
          map.set(item.jobId, existing);
        }
      }

      console.log(`Fetched ${allItems.length} gross pay items across ${map.size} jobs (${startDate} to ${endDate})`);
    } catch (error) {
      console.error('Failed to fetch gross pay items:', error);
    }

    return map;
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
