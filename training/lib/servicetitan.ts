/**
 * Minimal ServiceTitan client for training roster sync — auth + technicians only.
 * Mirrors ap-payments/lib/servicetitan.ts (client-credentials + ST-App-Key header).
 * Env: ST_CLIENT_ID, ST_CLIENT_SECRET, ST_TENANT_ID, ST_APP_KEY (standardized ST_* names).
 */

export interface STTechnician {
  id: number;
  name: string;
  active: boolean;
  businessUnitId?: number;
  mobilePhone?: string;
  phoneNumber?: string;
  email?: string;
  roleIds?: number[];
}

interface STPagedResponse<T> {
  data: T[];
  hasMore: boolean;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class ServiceTitanClient {
  private readonly BASE_URL = "https://api.servicetitan.io";
  private readonly AUTH_URL = "https://auth.servicetitan.io/connect/token";

  private clientId = process.env.ST_CLIENT_ID || process.env.SERVICETITAN_CLIENT_ID || "";
  private clientSecret = process.env.ST_CLIENT_SECRET || process.env.SERVICETITAN_CLIENT_SECRET || "";
  private tenantId = process.env.ST_TENANT_ID || process.env.SERVICETITAN_TENANT_ID || "";
  private appKey = process.env.ST_APP_KEY || process.env.SERVICETITAN_APP_KEY || "";

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  get configured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) return this.accessToken;
    const res = await fetch(this.AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`ST token failed: ${res.status}`);
    const data: TokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 900) * 1000;
    return this.accessToken;
  }

  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.BASE_URL}/${endpoint}?${new URLSearchParams(params)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "ST-App-Key": this.appKey },
    });
    if (!res.ok) throw new Error(`ST API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  /** All technicians (paginated). activeOnly by default. */
  async getTechnicians(activeOnly = true): Promise<STTechnician[]> {
    const all: STTechnician[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const params: Record<string, string> = { pageSize: "200", page: String(page) };
      if (activeOnly) params.active = "true";
      const resp = await this.request<STPagedResponse<STTechnician>>(
        `settings/v2/tenant/${this.tenantId}/technicians`,
        params
      );
      all.push(...(resp.data || []));
      hasMore = resp.hasMore;
      page++;
      if (page > 20) break;
    }
    return all;
  }
}

let _client: ServiceTitanClient | null = null;
export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) _client = new ServiceTitanClient();
  return _client;
}
