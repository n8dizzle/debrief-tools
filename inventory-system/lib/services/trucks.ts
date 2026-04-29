import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';
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

export interface TruckDetail extends Truck {
  warehouse_name: string;
  assigned_users: Array<{ id: string; name: string; role: string }> | null;
}

export async function getTruck(id: string): Promise<TruckDetail> {
  const { rows } = await query<TruckDetail>(
    `SELECT t.*,
            w.name AS warehouse_name,
            json_agg(
              json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name, 'role', u.role)
            ) FILTER (WHERE u.id IS NOT NULL) AS assigned_users
       FROM trucks t
       JOIN warehouses w ON w.id = t.home_warehouse_id
       LEFT JOIN users u ON u.assigned_truck_id = t.id AND u.is_active = TRUE
      WHERE t.id = $1
      GROUP BY t.id, w.name`,
    [id],
  );
  if (!rows[0]) throw new AppError('Truck not found', 404);
  return rows[0];
}

export async function getTruckStock(id: string) {
  const { rows } = await query(
    `SELECT ts.*, m.name, m.sku, m.barcode, m.unit_of_measure, m.category, m.reorder_point
       FROM truck_stock ts
       JOIN materials m ON m.id = ts.material_id
      WHERE ts.truck_id = $1
      ORDER BY m.category, m.name`,
    [id],
  );
  return rows;
}

export interface TruckInput {
  truck_number?: string;
  department?: string;
  home_warehouse_id?: string;
  st_vehicle_id?: string | null;
  template_id?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  license_plate?: string | null;
  vin?: string | null;
  status?: string | null;
}

export async function createTruck(b: TruckInput): Promise<Truck> {
  if (!b.truck_number || !b.department || !b.home_warehouse_id) {
    throw new AppError('truck_number, department, and home_warehouse_id are required', 400);
  }
  const { rows } = await query<Truck>(
    `INSERT INTO trucks (truck_number, department, home_warehouse_id, st_vehicle_id, make, model, year, license_plate, vin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [b.truck_number, b.department, b.home_warehouse_id, b.st_vehicle_id ?? null,
     b.make ?? null, b.model ?? null, b.year ?? null, b.license_plate ?? null, b.vin ?? null],
  );
  return rows[0];
}

export async function updateTruck(id: string, b: TruckInput): Promise<Truck> {
  // Build SET clauses dynamically so we can handle template_id = NULL explicitly
  const setClauses: string[] = [
    `truck_number  = COALESCE($1, truck_number)`,
    `st_vehicle_id = COALESCE($2, st_vehicle_id)`,
    `make          = COALESCE($3, make)`,
    `model         = COALESCE($4, model)`,
    `year          = COALESCE($5, year)`,
    `license_plate = COALESCE($6, license_plate)`,
    `vin           = COALESCE($7, vin)`,
    `status        = COALESCE($8, status)`,
    `updated_at    = NOW()`,
  ];
  const params: unknown[] = [
    b.truck_number ?? null, b.st_vehicle_id ?? null, b.make ?? null, b.model ?? null,
    b.year ?? null, b.license_plate ?? null, b.vin ?? null, b.status ?? null,
  ];

  if ('template_id' in b) {
    params.push(b.template_id ?? null);
    setClauses.splice(setClauses.length - 1, 0, `template_id = $${params.length}`);
  }

  params.push(id);
  const idParam = `$${params.length}`;

  const { rows } = await query<Truck>(
    `UPDATE trucks SET ${setClauses.join(', ')} WHERE id = ${idParam} RETURNING *`,
    params,
  );
  if (!rows[0]) throw new AppError('Truck not found', 404);
  return rows[0];
}

export async function applyTemplateToTruck(truckId: string, templateId: string): Promise<{ applied: number }> {
  const { rows: items } = await query<{ material_id: string | null; target_quantity: string | number }>(
    `SELECT material_id, target_quantity
       FROM inventory_template_items
      WHERE template_id = $1 AND material_id IS NOT NULL`,
    [templateId],
  );

  if (items.length === 0) return { applied: 0 };

  let applied = 0;
  for (const item of items) {
    if (!item.material_id) continue;
    const minQty = Number(item.target_quantity);
    await query(
      `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand, min_quantity)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (material_id, truck_id)
       DO UPDATE SET min_quantity = $3`,
      [item.material_id, truckId, minQty],
    );
    applied++;
  }

  return { applied };
}
