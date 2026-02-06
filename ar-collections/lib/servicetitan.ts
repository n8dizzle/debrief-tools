/**
 * ServiceTitan API client for AR Collections.
 * Extended from daily-dash implementation with AR-specific methods.
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
  tagTypeIds?: number[];
  type?: { name?: string };
  lastAppointmentId?: number;
  membershipId?: number | null;
  projectId?: number | null;
}

export interface STProject {
  id: number;
  number?: string;
  name?: string;
  status?: string;
  customerId?: number;
}

export interface STAppointment {
  id: number;
  jobId: number;
  start?: string;
  end?: string;
  arrivalWindowStart?: string;
  arrivalWindowEnd?: string;
  status?: string;
  // Payment type collected at booking
  paymentType?: string;
  paymentMethod?: string;
  // Other potential fields
  specialInstructions?: string;
  summary?: string;
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
  invoiceConfiguration?: string; // e.g., "MembershipInvoice"
}

interface STInvoiceItem {
  id: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  membershipTypeId?: number;
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

export interface STTask {
  id: number;
  jobId?: number;
  customerId?: number;
  sourceId?: number;
  typeId?: number;
  resolutionId?: number;
  status?: string;
  priority?: number;
  dueDate?: string;
  subject?: string;
  description?: string;
  completedOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  assignedTo?: { id: number; name: string };
}

export interface STTaskCreate {
  jobId?: number;
  customerId?: number;
  employeeTaskSourceId: number;
  employeeTaskTypeId: number;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
  dueDate?: string;
  name: string;
  body: string;
  isClosed: boolean;
  assignedToId: number;
  reportedById: number;
  reportedDate: string;
  businessUnitId?: number;
}

export interface STTaskUpdate {
  status?: string;
  resolutionId?: number;
  priority?: number;
  dueDate?: string;
  subject?: string;
  description?: string;
  completedOn?: string;
  assignedTo?: number;
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

export interface STLocationTag {
  tagTypeId: number;
  tagTypeName?: string;
}

export interface STLocation {
  id: number;
  name?: string;
  customerId?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  tagTypes?: STLocationTag[];
}


interface STPagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * AR Report Row from Report 246 (AR Transactions)
 * This report gives invoice-level AR data with real IDs
 */
export interface ARReportRow {
  customerName: string;
  customerId: number;
  locationName: string;
  jobNumber: string | null;
  invoiceNumber: string;
  invoiceId: number;
  businessUnitName: string;
  createdDate: string;
  transactionDate: string;
  paymentDueDate: string;
  completionDate: string | null;
  netAmount: number;
  current: number;
  aging30: number;
  aging60: number;
  aging90: number;
  aging120: number;
  aging121Plus: number;
  total: number;
  subtotal: number;
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
   * Get AR Transactions report (Report 246)
   * This is the authoritative source for AR data with invoice-level detail
   * Returns all invoices with open balances, including real IDs
   */
  async getARTransactionsReport(): Promise<ARReportRow[]> {
    // Always use today's date to get current AR data
    const today = new Date().toISOString().split('T')[0];
    console.log(`Fetching AR Transactions Report (246) from ServiceTitan as of ${today}...`);

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
            { name: 'ExcludeZeroNetBalanceInvoices', value: 'True' }
          ],
          pageSize: 2000
        }
      }
    );

    // Build field index map from response
    const fieldMap = new Map<string, number>();
    (response.fields || []).forEach((f, i) => fieldMap.set(f.name, i));

    // Log available fields for debugging
    console.log('Report 246 fields:', response.fields?.map(f => f.name).join(', '));

    // Map field names to indices (based on Report 246 structure)
    const idx = {
      customerName: fieldMap.get('CustomerName') ?? 0,
      locationName: fieldMap.get('LocationName') ?? 1,
      jobNumber: fieldMap.get('JobNumber') ?? 2,
      businessUnitName: fieldMap.get('InvoiceBusinessUnit') ?? 3,
      completionDate: fieldMap.get('CompletionDate') ?? 4,
      invoiceNumber: fieldMap.get('InvoiceNumber') ?? 5,
      createdDate: fieldMap.get('CreatedDate') ?? 6,
      transactionType: fieldMap.get('TransactionType') ?? 7,
      transactionDate: fieldMap.get('TransactionDate') ?? 8,
      paymentDueDate: fieldMap.get('PaymentDueDate') ?? 9,
      netAmount: fieldMap.get('NetAmount') ?? 10,
      current: fieldMap.get('Current') ?? 11,
      aging30: fieldMap.get('Aging30') ?? 12,
      aging60: fieldMap.get('Aging60') ?? 13,
      invoiceId: fieldMap.get('TransactionId') ?? 14,
      aging90: fieldMap.get('Aging90') ?? 15,
      aging120: fieldMap.get('Aging120') ?? 16,
      aging121Plus: fieldMap.get('AgingPast120') ?? 17,
      total: fieldMap.get('Total') ?? 18,
      subtotal: fieldMap.get('Subtotal') ?? 19,
      customerId: fieldMap.get('CustomerId') ?? 20,
    };

    // Parse rows into structured data
    const rows: ARReportRow[] = (response.data || []).map(row => ({
      customerName: (row[idx.customerName] || '').toString().trim(),
      customerId: parseInt(row[idx.customerId]) || 0,
      locationName: (row[idx.locationName] || '').toString().trim(),
      jobNumber: row[idx.jobNumber] ? String(row[idx.jobNumber]) : null,
      invoiceNumber: (row[idx.invoiceNumber] || '').toString(),
      invoiceId: parseInt(row[idx.invoiceId]) || 0,
      businessUnitName: (row[idx.businessUnitName] || '').toString(),
      createdDate: row[idx.createdDate] || '',
      transactionDate: row[idx.transactionDate] || '',
      paymentDueDate: row[idx.paymentDueDate] || '',
      completionDate: row[idx.completionDate] || null,
      netAmount: parseFloat(row[idx.netAmount]) || 0,
      current: parseFloat(row[idx.current]) || 0,
      aging30: parseFloat(row[idx.aging30]) || 0,
      aging60: parseFloat(row[idx.aging60]) || 0,
      aging90: parseFloat(row[idx.aging90]) || 0,
      aging120: parseFloat(row[idx.aging120]) || 0,
      aging121Plus: parseFloat(row[idx.aging121Plus]) || 0,
      total: parseFloat(row[idx.total]) || 0,
      subtotal: parseFloat(row[idx.subtotal]) || 0,
    }));

    // Filter to only INV transactions with positive balance (exclude payments/credits)
    const filtered = rows.filter(r => r.netAmount > 0 && r.invoiceId > 0);

    const totalAR = filtered.reduce((sum, r) => sum + r.netAmount, 0);
    console.log(`AR Report 246: ${response.data?.length || 0} total rows, ${filtered.length} invoices with balance > 0, Total AR: $${totalAR.toFixed(2)}`);

    return filtered;
  }

  /**
   * Get technician names for jobs by fetching individual job details
   * Returns a map of jobNumber -> technicianName
   */
  async getTechniciansByJobNumbers(jobNumbers: string[]): Promise<Map<string, string>> {
    const techMap = new Map<string, string>();
    if (jobNumbers.length === 0) return techMap;

    const uniqueJobNumbers = new Set(jobNumbers.filter(Boolean));
    console.log(`Looking up technicians for ${uniqueJobNumbers.size} jobs...`);

    // Step 1: Fetch jobs from the last 2 years and collect job IDs for the ones we need
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split('T')[0];

    const jobIdToNumber = new Map<number, string>(); // jobId -> jobNumber
    let page = 1;
    const maxPages = 50;

    while (page <= maxPages) {
      try {
        const params: Record<string, string> = {
          completedOnOrAfter: `${startDate}T00:00:00Z`,
          page: page.toString(),
          pageSize: '100',
        };

        const response = await this.request<STPagedResponse<{
          id: number;
          jobNumber: string;
        }>>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs`,
          { params }
        );

        for (const job of response.data || []) {
          if (uniqueJobNumbers.has(job.jobNumber)) {
            jobIdToNumber.set(job.id, job.jobNumber);
          }
        }

        if (!response.hasMore) break;
        page++;

        if (page % 5 === 0) {
          await this.delay(100);
        }
      } catch (error) {
        console.error(`Failed to fetch jobs page ${page}:`, error);
        break;
      }
    }

    console.log(`Found ${jobIdToNumber.size} job IDs to look up (scanned ${page} pages)`);

    if (jobIdToNumber.size === 0) return techMap;

    // Step 2: Fetch individual job details which may include technician info
    const jobIds = [...jobIdToNumber.keys()];
    console.log(`Fetching ${jobIds.length} individual job details...`);

    for (let i = 0; i < jobIds.length; i++) {
      const jobId = jobIds[i];
      try {
        const response = await this.request<{
          id: number;
          jobNumber: string;
          technician?: { id: number; name: string };
          soldBy?: { id: number; name: string };
          createdBy?: { id: number; name: string };
        }>(
          'GET',
          `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`,
          {}
        );

        // Log first job detail structure
        if (i === 0) {
          console.log('Individual job detail response keys:', Object.keys(response).join(', '));
          if (response.technician) {
            console.log('Technician found:', response.technician);
          }
        }

        const jobNumber = jobIdToNumber.get(jobId);
        const techName = response.technician?.name;

        if (jobNumber && techName) {
          techMap.set(jobNumber, techName);
        }
      } catch (error) {
        // Skip failures
      }

      // Rate limiting - every 10 requests
      if (i % 10 === 9) {
        await this.delay(100);
      }
    }

    console.log(`Found technicians for ${techMap.size} of ${uniqueJobNumbers.size} jobs`);
    return techMap;
  }

  /**
   * Get customers in batches (for contact info lookup)
   * Handles larger sets by chunking
   */
  async getCustomersInBatches(customerIds: number[]): Promise<STCustomer[]> {
    if (customerIds.length === 0) return [];

    const uniqueIds = [...new Set(customerIds)];
    const allCustomers: STCustomer[] = [];

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batchIds = uniqueIds.slice(i, i + batchSize);
      const customers = await this.getCustomers(batchIds);
      allCustomers.push(...customers);

      // Rate limiting between batches
      if (i + batchSize < uniqueIds.length) {
        await this.delay(200);
      }
    }

    return allCustomers;
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(invoiceId: number): Promise<STInvoice | null> {
    // ServiceTitan requires using ids query param, not path param
    const response = await this.request<STPagedResponse<STInvoice>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params: { ids: invoiceId.toString(), pageSize: '1' } }
    );
    return response.data?.[0] || null;
  }

  /**
   * Get invoice by invoice number (searches invoices)
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<STInvoice | null> {
    const response = await this.request<STPagedResponse<STInvoice>>(
      'GET',
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params: { number: invoiceNumber, pageSize: '1' } }
    );
    return response.data?.[0] || null;
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
   * Get all business units
   */
  async getBusinessUnits(): Promise<{ id: number; name: string }[]> {
    try {
      const response = await this.request<STPagedResponse<{ id: number; name: string; active: boolean }>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: '100', active: 'true' } }
      );
      return (response.data || []).map(bu => ({ id: bu.id, name: bu.name }));
    } catch (error) {
      console.error('Failed to get business units:', error);
      return [];
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
   * Get job details by ID
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
   * Get location details by ID (includes tags)
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
   * Check if a location has any membership-related tags
   */
  locationHasMembershipTag(location: STLocation | null): boolean {
    if (!location?.tagTypes || location.tagTypes.length === 0) {
      return false;
    }
    // Check if any tag name contains "membership" (case-insensitive)
    return location.tagTypes.some(tag =>
      tag.tagTypeName?.toLowerCase().includes('membership')
    );
  }

  /**
   * Check if an invoice indicates a membership
   * Returns true if:
   * - invoiceConfiguration is "MembershipInvoice"
   * - Any line item has membershipTypeId > 0
   */
  invoiceIndicatesMembership(invoice: STInvoice | null): boolean {
    if (!invoice) return false;

    // Check invoice configuration
    if (invoice.invoiceConfiguration === 'MembershipInvoice') {
      return true;
    }

    // Check line items for membership type
    const invoiceAny = invoice as any;
    if (Array.isArray(invoiceAny.items)) {
      return invoiceAny.items.some((item: any) =>
        item.membershipTypeId && item.membershipTypeId > 0
      );
    }

    return false;
  }

  /**
   * Get appointment details by ID
   */
  async getAppointment(appointmentId: number): Promise<STAppointment | null> {
    try {
      const response = await this.request<any>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/appointments/${appointmentId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get appointment ${appointmentId}:`, error);
      return null;
    }
  }

  /**
   * Get appointments for a job
   */
  async getJobAppointments(jobId: number): Promise<STAppointment[]> {
    try {
      const response = await this.request<STPagedResponse<STAppointment>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/appointments`,
        { params: { jobId: jobId.toString(), pageSize: '50' } }
      );
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get appointments for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Get booking details by ID
   */
  async getBooking(bookingId: number): Promise<any | null> {
    try {
      const response = await this.request<any>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/bookings/${bookingId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get booking ${bookingId}:`, error);
      return null;
    }
  }

  /**
   * Get bookings for a customer (to find payment type)
   */
  async getCustomerBookings(customerId: number): Promise<any[]> {
    try {
      const response = await this.request<STPagedResponse<any>>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/bookings`,
        { params: { customerId: customerId.toString(), pageSize: '50' } }
      );
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get bookings for customer ${customerId}:`, error);
      return [];
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
  // TAG METHODS
  // ============================================

  /**
   * Get all tag types (fetches all pages)
   * Tries multiple API paths as ServiceTitan's API structure varies
   */
  async getTagTypes(): Promise<{ id: number; name: string; active: boolean }[]> {
    // Try different possible endpoints
    const endpoints = [
      `settings/v2/tenant/${this.tenantId}/tag-types`,
      `jpm/v2/tenant/${this.tenantId}/tag-types`,
      `crm/v2/tenant/${this.tenantId}/tag-types`,
    ];

    for (const endpoint of endpoints) {
      try {
        const allTags: { id: number; name: string; active: boolean }[] = [];
        let page = 1;
        const maxPages = 10;

        while (page <= maxPages) {
          const response = await this.request<STPagedResponse<{
            id: number;
            name: string;
            active: boolean;
          }>>(
            'GET',
            endpoint,
            { params: { pageSize: '200', page: page.toString() } }
          );

          if (response.data && response.data.length > 0) {
            allTags.push(...response.data);
          }

          if (!response.hasMore || !response.data || response.data.length === 0) {
            break;
          }
          page++;
        }

        if (allTags.length > 0) {
          console.log(`Found ${allTags.length} tag types from ${endpoint}`);
          return allTags;
        }
      } catch (error) {
        console.log(`Endpoint ${endpoint} failed, trying next...`);
      }
    }

    console.error('All tag-types endpoints failed');
    return [];
  }

  /**
   * In-house Financing tag ID (discovered via test-tags endpoint)
   */
  static readonly IN_HOUSE_FINANCING_TAG_ID = 158479256;

  // Cache for job types to avoid repeated API calls
  private jobTypesCache: Map<number, string> | null = null;

  /**
   * Get all job types and build a lookup map
   */
  async getJobTypes(): Promise<Map<number, string>> {
    if (this.jobTypesCache) {
      return this.jobTypesCache;
    }

    try {
      const response = await this.request<STPagedResponse<{
        id: number;
        name: string;
      }>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/job-types`,
        { params: { pageSize: '200' } }
      );

      const jobTypeMap = new Map<number, string>();
      for (const jt of response.data || []) {
        jobTypeMap.set(jt.id, jt.name);
      }
      console.log(`Fetched ${jobTypeMap.size} job types`);
      this.jobTypesCache = jobTypeMap;
      return jobTypeMap;
    } catch (error) {
      console.error('Failed to fetch job types:', error);
      return new Map();
    }
  }

  /**
   * Get job info for multiple job numbers
   * Returns a map of job number -> { hasInhouseFinancing, jobStatus, jobTypeName, hasMembership, bookingPaymentType, nextAppointmentDate }
   */
  async getJobInfoBatch(jobNumbers: string[]): Promise<Map<string, { jobId: number; hasInhouseFinancing: boolean; jobStatus: string | null; jobTypeName: string | null; hasMembership: boolean; bookingPaymentType: string | null; nextAppointmentDate: string | null; locationId: number | null; projectId: number | null; projectName: string | null }>> {
    const jobInfoMap = new Map<string, { jobId: number; hasInhouseFinancing: boolean; jobStatus: string | null; jobTypeName: string | null; hasMembership: boolean; bookingPaymentType: string | null; nextAppointmentDate: string | null; locationId: number | null; projectId: number | null; projectName: string | null }>();
    if (jobNumbers.length === 0) return jobInfoMap;

    // Fetch job types first for name lookup
    const jobTypeMap = await this.getJobTypes();

    const uniqueJobNumbers = [...new Set(jobNumbers.filter(Boolean))];
    console.log(`Fetching info for ${uniqueJobNumbers.length} jobs...`);

    // Fetch jobs in batches by job number
    const batchSize = 50;
    for (let i = 0; i < uniqueJobNumbers.length; i += batchSize) {
      const batch = uniqueJobNumbers.slice(i, i + batchSize);

      for (const jobNumber of batch) {
        try {
          const job = await this.getJobByNumber(jobNumber);
          if (job) {
            const jobAny = job as any;
            const hasInhouseFinancing = job.tagTypeIds?.includes(ServiceTitanClient.IN_HOUSE_FINANCING_TAG_ID) || false;
            // Look up job type name from ID
            const jobTypeName = job.jobTypeId ? jobTypeMap.get(job.jobTypeId) || null : null;

            // Check if job is tied to a membership via multiple sources:
            // 1. Job has membershipId set
            // 2. Custom field "Are they a member?" = "Yes"
            let hasMembership = job.membershipId != null && job.membershipId > 0;

            // Check custom field "Are they a member?"
            if (!hasMembership && Array.isArray(jobAny.customFields)) {
              const memberField = jobAny.customFields.find(
                (cf: any) => cf.name === 'Are they a member?' || cf.typeId === 173706782
              );
              if (memberField?.value?.toLowerCase() === 'yes') {
                hasMembership = true;
              }
            }

            // Get payment type from customFields array
            // The field is: {"typeId": 174250392, "name": "Payment Type?", "value": "Cash/Check"}
            let bookingPaymentType: string | null = null;

            if (Array.isArray(jobAny.customFields)) {
              const paymentTypeField = jobAny.customFields.find(
                (cf: any) => cf.name === 'Payment Type?' || cf.typeId === 174250392
              );
              if (paymentTypeField?.value) {
                bookingPaymentType = paymentTypeField.value;
              }
            }

            // Check for next scheduled appointment
            let nextAppointmentDate: string | null = null;
            try {
              const appointments = await this.getJobAppointments(job.id);
              const now = new Date();

              // Log first job's appointment statuses for debugging
              if (jobInfoMap.size === 0 && appointments.length > 0) {
                console.log(`Job ${jobNumber} appointments:`, appointments.map((a: any) => ({
                  status: a.status,
                  start: a.start,
                  isFuture: a.start ? new Date(a.start) > now : false
                })));
              }

              // Find appointments that are scheduled (not done/canceled) or in the future
              const futureAppts = appointments.filter((appt: any) => {
                const apptStart = appt.start ? new Date(appt.start) : null;
                const isScheduled = appt.status === 'Scheduled' || appt.status === 'Dispatched' || appt.status === 'Working';
                const isFuture = apptStart && apptStart > now;
                return isScheduled || isFuture;
              });
              // Get the earliest future appointment
              if (futureAppts.length > 0) {
                futureAppts.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
                nextAppointmentDate = futureAppts[0].start || null;
              }
            } catch (e) {
              // Skip appointment fetch failures
            }

            // Get project name if projectId exists
            let projectName: string | null = null;
            const projectId = job.projectId || null;
            if (projectId) {
              try {
                const project = await this.getProject(projectId);
                projectName = project?.name || project?.number || null;
              } catch (e) {
                // Skip project fetch failures
              }
            }

            jobInfoMap.set(jobNumber, {
              jobId: job.id,
              hasInhouseFinancing,
              jobStatus: job.jobStatus || null,
              jobTypeName,
              hasMembership,
              bookingPaymentType,
              nextAppointmentDate,
              locationId: job.locationId || null,
              projectId,
              projectName,
            });
          }
        } catch (error) {
          // Skip failures silently
        }
      }

      // Rate limiting between batches
      if (i + batchSize < uniqueJobNumbers.length) {
        await this.delay(200);
      }
    }

    const inhouseCount = Array.from(jobInfoMap.values()).filter(j => j.hasInhouseFinancing).length;
    const projectCount = Array.from(jobInfoMap.values()).filter(j => j.projectId).length;
    console.log(`Found ${inhouseCount} jobs with In-house Financing tag, ${projectCount} with projects`);
    return jobInfoMap;
  }

  /**
   * Get project details by ID
   */
  async getProject(projectId: number): Promise<STProject | null> {
    try {
      const response = await this.request<STProject>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/projects/${projectId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Check which job numbers have the In-house Financing tag
   * Returns a Set of job numbers that have the tag
   * @deprecated Use getJobInfoBatch instead for more info
   */
  async getJobsWithInhouseFinancing(jobNumbers: string[]): Promise<Set<string>> {
    const jobInfo = await this.getJobInfoBatch(jobNumbers);
    const inhouseJobNumbers = new Set<string>();
    for (const [jobNumber, info] of jobInfo) {
      if (info.hasInhouseFinancing) {
        inhouseJobNumbers.add(jobNumber);
      }
    }
    return inhouseJobNumbers;
  }

  /**
   * Get jobs, optionally filtered by tag type ID
   */
  async getJobsByTagTypeId(tagTypeId: number | null, options: { completedOnOrAfter?: string; pageSize?: number } = {}): Promise<STJob[]> {
    try {
      const params: Record<string, string> = {
        pageSize: (options.pageSize || 100).toString(),
      };

      if (tagTypeId && tagTypeId > 0) {
        params.tagTypeIds = tagTypeId.toString();
      }

      if (options.completedOnOrAfter) {
        params.completedOnOrAfter = `${options.completedOnOrAfter}T00:00:00Z`;
      }

      const response = await this.request<STPagedResponse<STJob>>(
        'GET',
        `jpm/v2/tenant/${this.tenantId}/jobs`,
        { params }
      );

      console.log(`Found ${response.data?.length || 0} jobs${tagTypeId ? ` with tag ID ${tagTypeId}` : ''}`);
      return response.data || [];
    } catch (error) {
      console.error(`Failed to fetch jobs${tagTypeId ? ` with tag ${tagTypeId}` : ''}:`, error);
      return [];
    }
  }

  // ============================================
  // TASK MANAGEMENT METHODS
  // ============================================

  /**
   * ServiceTitan Task types
   */

  /**
   * Get task management data (sources, types, resolutions, priorities)
   * This is the combined endpoint that returns all task configuration
   */
  async getTaskManagementData(): Promise<{
    sources: { id: number; name: string; active: boolean }[];
    types: { id: number; name: string; active: boolean }[];
    resolutions: { id: number; name: string; active: boolean }[];
  }> {
    try {
      const response = await this.request<{
        sources?: { id: number; name: string; active?: boolean }[];
        types?: { id: number; name: string; active?: boolean }[];
        resolutions?: { id: number; name: string; active?: boolean }[];
        taskSources?: { id: number; name: string; active?: boolean }[];
        taskTypes?: { id: number; name: string; active?: boolean }[];
        taskResolutions?: { id: number; name: string; active?: boolean }[];
      }>(
        'GET',
        `taskmanagement/v2/tenant/${this.tenantId}/data`,
        {}
      );
      console.log('Task management data response:', JSON.stringify(response).slice(0, 1000));

      // Handle different possible response structures
      const sources = (response.sources || response.taskSources || []).map(s => ({
        id: s.id,
        name: s.name,
        active: s.active ?? true,
      }));
      const types = (response.types || response.taskTypes || []).map(t => ({
        id: t.id,
        name: t.name,
        active: t.active ?? true,
      }));
      const resolutions = (response.resolutions || response.taskResolutions || []).map(r => ({
        id: r.id,
        name: r.name,
        active: r.active ?? true,
      }));

      return { sources, types, resolutions };
    } catch (error) {
      console.error('Failed to fetch task management data:', error);
      return { sources: [], types: [], resolutions: [] };
    }
  }

  /**
   * Get task sources (e.g., "AR Collections", "Service Call")
   */
  async getTaskSources(): Promise<{ id: number; name: string; active: boolean }[]> {
    const data = await this.getTaskManagementData();
    return data.sources;
  }

  /**
   * Get task types (e.g., "Follow Up Call", "Send Email")
   */
  async getTaskTypes(): Promise<{ id: number; name: string; active: boolean }[]> {
    const data = await this.getTaskManagementData();
    return data.types;
  }

  /**
   * Get task resolutions (e.g., "Completed", "Cancelled", "Left Voicemail")
   */
  async getTaskResolutions(): Promise<{ id: number; name: string; active: boolean }[]> {
    const data = await this.getTaskManagementData();
    return data.resolutions;
  }

  /**
   * Get employees from ServiceTitan
   */
  async getEmployees(): Promise<{ id: number; name: string; active: boolean }[]> {
    try {
      const response = await this.request<STPagedResponse<{
        id: number;
        name: string;
        active: boolean;
      }>>(
        'GET',
        `settings/v2/tenant/${this.tenantId}/employees`,
        { params: { pageSize: '500', active: 'true' } }
      );
      console.log(`Fetched ${response.data?.length || 0} employees from ST`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      return [];
    }
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(taskId: number): Promise<STTask | null> {
    try {
      const response = await this.request<STTask>(
        'GET',
        `taskmanagement/v2/tenant/${this.tenantId}/tasks/${taskId}`,
        {}
      );
      return response;
    } catch (error) {
      console.error(`Failed to get task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get tasks for a job
   */
  async getTasksForJob(jobId: number): Promise<STTask[]> {
    try {
      const response = await this.request<STPagedResponse<STTask>>(
        'GET',
        `taskmanagement/v2/tenant/${this.tenantId}/tasks`,
        { params: { jobId: jobId.toString(), pageSize: '100' } }
      );
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get tasks for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Create a task in ServiceTitan
   */
  async createTask(task: STTaskCreate): Promise<STTask | null> {
    try {
      const response = await this.request<STTask>(
        'POST',
        `taskmanagement/v2/tenant/${this.tenantId}/tasks`,
        { body: task }
      );
      return response;
    } catch (error) {
      console.error('Failed to create task:', error);
      return null;
    }
  }

  /**
   * Update a task in ServiceTitan
   */
  async updateTask(taskId: number, updates: STTaskUpdate): Promise<STTask | null> {
    try {
      const response = await this.request<STTask>(
        'PATCH',
        `taskmanagement/v2/tenant/${this.tenantId}/tasks/${taskId}`,
        { body: updates }
      );
      return response;
    } catch (error) {
      console.error(`Failed to update task ${taskId}:`, error);
      return null;
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
