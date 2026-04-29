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

export interface EquipmentInput {
  name?: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status?: string | null;
  department?: string | null;
  warehouse_id?: string | null;
  truck_id?: string | null;
  location_notes?: string | null;
  installed_at?: string | null;
  warranty_start?: string | null;
  warranty_expiry?: string | null;
  notes?: string | null;
  st_equipment_id?: string | null;
  st_customer_id?: string | null;
  is_active?: boolean | null;
}

export async function createEquipment(b: EquipmentInput): Promise<EquipmentRow> {
  if (!b.name) throw new AppError('name is required', 400);
  const { rows } = await query<EquipmentRow>(
    `INSERT INTO equipment
       (name, manufacturer, model, serial_number, status, department,
        warehouse_id, location_notes, warranty_start, warranty_expiry, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [b.name, b.manufacturer ?? null, b.model ?? null, b.serial_number ?? null,
     b.status ?? 'in_stock', b.department ?? null, b.warehouse_id ?? null,
     b.location_notes ?? null, b.warranty_start ?? null, b.warranty_expiry ?? null, b.notes ?? null],
  );
  return rows[0];
}

export async function updateEquipment(id: string, b: EquipmentInput): Promise<EquipmentRow> {
  const { rows } = await query<EquipmentRow>(
    `UPDATE equipment
        SET name            = COALESCE($1, name),
            manufacturer    = COALESCE($2, manufacturer),
            model           = COALESCE($3, model),
            serial_number   = COALESCE($4, serial_number),
            status          = COALESCE($5, status),
            department      = COALESCE($6, department),
            warehouse_id    = COALESCE($7, warehouse_id),
            location_notes  = COALESCE($8, location_notes),
            warranty_start  = COALESCE($9, warranty_start),
            warranty_expiry = COALESCE($10, warranty_expiry),
            notes           = COALESCE($11, notes),
            updated_at      = NOW()
      WHERE id = $12
      RETURNING *`,
    [b.name ?? null, b.manufacturer ?? null, b.model ?? null, b.serial_number ?? null,
     b.status ?? null, b.department ?? null, b.warehouse_id ?? null,
     b.location_notes ?? null, b.warranty_start ?? null, b.warranty_expiry ?? null,
     b.notes ?? null, id],
  );
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
