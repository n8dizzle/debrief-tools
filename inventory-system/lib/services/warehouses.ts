import 'server-only';
import { query } from '../db';
import type { Warehouse } from '@/types';

export interface WarehouseListRow extends Warehouse {
  active_truck_count: string;
}

export async function listWarehouses() {
  const { rows } = await query<WarehouseListRow>(
    `SELECT w.*,
            (SELECT COUNT(*) FROM trucks t WHERE t.home_warehouse_id = w.id AND t.status = 'active') AS active_truck_count
       FROM warehouses w
      ORDER BY w.name`,
  );
  return rows;
}
