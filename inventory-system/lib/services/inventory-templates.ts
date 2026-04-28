import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface InventoryTemplate {
  id: string;
  st_template_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  st_last_synced: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateItemRow {
  id: string;
  template_id: string;
  material_id: string | null;
  st_sku_id: string | null;
  target_quantity: number | string;
  // joined material fields when available
  material_name?: string | null;
  material_sku?: string | null;
  material_uom?: string | null;
  material_cost?: number | string | null;
}

export interface TemplateListRow extends InventoryTemplate {
  item_count: string;
  warehouse_count: string;
}

export async function listInventoryTemplates(): Promise<TemplateListRow[]> {
  const { rows } = await query<TemplateListRow>(
    `SELECT t.*,
            (SELECT COUNT(*) FROM inventory_template_items i WHERE i.template_id = t.id) AS item_count,
            (SELECT COUNT(*) FROM warehouses w WHERE w.st_inventory_template_id = t.st_template_id) AS warehouse_count
       FROM inventory_templates t
      ORDER BY t.is_active DESC, t.name`,
  );
  return rows;
}

export async function getInventoryTemplate(id: string) {
  const [tplRes, itemsRes, whsRes] = await Promise.all([
    query<InventoryTemplate>(`SELECT * FROM inventory_templates WHERE id = $1`, [id]),
    query<TemplateItemRow>(
      `SELECT i.*,
              m.name AS material_name, m.sku AS material_sku,
              m.unit_of_measure AS material_uom, m.unit_cost AS material_cost
         FROM inventory_template_items i
         LEFT JOIN materials m ON m.id = i.material_id OR m.st_pricebook_id = i.st_sku_id
        WHERE i.template_id = $1
        ORDER BY m.name NULLS LAST, i.target_quantity DESC`,
      [id],
    ),
    query<{ id: string; name: string }>(
      `SELECT w.id, w.name
         FROM inventory_templates t
         JOIN warehouses w ON w.st_inventory_template_id = t.st_template_id
        WHERE t.id = $1`,
      [id],
    ),
  ]);
  if (!tplRes.rows[0]) throw new AppError('Template not found', 404);
  return { template: tplRes.rows[0], items: itemsRes.rows, warehouses: whsRes.rows };
}

interface StTemplateItem {
  id?: number;
  skuId?: number;
  sku?: { id?: number };
  quantity?: number;
  targetQuantity?: number;
  qty?: number;
}

interface StTemplate {
  id: number;
  name?: string;
  description?: string;
  active?: boolean;
  items?: StTemplateItem[];
  inventoryTemplateItems?: StTemplateItem[];
}

const ST_BASE = 'https://api.servicetitan.io';
const ST_AUTH = 'https://auth.servicetitan.io/connect/token';

let _token: string | null = null;
let _tokenExpiry = 0;

async function stToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry - 30_000) return _token;
  const cfg = {
    clientId: process.env.ST_CLIENT_ID!,
    clientSecret: process.env.ST_CLIENT_SECRET!,
  };
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const res = await fetch(ST_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`ST auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _token = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _token;
}

async function stGet<T>(path: string, params: Record<string, string | number> = {}): Promise<{ data?: T[]; hasMore?: boolean }> {
  const token = await stToken();
  const search = new URLSearchParams({ pageSize: '500', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${ST_BASE}${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': process.env.ST_APP_KEY! },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`ST GET ${path} failed: ${res.status} ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as { data?: T[]; hasMore?: boolean };
}

async function stGetAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  while (true) {
    const data = await stGet<T>(path, { page });
    out.push(...(data.data ?? []));
    if (!data.hasMore) break;
    page++;
  }
  return out;
}

async function writeSyncLog(status: string, synced: number, failed: number, errorDetail: string | null) {
  await query(
    `INSERT INTO st_sync_log (sync_type, status, records_synced, records_failed, error_detail, completed_at)
     VALUES ('inventory_templates', $1, $2, $3, $4, NOW())`,
    [status, synced, failed, errorDetail],
  );
}

/**
 * Pull inventory templates from ServiceTitan. Requires an `inventory.read`
 * (or the template-specific) scope on the integration app — without it ST
 * returns 403 and we record the issue in `st_sync_log`.
 */
export async function syncInventoryTemplates(): Promise<{
  synced: number;
  failed: number;
  skipped?: true;
  reason?: string;
}> {
  const tid = process.env.ST_TENANT_ID;
  if (!tid || !process.env.ST_CLIENT_ID || process.env.ST_CLIENT_ID === 'placeholder') {
    const reason = 'ServiceTitan credentials not configured';
    await writeSyncLog('skipped', 0, 0, reason);
    return { synced: 0, failed: 0, skipped: true, reason };
  }

  let templates: StTemplate[];
  try {
    templates = await stGetAll<StTemplate>(`/inventory/v2/tenant/${tid}/inventory-templates`);
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 403) {
      const reason =
        'ServiceTitan returned 403 — your integration app needs the inventory-templates scope. ' +
        'Open the ST integration app, enable "Inventory" / "Read inventory templates", and re-run.';
      await writeSyncLog('skipped', 0, 0, reason);
      return { synced: 0, failed: 0, skipped: true, reason };
    }
    await writeSyncLog('failed', 0, 0, err.message);
    throw err;
  }

  let synced = 0;
  let failed = 0;

  for (const tpl of templates) {
    try {
      await transaction(async (q) => {
        const { rows } = await q<{ id: string }>(
          `INSERT INTO inventory_templates
             (st_template_id, name, description, is_active, raw_st_data, st_last_synced, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW(), NOW())
           ON CONFLICT (st_template_id) DO UPDATE SET
             name           = EXCLUDED.name,
             description    = EXCLUDED.description,
             is_active      = EXCLUDED.is_active,
             raw_st_data    = EXCLUDED.raw_st_data,
             st_last_synced = NOW(),
             updated_at     = NOW()
           RETURNING id`,
          [String(tpl.id), tpl.name || `Template ${tpl.id}`, tpl.description ?? null, tpl.active !== false, JSON.stringify(tpl)],
        );
        const localId = rows[0].id;

        const items = tpl.items ?? tpl.inventoryTemplateItems ?? [];

        // Replace items wholesale — simpler than diffing
        await q(`DELETE FROM inventory_template_items WHERE template_id = $1`, [localId]);

        for (const item of items) {
          const skuId = item.skuId ?? item.sku?.id ?? item.id;
          const qty = item.targetQuantity ?? item.quantity ?? item.qty ?? 0;
          if (skuId == null) continue;
          await q(
            `INSERT INTO inventory_template_items
               (template_id, material_id, st_sku_id, target_quantity, created_at, updated_at)
             VALUES ($1, (SELECT id FROM materials WHERE st_pricebook_id = $2), $2, $3, NOW(), NOW())
             ON CONFLICT (template_id, st_sku_id) DO UPDATE SET
               target_quantity = EXCLUDED.target_quantity,
               updated_at      = NOW()`,
            [localId, String(skuId), qty],
          );
        }
      });
      synced++;
    } catch (e) {
      console.warn(`Template ${tpl.id} failed:`, (e as Error).message);
      failed++;
    }
  }

  await writeSyncLog(failed > 0 ? 'partial' : 'success', synced, failed, null);
  return { synced, failed };
}
