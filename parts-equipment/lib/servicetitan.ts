interface TokenResponse {
  access_token: string;
  expires_in: number;
}

interface STPagedResponse<T> {
  data: T[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface STEstimateItem {
  id: number;
  type?: string; // 'Service' | 'Material' | 'Equipment'
  skuName?: string;
  description?: string;
  displayName?: string;
  qty?: number;
  totalPrice?: number;
  totalCost?: number;
}

export interface STEstimate {
  id: number;
  jobId?: number;
  name?: string;
  summary?: string;
  status?: string;
  soldOn?: string;
  total?: number;
  items?: STEstimateItem[];
}

export interface STJob {
  id: number;
  jobNumber: string | number;
  businessUnitId?: number;
  businessUnitName?: string;
  customerId?: number;
  summary?: string;
  jobStatus?: string;
}

export function isJobTerminal(job: STJob | null): boolean {
  if (!job) return false;
  const s = (job.jobStatus || '').toLowerCase();
  return s === 'completed' || s === 'canceled' || s === 'cancelled' ||
    s === 'void' || s === 'done' || s === 'complete';
}

export interface STCustomer {
  id: number;
  name: string;
}

class ServiceTitanClient {
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
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      if (new Date() < new Date(this.tokenExpiresAt.getTime() - 60000)) {
        return this.accessToken;
      }
    }
    const res = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`ST auth failed: ${res.status}`);
    const data: TokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 900) * 1000);
    return this.accessToken;
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();
    let url = `${this.BASE_URL}/${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': this.appKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ST API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  private async requestAllPages<T>(endpoint: string, params: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      const res = await this.request<STPagedResponse<T>>(endpoint, { ...params, pageSize: '200', page: String(page) });
      all.push(...(res.data || []));
      hasMore = res.hasMore === true;
      page++;
    }
    return all;
  }

  async getSoldEstimates(soldAfter: string): Promise<STEstimate[]> {
    const all = await this.requestAllPages<STEstimate>(
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { soldAfter }
    );
    // ST returns status as an object { name: 'Sold' } — filter client-side
    return all.filter(e => {
      const status = e.status as unknown as { name?: string } | string | undefined;
      if (typeof status === 'string') return status === 'Sold';
      if (typeof status === 'object' && status !== null) return status.name === 'Sold';
      return false;
    });
  }

  async getJob(jobId: number): Promise<STJob | null> {
    try {
      return await this.request<STJob>(`jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`);
    } catch {
      return null;
    }
  }

  async getCustomer(customerId: number): Promise<STCustomer | null> {
    try {
      return await this.request<STCustomer>(`crm/v2/tenant/${this.tenantId}/customers/${customerId}`);
    } catch {
      return null;
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }
}

let _client: ServiceTitanClient | null = null;

export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) _client = new ServiceTitanClient();
  return _client;
}
