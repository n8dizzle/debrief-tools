/**
 * ServiceTitan API client for the Estimate Tool.
 * Handles pricebook reads, job lookups, and estimate creation.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ── Pricebook Types ──────────────────────────────────────────────

export interface STCategory {
  id: number;
  name: string;
  active: boolean;
  description?: string;
  parentId?: number | null;
  position?: number;
}

export interface STEquipment {
  id: number;
  code: string;
  displayName?: string;
  name?: string;
  description?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  cost?: number;
  price: number;
  memberPrice?: number;
  addOnPrice?: number;
  addOnMemberPrice?: number;
  hours?: number;
  taxable?: boolean;
  active: boolean;
  paysCommission?: boolean;
  account?: string;
  unitOfMeasure?: string;
  isInventory?: boolean;
  manufacturerWarranty?: { duration?: string; description?: string };
  serviceProviderWarranty?: { duration?: string; description?: string };
  categories?: Array<{ id: number; name?: string }>;
  images?: string[];
  vendors?: Array<{ vendorName?: string; vendorPartNumber?: string; cost?: number }>;
}

export interface STMaterial {
  id: number;
  code: string;
  displayName?: string;
  name?: string;
  description?: string;
  cost?: number;
  price: number;
  memberPrice?: number;
  addOnPrice?: number;
  addOnMemberPrice?: number;
  hours?: number;
  taxable?: boolean;
  active: boolean;
  paysCommission?: boolean;
  account?: string;
  unitOfMeasure?: string;
  isInventory?: boolean;
  categories?: Array<{ id: number; name?: string }>;
  images?: string[];
  vendors?: Array<{ vendorName?: string; vendorPartNumber?: string; cost?: number }>;
}

export interface STService {
  id: number;
  code: string;
  displayName?: string;
  name?: string;
  description?: string;
  warrantyDescription?: string;
  price: number;
  memberPrice?: number;
  addOnPrice?: number;
  addOnMemberPrice?: number;
  hours?: number;
  taxable?: boolean;
  active: boolean;
  paysCommission?: boolean;
  isLabor?: boolean;
  allowDiscounts?: boolean;
  categories?: Array<{ id: number; name?: string }>;
  images?: string[];
  materials?: Array<{ skuId: number; quantity: number }>;
}

// ── Job / Customer Types ─────────────────────────────────────────

export interface STCustomer {
  id: number;
  name: string;
  type?: string;
  address?: {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  contacts?: Array<{
    id: number;
    type: string;
    value: string;
    memo?: string;
  }>;
  email?: string;
  phoneNumber?: string;
  doNotMail?: boolean;
  doNotService?: boolean;
  active?: boolean;
}

export interface STLocation {
  id: number;
  customerId: number;
  name?: string;
  address?: {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface STJob {
  id: number;
  jobNumber: string;
  customerId: number;
  locationId: number;
  businessUnitId: number;
  businessUnitName?: string;
  jobTypeId?: number;
  jobTypeName?: string;
  jobStatus: string;
  summary?: string;
  completedOn?: string;
  createdOn?: string;
  total?: number;
  customer?: { id: number; name?: string };
  location?: { id: number; name?: string; address?: STCustomer['address'] };
}

// ── Estimate Types ───────────────────────────────────────────────

export interface STEstimateItem {
  id?: number;
  type?: string; // 'Service' | 'Material' | 'Equipment'
  skuId?: number;
  skuName?: string;
  description?: string;
  displayName?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  totalCost?: number;
}

export interface STEstimate {
  id: number;
  jobId?: number;
  name?: string;
  status: { name: string; value: number };
  summary?: string;
  subtotal: number;
  total: number;
  soldOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  items?: STEstimateItem[];
  externalLinks?: Array<{ name: string; url: string }>;
}

interface STPagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

// ── Client ───────────────────────────────────────────────────────

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
      console.warn('[EstimateTool] ServiceTitan credentials not fully configured');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const bufferTime = new Date(this.tokenExpiresAt.getTime() - 60000);
      if (new Date() < bufferTime) {
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
      throw new Error(`ST API ${response.status}: ${text.slice(0, 300)}`);
    }

    return response.json();
  }

  /**
   * Paginate through all results for a GET endpoint
   */
  private async requestAll<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await this.request<STPagedResponse<T>>('GET', endpoint, {
        params: { ...params, page: String(page), pageSize: '200' },
      });
      all.push(...(res.data || []));
      hasMore = res.hasMore;
      page++;
    }

    return all;
  }

  // ══════════════════════════════════════════════
  // PRICEBOOK
  // ══════════════════════════════════════════════

  async getCategories(): Promise<STCategory[]> {
    return this.requestAll<STCategory>(
      `pricebook/v2/tenant/${this.tenantId}/categories`,
      { active: 'true' }
    );
  }

  async getEquipment(): Promise<STEquipment[]> {
    return this.requestAll<STEquipment>(
      `pricebook/v2/tenant/${this.tenantId}/equipment`,
      { active: 'true' }
    );
  }

  async getMaterials(): Promise<STMaterial[]> {
    return this.requestAll<STMaterial>(
      `pricebook/v2/tenant/${this.tenantId}/materials`,
      { active: 'true' }
    );
  }

  async getServices(): Promise<STService[]> {
    return this.requestAll<STService>(
      `pricebook/v2/tenant/${this.tenantId}/services`,
      { active: 'true' }
    );
  }

  // ══════════════════════════════════════════════
  // JOBS
  // ══════════════════════════════════════════════

  async getJobByNumber(jobNumber: string): Promise<STJob | null> {
    const res = await this.request<STPagedResponse<STJob>>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      { params: { number: jobNumber, pageSize: '1' } }
    );
    return res.data?.[0] || null;
  }

  async getJob(jobId: number): Promise<STJob> {
    return this.request<STJob>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`
    );
  }

  // ══════════════════════════════════════════════
  // CUSTOMERS / LOCATIONS
  // ══════════════════════════════════════════════

  async getCustomer(customerId: number): Promise<STCustomer> {
    const customer = await this.request<STCustomer>(
      'GET',
      `crm/v2/tenant/${this.tenantId}/customers/${customerId}`
    );

    // Contacts are a separate endpoint in ST
    try {
      const contactsRes = await this.request<STPagedResponse<{ id: number; type: string; value: string; memo?: string }>>(
        'GET',
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}/contacts`,
        { params: { pageSize: '50' } }
      );
      customer.contacts = contactsRes.data || [];
    } catch {
      // If contacts endpoint fails, leave contacts empty
    }

    return customer;
  }

  async searchCustomers(filters: { name?: string; phoneNumber?: string }): Promise<STCustomer[]> {
    const params: Record<string, string> = { pageSize: '20', active: 'true' };
    if (filters.name) params.name = filters.name;
    if (filters.phoneNumber) params.phoneNumber = filters.phoneNumber;

    const res = await this.request<STPagedResponse<STCustomer>>(
      'GET',
      `crm/v2/tenant/${this.tenantId}/customers`,
      { params }
    );
    return res.data || [];
  }

  async getJobsForCustomer(customerId: number): Promise<STJob[]> {
    const res = await this.request<STPagedResponse<STJob>>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      { params: { customerId: String(customerId), pageSize: '5', sort: '-createdOn' } }
    );
    return res.data || [];
  }

  async getLocation(locationId: number): Promise<STLocation> {
    return this.request<STLocation>(
      'GET',
      `crm/v2/tenant/${this.tenantId}/locations/${locationId}`
    );
  }

  // ══════════════════════════════════════════════
  // TECHNICIANS / DISPATCH
  // ══════════════════════════════════════════════

  async getTechnicians(activeOnly = true): Promise<Array<{ id: number; name: string; email?: string; active: boolean }>> {
    return this.requestAll(
      `settings/v2/tenant/${this.tenantId}/technicians`,
      activeOnly ? { active: 'true' } : {}
    );
  }

  async getScheduledJobs(scheduledOnOrAfter: string, scheduledBefore: string): Promise<STJob[]> {
    return this.requestAll<STJob>(
      `jpm/v2/tenant/${this.tenantId}/jobs`,
      {
        scheduledOnOrAfter: `${scheduledOnOrAfter}T00:00:00`,
        scheduledBefore: `${scheduledBefore}T00:00:00`,
      }
    );
  }

  async getJobAppointments(jobId: number): Promise<Array<{ id: number; jobId: number; start?: string; end?: string; status?: string }>> {
    const res = await this.request<STPagedResponse<{ id: number; jobId: number; start?: string; end?: string; status?: string }>>(
      'GET',
      `jpm/v2/tenant/${this.tenantId}/appointments`,
      { params: { jobId: String(jobId), pageSize: '50' } }
    );
    return res.data || [];
  }

  async getAppointmentAssignments(appointmentIds: number[]): Promise<Array<{ appointmentId: number; technicianId: number; technicianName?: string }>> {
    if (appointmentIds.length === 0) return [];
    const res = await this.request<{ data: Array<{ appointmentId: number; technicianId: number; technicianName?: string }> }>(
      'GET',
      `dispatch/v2/tenant/${this.tenantId}/appointment-assignments`,
      { params: { appointmentIds: appointmentIds.join(',') } }
    );
    return res.data || [];
  }

  // ══════════════════════════════════════════════
  // ESTIMATES
  // ══════════════════════════════════════════════

  async getEstimatesForJob(jobId: number): Promise<STEstimate[]> {
    const res = await this.request<STPagedResponse<STEstimate>>(
      'GET',
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { params: { jobId: String(jobId), pageSize: '50' } }
    );
    return res.data || [];
  }

  async createEstimate(data: {
    jobId: number;
    name: string;
    summary?: string;
    items: Array<{
      skuId: number;
      type: 'Service' | 'Material' | 'Equipment';
      description?: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): Promise<STEstimate> {
    return this.request<STEstimate>(
      'POST',
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { body: data }
    );
  }

  async sellEstimate(estimateId: number): Promise<void> {
    await this.request<unknown>(
      'PUT',
      `sales/v2/tenant/${this.tenantId}/estimates/${estimateId}/sell`
    );
  }
}
