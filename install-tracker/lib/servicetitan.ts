// Minimal ServiceTitan client — just what the install tracker needs: auth + pull
// all estimates for a project. Mirrors ap-payments/lib/servicetitan.ts auth.

const AUTH_URL = 'https://auth.servicetitan.io/connect/token';
const BASE_URL = 'https://api.servicetitan.io';

const clientId = process.env.ST_CLIENT_ID || '';
const clientSecret = process.env.ST_CLIENT_SECRET || '';
const tenantId = process.env.ST_TENANT_ID || '';
const appKey = process.env.ST_APP_KEY || '';

export function stConfigured() {
  return !!(clientId && clientSecret && tenantId && appKey);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`ST token failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 900) * 1000 };
  return cachedToken.token;
}

async function stGet<T>(endpoint: string, params: Record<string, string>): Promise<{ data: T[]; hasMore: boolean }> {
  const token = await getToken();
  const url = `${BASE_URL}/${endpoint}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': appKey, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`ST GET ${endpoint} failed: ${res.status}`);
  const json = await res.json();
  return { data: json.data || [], hasMore: json.hasMore === true };
}

// A raw ST estimate (only the fields we use).
interface STEstimateItem {
  qty?: number;
  unitCost?: number;
  total?: number;
  sku?: { name?: string; displayName?: string; type?: string };
}
export interface STEstimate {
  id: number;
  jobNumber?: string;
  jobId?: number;
  projectId?: number;
  name?: string;
  status?: { name?: string } | string;
  soldBy?: number | null;
  soldOn?: string | null;
  subtotal?: number;
  tax?: number;
  businessUnitName?: string;
  customerId?: number;
  items?: STEstimateItem[];
}

export function estimateStatus(e: STEstimate): string | null {
  return typeof e.status === 'object' ? e.status?.name ?? null : e.status ?? null;
}
export function estimateEquipmentCount(e: STEstimate): number {
  return (e.items || []).filter((i) => (i.sku?.type || '').toLowerCase() === 'equipment').length;
}

export async function getEstimatesByProject(projectId: number): Promise<STEstimate[]> {
  const all: STEstimate[] = [];
  let page = 1;
  while (page <= 10) {
    const { data, hasMore } = await stGet<STEstimate>(
      `sales/v2/tenant/${tenantId}/estimates`,
      { projectId: String(projectId), pageSize: '100', page: String(page) },
    );
    all.push(...data);
    if (!hasMore) break;
    page++;
  }
  return all;
}

// All SOLD estimates tenant-wide since a date (every business unit). The entry
// point for independent deal discovery.
export async function getSoldEstimates(soldAfterISO: string): Promise<STEstimate[]> {
  const all: STEstimate[] = [];
  let page = 1;
  while (page <= 200) {
    const { data, hasMore } = await stGet<STEstimate>(
      `sales/v2/tenant/${tenantId}/estimates`,
      { soldAfter: soldAfterISO, pageSize: '200', page: String(page) },
    );
    all.push(...data);
    if (!hasMore) break;
    page++;
  }
  return all;
}

// Resolve customer ids → names (batched).
export async function getCustomerNames(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const unique = Array.from(new Set(ids.filter((n) => n > 0)));
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const { data } = await stGet<{ id: number; name: string }>(
      `crm/v2/tenant/${tenantId}/customers`,
      { ids: chunk.join(','), pageSize: '50' },
    );
    for (const c of data) out.set(c.id, c.name);
  }
  return out;
}

const HVAC_INSTALL_BU = 610;

export interface InstallJobInfo {
  jobNumber: string;
  jobStatus: string;
  completedOn: string | null;
  firstAppointmentId: number | null;
  invoiceId: number | null;
}

// The HVAC-Install (BU 610) job within a project, if one exists yet.
export async function getInstallJobForProject(projectId: number): Promise<InstallJobInfo | null> {
  const { data } = await stGet<{
    jobNumber: string; businessUnitId: number; jobStatus: string; completedOn?: string;
    firstAppointmentId?: number; invoiceId?: number;
  }>(`jpm/v2/tenant/${tenantId}/jobs`, { projectId: String(projectId), pageSize: '50' });
  const install = data.find((j) => j.businessUnitId === HVAC_INSTALL_BU);
  if (!install) return null;
  return {
    jobNumber: install.jobNumber,
    jobStatus: install.jobStatus,
    completedOn: install.completedOn ?? null,
    firstAppointmentId: install.firstAppointmentId ?? null,
    invoiceId: install.invoiceId ?? null,
  };
}

// Scheduled date from an appointment.
export async function getAppointmentStart(appointmentId: number): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/jpm/v2/tenant/${tenantId}/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${await getToken()}`, 'ST-App-Key': appKey },
    });
    if (!res.ok) return null;
    const a = await res.json();
    return a.start ?? null;
  } catch { return null; }
}

// Invoice number/date/balance/total for the install job's invoice.
export async function getInvoice(invoiceId: number): Promise<
  { number: string | null; date: string | null; balance: number | null; total: number | null } | null
> {
  const { data } = await stGet<{ id: number; invoiceNumber?: string; invoiceDate?: string; balance?: number; total?: number }>(
    `accounting/v2/tenant/${tenantId}/invoices`, { ids: String(invoiceId), pageSize: '1' },
  );
  const inv = data[0];
  if (!inv) return null;
  return { number: inv.invoiceNumber ?? null, date: inv.invoiceDate ?? null, balance: inv.balance ?? null, total: inv.total ?? null };
}

// Resolve technician ids → names (for sold-by).
export async function getTechnicianNames(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const unique = Array.from(new Set(ids.filter((n) => n > 0)));
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const { data } = await stGet<{ id: number; name: string }>(
      `settings/v2/tenant/${tenantId}/technicians`, { ids: chunk.join(','), pageSize: '50' },
    );
    for (const t of data) out.set(t.id, t.name);
  }
  return out;
}

export interface EstimateRow {
  estimate_id: number;
  st_project_id: number;
  estimate_job_number: string | null;
  name: string | null;
  status: string | null;
  sold_by_id: number | null;
  sold_on: string | null;
  subtotal: number | null;
  tax: number | null;
  total_cost: number | null;
  equipment_count: number;
  items: { type: string; name: string; qty: number; unitCost: number | null; total: number | null }[];
}

// Shape a raw ST estimate into an install_estimates row.
export function toEstimateRow(e: STEstimate, projectId: number): EstimateRow {
  const items = (e.items || []).map((i) => ({
    type: i.sku?.type || 'Other',
    name: i.sku?.displayName || i.sku?.name || '',
    qty: i.qty ?? 1,
    unitCost: i.unitCost ?? null,
    total: i.total ?? null,
  }));
  const totalCost = items.reduce((s, i) => s + (i.unitCost ?? 0) * (i.qty ?? 1), 0);
  const status = typeof e.status === 'object' ? e.status?.name ?? null : e.status ?? null;
  return {
    estimate_id: e.id,
    st_project_id: projectId,
    estimate_job_number: e.jobNumber ?? (e.jobId != null ? String(e.jobId) : null),
    name: e.name ?? null,
    status,
    sold_by_id: e.soldBy ?? null,
    sold_on: e.soldOn ?? null,
    subtotal: e.subtotal ?? null,
    tax: e.tax ?? null,
    total_cost: Number(totalCost.toFixed(2)),
    equipment_count: items.filter((i) => i.type.toLowerCase() === 'equipment').length,
    items,
  };
}
