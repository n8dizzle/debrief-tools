import 'server-only';
import { query } from '../db';

export interface DashboardStats {
  materials_below_reorder: number;
  restock_batches: Array<{ status: string; count: string }>;
  purchase_orders: Array<{ status: string; count: string }>;
  tools: Array<{ status: string; count: string }>;
  it_assets: Array<{ status: string; count: string }>;
  last_st_syncs: Array<{ sync_type: string; status: string; started_at: string; records_synced: number }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [materials, batches, pos, tools, assets, lastSync] = await Promise.all([
    query<{ below_reorder_count: string }>(`
      SELECT COUNT(DISTINCT m.id) AS below_reorder_count
        FROM materials m
        JOIN warehouse_stock ws ON ws.material_id = m.id
       WHERE ws.quantity_on_hand <= m.reorder_point AND m.is_active = TRUE
    `),
    query(`SELECT status, COUNT(*) AS count FROM restock_batches WHERE status NOT IN ('completed','partially_completed') GROUP BY status`),
    query(`SELECT status, COUNT(*) AS count FROM purchase_orders WHERE status NOT IN ('received','cancelled') GROUP BY status`),
    query(`SELECT status, COUNT(*) AS count FROM tools WHERE is_active = TRUE GROUP BY status`),
    query(`SELECT status, COUNT(*) AS count FROM it_assets WHERE is_active = TRUE GROUP BY status`),
    query(`SELECT sync_type, status, started_at, records_synced FROM st_sync_log ORDER BY started_at DESC LIMIT 5`),
  ]);

  return {
    materials_below_reorder: parseInt(materials.rows[0]?.below_reorder_count ?? '0', 10),
    restock_batches: batches.rows as DashboardStats['restock_batches'],
    purchase_orders: pos.rows as DashboardStats['purchase_orders'],
    tools: tools.rows as DashboardStats['tools'],
    it_assets: assets.rows as DashboardStats['it_assets'],
    last_st_syncs: lastSync.rows as DashboardStats['last_st_syncs'],
  };
}
