import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';

export interface EquipmentRow {
  id: string;
  st_equipment_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  location_label: string | null;
  installed_at: string | null;
  warranty_start: string | null;
  warranty_expiry: string | null;
  installed_by_name: string | null;
  installed_truck_number: string | null;
  [k: string]: unknown;
}

export async function listEquipment(filter: {
  status?: string | null;
  department?: string | null;
  warehouseId?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status) { params.push(filter.status); conditions.push(`e.status = $${params.length}`); }
  if (filter.department) { params.push(filter.department); conditions.push(`e.department = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`e.warehouse_id = $${params.length}`); }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    conditions.push(`(e.name ILIKE $${params.length} OR e.serial_number ILIKE $${params.length} OR e.model ILIKE $${params.length})`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);

  const { rows } = await query<EquipmentRow>(
    `SELECT e.*,
            w.name  AS warehouse_name,
            wl.label AS location_label,
            u.first_name || ' ' || u.last_name AS installed_by_name,
            t.truck_number AS installed_truck_number
       FROM equipment e
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
       LEFT JOIN warehouse_locations wl ON wl.id = e.warehouse_location_id
       LEFT JOIN users u ON u.id = e.installed_by_tech
       LEFT JOIN trucks t ON t.id = e.installed_truck
      ${where}
      ORDER BY e.name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getEquipment(id: string): Promise<EquipmentRow> {
  const { rows } = await query<EquipmentRow>(
    `SELECT e.*, w.name AS warehouse_name, wl.label AS location_label,
            u.first_name || ' ' || u.last_name AS installed_by_name
       FROM equipment e
       LEFT JOIN warehouses w ON w.id = e.warehouse_id
       LEFT JOIN warehouse_locations wl ON wl.id = e.warehouse_location_id
       LEFT JOIN users u ON u.id = e.installed_by_tech
      WHERE e.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AppError('Equipment not found', 404);
  return rows[0];
}

export async function getEquipmentByStId(stId: string): Promise<EquipmentRow> {
  const { rows } = await query<EquipmentRow>(`SELECT * FROM equipment WHERE st_equipment_id = $1`, [stId]);
  if (!rows[0]) throw new AppError('Equipment not found', 404);
  return rows[0];
}

export async function updateEquipmentLocation(
  id: string,
  warehouseId: string | null,
  warehouseLocationId: string | null,
): Promise<EquipmentRow> {
  const { rows } = await query<EquipmentRow>(
    `UPDATE equipment
        SET warehouse_id          = COALESCE($1, warehouse_id),
            warehouse_location_id = COALESCE($2, warehouse_location_id),
            updated_at            = NOW()
      WHERE id = $3 AND status = 'in_stock'
      RETURNING *`,
    [warehouseId, warehouseLocationId, id],
  );
  if (!rows[0]) throw new AppError('Equipment not found or not in-stock', 404);
  return rows[0];
}
