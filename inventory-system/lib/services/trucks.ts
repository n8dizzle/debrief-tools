import 'server-only';
import { query } from '../db';
import type { Truck } from '@/types';

export interface TruckListRow extends Truck {
  warehouse_name: string;
  primary_tech_name: string | null;
}

export async function listTrucks(filter: { department?: string | null; warehouseId?: string | null } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.department) {
    params.push(filter.department);
    conditions.push(`t.department = $${params.length}`);
  }
  if (filter.warehouseId) {
    params.push(filter.warehouseId);
    conditions.push(`t.home_warehouse_id = $${params.length}`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query<TruckListRow>(
    `SELECT t.*,
            w.name AS warehouse_name,
            u.first_name || ' ' || u.last_name AS primary_tech_name
       FROM trucks t
       JOIN warehouses w ON w.id = t.home_warehouse_id
       LEFT JOIN users u ON u.assigned_truck_id = t.id AND u.is_active = TRUE
      ${where}
      ORDER BY t.truck_number`,
    params,
  );
  return rows;
}
