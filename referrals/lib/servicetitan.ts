/**
 * ServiceTitan API client for Referrals.
 * Focused on the endpoints the referral program needs:
 * customer lookup, lead creation, job/invoice reads, customer notes.
 *
 * Env vars follow the `ST_*` convention used by the spec; we also accept
 * `SERVICETITAN_*` for compatibility with other apps in the monorepo.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface STCustomer {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  type?: string;
  balance?: number;
  active?: boolean;
  createdOn?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: any[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: any[];
}

export interface STInvoice {
  id: number;
  invoiceNumber?: string;
  job?: { id: number; number?: string; type?: { name?: string } } | null;
  customer?: { id: number; name?: string; type?: string } | null;
  businessUnit?: { id: number; name?: string } | null;
  total: number;
  balance: number;
  createdOn?: string;
  dueDate?: string;
  status?: string;
  invoiceConfiguration?: string;
}

export interface STLeadContactInfo {
  type: "Phone" | "Email";
  value: string;
  memo?: string;
}

export interface STLeadCreate {
  /** Required by ST v2 Leads API — the campaign to attribute this lead to. */
  campaignId: number;
  /** Required — the narrative/description the dispatcher sees first. */
  body: string;
  priority?: "Low" | "Normal" | "High" | "Urgent";
  summary?: string;
  customerId?: number;
  locationId?: number;
  callReasonId?: number;
  followUpDate?: string;
  businessUnitId?: number;
  contactInfo?: STLeadContactInfo;
}

export interface STBookingContact {
  type: "Phone" | "Email";
  value: string;
  memo?: string;
}

/**
 * Bare-minimum booking payload for ST's booking-provider endpoint. Probed
 * against the live API — these field names and requirements come from
 * actual 400 responses, not docs:
 *
 *  - name, source, summary, body, externalId, isFirstTimeClient:
 *    hard-required. ST 400s with "Required property X not found" if missing.
 *  - contacts OR address: at least one is required. ST 400s with
 *    "At least one Contact or Address is required" if neither. Our referrals
 *    always collect a phone so we always send a contact — address is still
 *    sent when available for dispatch routing.
 *  - Everything else (time slot, business unit, job type) is filled in by
 *    dispatch when they accept the booking into a scheduled appointment.
 */
export interface STBookingCreate {
  /** Customer-facing name (the referred friend). */
  name: string;
  /** Marketing source label. Shows in ST reports. */
  source: string;
  /** Short headline dispatch sees in the bookings queue. */
  summary: string;
  /** Full narrative — referrer, service type, notes. */
  body: string;
  /** Our dedup key. ST rejects duplicates by externalId, so a stable value
   *  makes accidental resubmissions idempotent. */
  externalId: string;
  /** Boolean — default true for referrals (friend of a customer is usually
   *  a net-new customer). */
  isFirstTimeClient: boolean;
  /** Contact method array. At least one contact OR address is required. */
  contacts?: STBookingContact[];
  address?: {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  /** Optional recommended additions — dispatch uses these when calling back. */
  campaignId?: number;
  priority?: "Low" | "Normal" | "High" | "Urgent";
  customerType?: "Residential" | "Commercial";
  email?: string;
}

interface STPagedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

/**
 * Default per-request timeout for ServiceTitan API calls. Chosen so a cold
 * OAuth token fetch (observed ~20-30s on first request of the day) fails fast
 * enough for a user-facing enrollment rather than blocking the tab, while
 * still allowing the usual steady-state latency (1-3s).
 */
const ST_DEFAULT_TIMEOUT_MS = 10_000;

export class ServiceTitanClient {
  private readonly BASE_URL: string;
  private readonly AUTH_URL: string;

  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private appKey: string;

  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    const env = (process.env.ST_ENV || "production").toLowerCase();
    if (env === "integration") {
      this.BASE_URL = "https://api-integration.servicetitan.io";
      this.AUTH_URL = "https://auth-integration.servicetitan.io/connect/token";
    } else {
      this.BASE_URL = "https://api.servicetitan.io";
      this.AUTH_URL = "https://auth.servicetitan.io/connect/token";
    }

    this.clientId =
      process.env.ST_CLIENT_ID || process.env.SERVICETITAN_CLIENT_ID || "";
    this.clientSecret =
      process.env.ST_CLIENT_SECRET ||
      process.env.SERVICETITAN_CLIENT_SECRET ||
      "";
    this.tenantId =
      process.env.ST_TENANT_ID || process.env.SERVICETITAN_TENANT_ID || "";
    this.appKey =
      process.env.ST_APP_KEY || process.env.SERVICETITAN_APP_KEY || "";

    if (!this.isConfigured()) {
      console.warn("ServiceTitan credentials not fully configured");
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.tenantId && this.appKey);
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = ST_DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      const buffer = new Date(this.tokenExpiresAt.getTime() - 60_000);
      if (new Date() < buffer) return this.accessToken;
    }

    const response = await this.fetchWithTimeout(this.AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
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
      url += `?${new URLSearchParams(options.params).toString()}`;
    }

    const response = await this.fetchWithTimeout(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "ST-App-Key": this.appKey,
        "Content-Type": "application/json",
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
  // CUSTOMER LOOKUP (for enrollment matching)
  // ============================================

  async findCustomerByPhone(phone: string): Promise<STCustomer | null> {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return null;

    const response = await this.request<STPagedResponse<STCustomer>>(
      "GET",
      `crm/v2/tenant/${this.tenantId}/customers`,
      { params: { phone: digits, pageSize: "1" } }
    );
    return response.data?.[0] || null;
  }

  async findCustomerByEmail(email: string): Promise<STCustomer | null> {
    const response = await this.request<STPagedResponse<STCustomer>>(
      "GET",
      `crm/v2/tenant/${this.tenantId}/customers`,
      { params: { email, pageSize: "1" } }
    );
    return response.data?.[0] || null;
  }

  async getCustomer(customerId: number): Promise<STCustomer | null> {
    try {
      return await this.request<STCustomer>(
        "GET",
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}`
      );
    } catch (err) {
      console.error(`Failed to get customer ${customerId}:`, err);
      return null;
    }
  }

  /**
   * Set a single custom field value on an ST customer record.
   *
   * Used by the admin "Tag in ST" flow — writes the referral code to the
   * customer's Referral_Code custom field so future invoice webhooks can
   * match via path 2 (custom-field lookup) instead of relying on the
   * fragile phone fallback.
   *
   * Requires the custom field to be pre-registered in ST settings. The
   * numeric typeId is pasted into ref_settings.st_customer_referral_code_field_id
   * by an admin after they create the field in ST's UI.
   *
   * Uses raw fetch instead of the request<T> helper because ST's PATCH
   * response is small / possibly empty and we don't need to parse it —
   * only the status code matters. Throws on non-2xx so the caller can
   * translate into a user-visible error.
   */
  async setCustomerCustomField(
    customerId: number,
    typeId: number,
    value: string
  ): Promise<void> {
    const token = await this.getAccessToken();
    const response = await this.fetchWithTimeout(
      `${this.BASE_URL}/crm/v2/tenant/${this.tenantId}/customers/${customerId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "ST-App-Key": this.appKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customFields: [{ typeId, value }] }),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ST customer PATCH failed ${response.status}: ${text.slice(0, 300)}`
      );
    }
  }

  // ============================================
  // LEADS (created when referred friend books)
  // ============================================

  async createLead(lead: STLeadCreate): Promise<{ id: number } | null> {
    try {
      return await this.request<{ id: number }>(
        "POST",
        `crm/v2/tenant/${this.tenantId}/leads`,
        { body: lead }
      );
    } catch (err) {
      console.error("Failed to create lead:", err);
      return null;
    }
  }

  /**
   * Submit a booking through a pre-registered booking provider.
   *
   * The admin registers a "Christmas Air Referrals" booking provider in
   * ServiceTitan's dashboard (Settings → Integrations → Booking Providers)
   * and pastes the numeric provider ID into ref_settings.
   * st_referral_booking_provider_id.
   *
   * Bookings land in the Follow Up → Bookings queue (separate from Leads).
   * Dispatch accepts them, confirms details with the customer, and converts
   * them into scheduled appointments. Unlike leads, bookings do not require
   * a follow-up date at submission.
   */
  async createBooking(
    providerId: number,
    booking: STBookingCreate
  ): Promise<{ id: number } | null> {
    try {
      return await this.request<{ id: number }>(
        "POST",
        `crm/v2/tenant/${this.tenantId}/booking-provider/${providerId}/bookings`,
        { body: booking }
      );
    } catch (err) {
      console.error("Failed to create booking:", err);
      return null;
    }
  }

  // ============================================
  // JOBS & INVOICES (for conversion tracking)
  // ============================================

  async getJob(jobId: number): Promise<STJob | null> {
    try {
      return await this.request<STJob>(
        "GET",
        `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`
      );
    } catch (err) {
      console.error(`Failed to get job ${jobId}:`, err);
      return null;
    }
  }

  async getInvoice(invoiceId: number): Promise<STInvoice | null> {
    const response = await this.request<STPagedResponse<STInvoice>>(
      "GET",
      `accounting/v2/tenant/${this.tenantId}/invoices`,
      { params: { ids: invoiceId.toString(), pageSize: "1" } }
    );
    return response.data?.[0] || null;
  }

  // ============================================
  // CUSTOMER NOTES (tag referral source)
  // ============================================

  async postCustomerNote(customerId: number, text: string): Promise<boolean> {
    try {
      await this.request(
        "POST",
        `crm/v2/tenant/${this.tenantId}/customers/${customerId}/notes`,
        { body: { text } }
      );
      return true;
    } catch (err) {
      console.error(`Failed to post note to customer ${customerId}:`, err);
      return false;
    }
  }

  /**
   * Quick health check — verifies credentials work by fetching the current tenant.
   * Used by the test-servicetitan route during Sprint 1 integration smoke-testing.
   */
  async ping(): Promise<boolean> {
    try {
      await this.request(
        "GET",
        `settings/v2/tenant/${this.tenantId}/business-units`,
        { params: { pageSize: "1" } }
      );
      return true;
    } catch {
      return false;
    }
  }
}

let _client: ServiceTitanClient | null = null;

export function getServiceTitanClient(): ServiceTitanClient {
  if (!_client) _client = new ServiceTitanClient();
  return _client;
}
