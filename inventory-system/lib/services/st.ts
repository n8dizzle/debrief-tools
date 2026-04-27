import 'server-only';
import { query } from '../db';

const ST_BASE = 'https://api.servicetitan.io';
const ST_AUTH = 'https://auth.servicetitan.io/connect/token';

let _token: string | null = null;
let _tokenExpiry = 0;

interface StTokenResponse {
  access_token: string;
  expires_in: number;
}

interface StListResponse<T> {
  data?: T[];
  hasMore?: boolean;
  totalCount?: number | null;
}

function stCfg() {
  const cfg = {
    clientId: process.env.ST_CLIENT_ID,
    clientSecret: process.env.ST_CLIENT_SECRET,
    tenantId: process.env.ST_TENANT_ID,
    appKey: process.env.ST_APP_KEY,
  };
  if (!cfg.clientId || !cfg.clientSecret || !cfg.tenantId || !cfg.appKey) {
    throw new Error('ServiceTitan credentials not configured');
  }
  return cfg as { clientId: string; clientSecret: string; tenantId: string; appKey: string };
}

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token;
  const cfg = stCfg();

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const res = await fetch(ST_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ST auth failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as StTokenResponse;
  _token = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _token;
}

/** Build /{module}/v2/tenant/{tenantId}/{rest} from a path like /{module}/v2/{rest}. */
function tenantUrl(path: string): string {
  const cfg = stCfg();
  const url = path.replace(/^\/([^/]+)\/v2\//, `/$1/v2/tenant/${cfg.tenantId}/`);
  return `${ST_BASE}${url}`;
}

async function stGet<T>(path: string, params: Record<string, string | number> = {}): Promise<StListResponse<T>> {
  const token = await getToken();
  const cfg = stCfg();
  const search = new URLSearchParams({ pageSize: '500', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${tenantUrl(path)}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': cfg.appKey },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`ST GET ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as StListResponse<T>;
}

async function stGetAll<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  while (true) {
    const data = await stGet<T>(path, { ...params, page });
    out.push(...(data.data ?? []));
    if (!data.hasMore) break;
    page++;
  }
  return out;
}

async function writeSyncLog(
  syncType: string,
  status: string,
  recordsSynced: number,
  recordsFailed: number,
  errorDetail: string | null,
): Promise<void> {
  await query(
    `INSERT INTO st_sync_log (sync_type, status, records_synced, records_failed, error_detail, completed_at)
     VALUES ($1,$2,$3,$4,$5,NOW())`,
    [syncType, status, recordsSynced, recordsFailed, errorDetail],
  );
}

interface StPricebookItem {
  id: number;
  code?: string;
  displayName?: string;
  description?: string;
  cost?: number;
  unitOfMeasure?: string;
  categories?: Array<{ name?: string }>;
  businessUnit?: { name?: string };
  active?: boolean;
}

export async function syncPricebook(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  try {
    const items = await stGetAll<StPricebookItem>('/pricebook/v2/materials');

    for (const item of items) {
      try {
        const buName = (item.businessUnit?.name || '').toLowerCase();
        const department =
          buName.includes('plumb') ? 'plumbing'
          : buName.includes('hvac') || buName.includes('ac') ? 'hvac'
          : 'plumbing';

        await query(
          `INSERT INTO materials (st_pricebook_id, sku, name, description, unit_cost, unit_of_measure, category, department, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
           ON CONFLICT (st_pricebook_id) DO UPDATE SET
             name            = COALESCE(EXCLUDED.name, materials.name),
             description     = COALESCE(EXCLUDED.description, materials.description),
             unit_cost       = COALESCE(EXCLUDED.unit_cost, materials.unit_cost),
             unit_of_measure = COALESCE(EXCLUDED.unit_of_measure, materials.unit_of_measure),
             category        = COALESCE(EXCLUDED.category, materials.category),
             department      = COALESCE(EXCLUDED.department, materials.department),
             is_active       = EXCLUDED.is_active,
             updated_at      = NOW()`,
          [
            String(item.id),
            item.code || String(item.id),
            item.displayName || item.description || 'Untitled',
            item.description ?? null,
            item.cost ?? null,
            item.unitOfMeasure ?? null,
            item.categories?.[0]?.name ?? null,
            department,
            item.active !== false,
          ],
        );
        synced++;
      } catch (e) {
        console.warn(`Pricebook item ${item.id} failed:`, (e as Error).message);
        failed++;
      }
    }

    await writeSyncLog('pricebook', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('pricebook', 'failed', synced, failed, (err as Error).message);
    throw err;
  }
}

interface StInstalledEquipment {
  id: number;
  customerId?: number;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedOn?: string;
  manufacturerWarrantyStart?: string;
  manufacturerWarrantyEnd?: string;
}

export async function syncEquipment(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  try {
    const items = await stGetAll<StInstalledEquipment>('/equipmentsystems/v2/installed-equipment');

    for (const item of items) {
      try {
        await query(
          `INSERT INTO equipment
             (st_equipment_id, st_customer_id, st_job_id, name, manufacturer, model,
              serial_number, status, installed_at, warranty_start, warranty_expiry,
              last_service_date, last_service_job, raw_st_data, st_last_synced)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
           ON CONFLICT (st_equipment_id) DO UPDATE
             SET st_customer_id    = EXCLUDED.st_customer_id,
                 name              = EXCLUDED.name,
                 manufacturer      = EXCLUDED.manufacturer,
                 model             = EXCLUDED.model,
                 serial_number     = EXCLUDED.serial_number,
                 installed_at      = EXCLUDED.installed_at,
                 warranty_start    = EXCLUDED.warranty_start,
                 warranty_expiry   = EXCLUDED.warranty_expiry,
                 raw_st_data       = EXCLUDED.raw_st_data,
                 st_last_synced    = NOW(),
                 updated_at        = NOW()`,
          [
            String(item.id),
            item.customerId ? String(item.customerId) : null,
            null,
            item.name || 'Unnamed Equipment',
            item.manufacturer ?? null,
            item.model ?? null,
            item.serialNumber ?? null,
            item.installedOn ? 'installed' : 'in_stock',
            item.installedOn ?? null,
            item.manufacturerWarrantyStart ?? null,
            item.manufacturerWarrantyEnd ?? null,
            null,
            null,
            JSON.stringify(item),
          ],
        );
        synced++;
      } catch (e) {
        console.warn(`Equipment ${item.id} failed:`, (e as Error).message);
        failed++;
      }
    }

    await writeSyncLog('equipment', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('equipment', 'failed', synced, failed, (err as Error).message);
    throw err;
  }
}

interface StTechnician {
  id: number;
  name?: string;
  email?: string;
  phoneNumber?: string;
  active?: boolean;
}

export async function syncTechnicians(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  try {
    const techs = await stGetAll<StTechnician>('/settings/v2/technicians');

    for (const tech of techs) {
      try {
        const parts = (tech.name || '').trim().split(/\s+/);
        const first_name = parts[0] || 'Unknown';
        const last_name = parts.slice(1).join(' ') || '(ST)';
        const email = (tech.email || `st-tech-${tech.id}@christmasair.local`).toLowerCase();

        await query(
          `INSERT INTO users (st_technician_id, email, first_name, last_name, phone, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'technician', $6, NOW(), NOW())
           ON CONFLICT (st_technician_id) DO UPDATE SET
             email      = EXCLUDED.email,
             first_name = EXCLUDED.first_name,
             last_name  = EXCLUDED.last_name,
             phone      = COALESCE(EXCLUDED.phone, users.phone),
             is_active  = EXCLUDED.is_active,
             updated_at = NOW()`,
          [String(tech.id), email, first_name, last_name, tech.phoneNumber ?? null, tech.active !== false],
        );
        synced++;
      } catch (e) {
        console.warn(`Tech ${tech.id} failed:`, (e as Error).message);
        failed++;
      }
    }

    await writeSyncLog('technicians', failed > 0 ? 'partial' : 'success', synced, failed, null);
    return { synced, failed };
  } catch (err) {
    await writeSyncLog('technicians', 'failed', synced, failed, (err as Error).message);
    throw err;
  }
}

/** ServiceTitan does not expose a public vehicles/fleet endpoint; trucks are managed manually. */
export async function syncVehicles(): Promise<{ synced: number; failed: number; skipped: true; reason: string }> {
  const reason = 'ST does not expose a public vehicles endpoint; trucks are managed manually.';
  await writeSyncLog('trucks', 'skipped', 0, 0, reason);
  return { synced: 0, failed: 0, skipped: true, reason };
}
