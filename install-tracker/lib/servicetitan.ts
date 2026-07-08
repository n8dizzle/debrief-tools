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
interface STEstimate {
  id: number;
  jobNumber?: string;
  jobId?: number;
  name?: string;
  status?: { name?: string } | string;
  soldBy?: number | null;
  soldOn?: string | null;
  subtotal?: number;
  tax?: number;
  items?: STEstimateItem[];
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
