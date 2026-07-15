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
  type?: string;
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

/** Parsed row from ST report 54646792 (Parts & Equipment new orders source). */
export interface PEPartsReportRow {
  estimateId: number | null;
  jobId: number | null;
  jobNumber: string;
  customer: string;
  soldDate: string;
  estimateCost: string;
  businessUnit: string;
  tech: string;
  part: string;
  note: string;
}

interface STReportField {
  name: string;
  label: string;
}

interface STReportParameter {
  name: string;
  label?: string;
  isRequired?: boolean;
  dataType?: string;
}

interface STReportDefinition {
  id?: number;
  name?: string;
  parameters?: STReportParameter[];
}

interface STReportCategory {
  id: string;
  name?: string;
}

/** ST custom report: https://go.servicetitan.com/#/new/reports/54646792 */
export const PE_PARTS_REPORT_ID = '54646792';

class ServiceTitanClient {
  private readonly BASE_URL = 'https://api.servicetitan.io';
  private readonly AUTH_URL = 'https://auth.servicetitan.io/connect/token';
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private appKey: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private reportCategoryCache: string | null = null;

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

  private async request<T>(
    method: string,
    endpoint: string,
    options: { params?: Record<string, string>; body?: unknown } = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    let url = `${this.BASE_URL}/${endpoint}`;
    if (options.params && Object.keys(options.params).length > 0) {
      url += `?${new URLSearchParams(options.params).toString()}`;
    }
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'ST-App-Key': this.appKey,
        'Content-Type': 'application/json',
      },
      body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ST API ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  private async requestAllPages<T>(endpoint: string, params: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      const res = await this.request<STPagedResponse<T>>('GET', endpoint, {
        params: { ...params, pageSize: '200', page: String(page) },
      });
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
    return all.filter(e => {
      const status = e.status as unknown as { name?: string } | string | undefined;
      if (typeof status === 'string') return status === 'Sold';
      if (typeof status === 'object' && status !== null) return status.name === 'Sold';
      return false;
    });
  }

  /**
   * All estimates sold on/after `soldAfter`, WITH line items (each item carries
   * `invoiceItemId` — null until the item is booked onto a job). Source of truth
   * for the parts queue: caller keeps Sold estimates whose items are all still
   * uninvoiced ("Install Job(s) empty"). Bypasses the hidden-filter report.
   */
  async getSoldEstimatesRaw(soldAfter: string): Promise<Array<Record<string, unknown>>> {
    const all: Array<Record<string, unknown>> = [];
    let page = 1;
    let hasMore = true;
    // Deeper cap than requestAllPages (the sold-estimate universe is ~4k+ YTD).
    while (hasMore && page <= 60) {
      const res = await this.request<STPagedResponse<Record<string, unknown>>>(
        'GET',
        `sales/v2/tenant/${this.tenantId}/estimates`,
        { params: { soldAfter, pageSize: '500', page: String(page) } }
      );
      all.push(...(res.data || []));
      hasMore = res.hasMore === true;
      page++;
    }
    return all;
  }

  /** A single estimate by id — for diagnostics. */
  async getEstimateById(estimateId: number): Promise<Record<string, unknown> | null> {
    try {
      return await this.request<Record<string, unknown>>(
        'GET',
        `sales/v2/tenant/${this.tenantId}/estimates/${estimateId}`
      );
    } catch (e) {
      return { error: String(e) };
    }
  }

  /** All estimates attached to a job (any status) — for diagnostics. */
  async getEstimatesByJob(jobId: number): Promise<Array<{ id: number; name?: string; status?: unknown; total?: number; soldOn?: string; jobId?: number }>> {
    return this.requestAllPages(
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { jobId: String(jobId) }
    );
  }

  /**
   * Sold WARRANTY estimates (items whose SKU starts with "CA-W-", i.e. $0
   * warranty repairs). These are excluded from report 54646792, so we pull them
   * separately to feed the parts board + warranty claims. Returns report-shaped rows.
   */
  async getSoldWarrantyEstimates(soldAfter: string): Promise<Array<{
    estimateId: number; jobNumber: string; businessUnit: string; name: string;
    total: number; warrantyType: string; customerId: number | null; soldOn: string;
  }>> {
    const raw = await this.requestAllPages<Record<string, unknown>>(
      `sales/v2/tenant/${this.tenantId}/estimates`,
      { soldAfter }
    );
    const out: Array<{ estimateId: number; jobNumber: string; businessUnit: string; name: string; total: number; warrantyType: string; customerId: number | null; soldOn: string }> = [];
    for (const e of raw) {
      const status = e.status as { name?: string } | string | undefined;
      const statusName = typeof status === 'string' ? status : status?.name;
      if (statusName !== 'Sold') continue;
      const items = (e.items as Array<Record<string, unknown>>) || [];
      const isWarranty = items.some(it => {
        const sku = it.sku as { name?: string; displayName?: string } | undefined;
        const name = (sku?.name || (it.skuName as string) || '').toUpperCase();
        const disp = (sku?.displayName || (it.displayName as string) || '').toLowerCase();
        return name.startsWith('CA-W-') || disp.startsWith('warranty');
      });
      if (!isWarranty) continue;
      const name = (e.name as string) || '';
      const summary = (e.summary as string) || '';
      const hay = (name + ' ' + summary).toLowerCase();
      const warrantyType = (hay.includes('labor') && hay.includes('part')) ? 'P/L' : 'P';
      out.push({
        estimateId: Number(e.id),
        jobNumber: String(e.jobNumber ?? e.jobId ?? ''),
        businessUnit: (e.businessUnitName as string) || '',
        name,
        total: Number(e.subtotal ?? e.total ?? 0),
        warrantyType,
        customerId: e.customerId != null ? Number(e.customerId) : null,
        soldOn: (e.soldOn as string) || '',
      });
    }
    return out;
  }

  async getJob(jobId: number): Promise<STJob | null> {
    try {
      return await this.request<STJob>('GET', `jpm/v2/tenant/${this.tenantId}/jobs/${jobId}`);
    } catch {
      return null;
    }
  }

  async getCustomer(customerId: number): Promise<STCustomer | null> {
    try {
      return await this.request<STCustomer>('GET', `crm/v2/tenant/${this.tenantId}/customers/${customerId}`);
    } catch {
      return null;
    }
  }

  /**
   * Resolve an estimate's `soldBy` id → display name. It can be a field technician
   * OR an office employee (office sellers), so try technicians first, then employees.
   */
  async getTechnicianName(id: number): Promise<string> {
    try {
      const t = await this.request<{ name?: string }>('GET', `settings/v2/tenant/${this.tenantId}/technicians/${id}`);
      if (t?.name) return t.name;
    } catch { /* fall through to employees */ }
    try {
      const e = await this.request<{ name?: string }>('GET', `settings/v2/tenant/${this.tenantId}/employees/${id}`);
      return e?.name || '';
    } catch {
      return '';
    }
  }

  private unwrapList<T>(response: T[] | { data?: T[] }): T[] {
    if (Array.isArray(response)) return response;
    return response.data || [];
  }

  /** List every report id in a category, following pagination. */
  private async listReportIdsInCategory(categoryId: string): Promise<string[]> {
    const ids: string[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 50) {
      const res = await this.request<{
        data?: Array<{ id: number | string }>;
        hasMore?: boolean;
      } | Array<{ id: number | string }>>(
        'GET',
        `reporting/v2/tenant/${this.tenantId}/report-category/${categoryId}/reports`,
        { params: { pageSize: '200', page: String(page) } }
      );
      const rows = Array.isArray(res) ? res : (res.data || []);
      ids.push(...rows.map(r => String(r.id)));
      hasMore = !Array.isArray(res) && res.hasMore === true;
      page++;
    }
    return ids;
  }

  async resolvePartsReportCategory(): Promise<string> {
    const override = process.env.ST_PE_PARTS_REPORT_CATEGORY;
    if (override) return override;
    if (this.reportCategoryCache) return this.reportCategoryCache;

    const categories = this.unwrapList(
      await this.request<STReportCategory[] | { data: STReportCategory[] }>(
        'GET',
        `reporting/v2/tenant/${this.tenantId}/report-categories`
      )
    );

    const categoryIds = categories.map(c => c.id);
    console.log(`All ST report categories (${categoryIds.length}): ${categoryIds.join(', ')}`);

    for (const category of categories) {
      try {
        const reportIds = await this.listReportIdsInCategory(category.id);
        console.log(`Category "${category.id}" has ${reportIds.length} reports`);
        if (reportIds.includes(PE_PARTS_REPORT_ID)) {
          this.reportCategoryCache = category.id;
          console.log(`Parts report ${PE_PARTS_REPORT_ID} found in category "${category.id}"`);
          return category.id;
        }
      } catch (err) {
        console.log(`Category "${category.id}" skipped: ${err}`);
      }
    }

    throw new Error(`ServiceTitan report ${PE_PARTS_REPORT_ID} not found in any of: ${categoryIds.join(', ')}. Set ST_PE_PARTS_REPORT_CATEGORY env var.`);
  }

  async getPartsReportDefinition(category?: string): Promise<{ category: string; definition: STReportDefinition }> {
    const cat = category || await this.resolvePartsReportCategory();
    const definition = await this.request<STReportDefinition>(
      'GET',
      `reporting/v2/tenant/${this.tenantId}/report-category/${cat}/reports/${PE_PARTS_REPORT_ID}`
    );
    return { category: cat, definition };
  }

  private buildReportParameters(
    definition: STReportDefinition,
    from: string,
    to: string
  ): { name: string; value: unknown }[] {
    const params: { name: string; value: unknown }[] = [];
    const paramDefs = definition.parameters || [];

    for (const p of paramDefs) {
      const name = p.name;
      const lower = name.toLowerCase();
      if (lower === 'from' || lower === 'fromdate' || lower === 'startdate' || lower === 'soldonorafter' || lower === 'datestart') {
        params.push({ name, value: from });
      } else if (lower === 'to' || lower === 'todate' || lower === 'enddate' || lower === 'soldonbefore' || lower === 'dateend') {
        params.push({ name, value: to });
      } else if (lower === 'asofdate') {
        params.push({ name, value: to });
      } else if (lower === 'datetype' || lower === 'daterangetype') {
        // Report 54646792: DateType is a Number enum
        // (0=Sold On, 1=Follow Up, 2=Parent Completion, 3=Creation Date).
        // Filter by Sold On so estimates sold recently are caught regardless of
        // when the estimate was originally created.
        params.push({ name, value: 0 });
      }
    }

    if (params.length === 0) {
      params.push({ name: 'From', value: from }, { name: 'To', value: to });
    }

    return params;
  }

  private pickField(row: unknown[], idx: Record<string, number>, candidates: string[]): string {
    for (const name of candidates) {
      const i = idx[name];
      if (i == null) continue;
      const val = row[i];
      if (val != null && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  }

  private pickNumber(row: unknown[], idx: Record<string, number>, candidates: string[]): number | null {
    const raw = this.pickField(row, idx, candidates);
    if (!raw) return null;
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? null : n;
  }

  private parseSoldDate(raw: string): string {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseReportRow(row: unknown[], idx: Record<string, number>): PEPartsReportRow | null {
    const jobNumber = this.pickField(row, idx, [
      'ParentJobNumber', 'Parent Job Number', 'JobNumber', 'Job #', 'Job', 'InvoiceNumber',
    ]);
    const customer = this.pickField(row, idx, [
      'CustomerName', 'Customer', 'Customer Name', 'Name',
    ]);
    const estimateId = this.pickNumber(row, idx, [
      'EstimateId', 'Estimate Id', 'EstimateID', 'EstimateNumber', 'Estimate #', 'Estimate',
    ]);
    const jobId = this.pickNumber(row, idx, ['JobId', 'JobID']);
    const soldDate = this.parseSoldDate(this.pickField(row, idx, [
      'SoldOn', 'Sold On', 'SoldDate', 'Sold Date', 'CreationDate', 'Creation Date', 'Date', 'CreatedOn', 'Created Date',
    ]));
    const estimateCost = this.pickField(row, idx, [
      'EstimatesSubtotal', 'Estimates Subtotal', 'EstimateSubtotal', 'Estimate Subtotal',
      'MaterialCost', 'Material Cost', 'EquipmentCost', 'Equipment Cost',
      'PartsCost', 'Parts Cost', 'EstimateCost', 'EstCost', 'Cost',
      'Subtotal', 'Total', 'EstimateTotal', 'SoldAmount', 'Amount',
    ]);
    const businessUnit = this.pickField(row, idx, [
      'BusinessUnit', 'BusinessUnitName', 'Business Unit', 'BU', 'Division',
    ]);
    const tech = this.pickField(row, idx, [
      'TechnicianName', 'Technician', 'SoldBy', 'Sold By', 'Tech', 'Employee',
    ]);
    const part = this.pickField(row, idx, [
      'Equipment', 'Part', 'Parts', 'Materials', 'Material', 'Summary', 'Description', 'Item',
    ]);
    const note = this.pickField(row, idx, [
      'EstimateName', 'Estimate Name', 'Name', 'Summary', 'Notes', 'Note',
    ]);

    if (!jobNumber && !customer && !estimateId) return null;

    return {
      estimateId,
      jobId,
      jobNumber: jobNumber.replace(/^#/, ''),
      customer,
      soldDate,
      estimateCost,
      businessUnit,
      tech,
      part,
      note,
    };
  }

  /**
   * Run ST report 54646792 — the team's source-of-truth for new parts orders.
   * https://go.servicetitan.com/#/new/reports/54646792
   */
  async getPartsOrdersReport(from: string, to: string): Promise<{
    category: string;
    fields: STReportField[];
    rows: PEPartsReportRow[];
  }> {
    const { category, definition } = await this.getPartsReportDefinition();
    const parameters = this.buildReportParameters(definition, from, to);

    const parsedRows: PEPartsReportRow[] = [];
    let fields: STReportField[] = [];
    const idx: Record<string, number> = {};
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 50) {
      const response = await this.request<{
        fields: STReportField[];
        data: unknown[][];
        hasMore: boolean;
      }>(
        'POST',
        `reporting/v2/tenant/${this.tenantId}/report-category/${category}/reports/${PE_PARTS_REPORT_ID}/data`,
        { body: { parameters, pageSize: 2000, page } }
      );

      if (page === 1) {
        fields = response.fields || [];
        fields.forEach((f, i) => { idx[f.name] = i; });
        console.log(`Parts report ${PE_PARTS_REPORT_ID} fields: ${fields.map(f => f.name).join(', ')}`);
        console.log(`Parts report parameters: ${JSON.stringify(parameters)}`);
      }

      for (const row of response.data || []) {
        const parsed = this.parseReportRow(row, idx);
        if (parsed) parsedRows.push(parsed);
      }

      hasMore = response.hasMore === true;
      page++;
    }

    return { category, fields, rows: parsedRows };
  }

  async probePartsReport(from: string, to: string): Promise<{
    category: string;
    reportName?: string;
    parameters: STReportParameter[];
    fields: STReportField[];
    sampleRows: PEPartsReportRow[];
    rawSample?: unknown[][];
  }> {
    const { category, definition } = await this.getPartsReportDefinition();
    const parameters = this.buildReportParameters(definition, from, to);

    const response = await this.request<{
      fields: STReportField[];
      data: unknown[][];
    }>(
      'POST',
      `reporting/v2/tenant/${this.tenantId}/report-category/${category}/reports/${PE_PARTS_REPORT_ID}/data`,
      { body: { parameters, pageSize: 5, page: 1 } }
    );

    const idx: Record<string, number> = {};
    (response.fields || []).forEach((f, i) => { idx[f.name] = i; });

    const sampleRows = (response.data || [])
      .map(row => this.parseReportRow(row, idx))
      .filter((r): r is PEPartsReportRow => r != null);

    return {
      category,
      reportName: definition.name,
      parameters: definition.parameters || [],
      fields: response.fields || [],
      sampleRows,
      rawSample: response.data?.slice(0, 3),
    };
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
