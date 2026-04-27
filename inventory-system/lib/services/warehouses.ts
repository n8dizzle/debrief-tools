import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';
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

export interface WarehouseDetail extends Warehouse {
  trucks: Array<Record<string, unknown>> | null;
}

export async function getWarehouse(id: string): Promise<WarehouseDetail> {
  const { rows } = await query<WarehouseDetail>(
    `SELECT w.*,
            json_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL) AS trucks
       FROM warehouses w
       LEFT JOIN trucks t ON t.home_warehouse_id = w.id AND t.status = 'active'
      WHERE w.id = $1
      GROUP BY w.id`,
    [id],
  );
  if (!rows[0]) throw new AppError('Warehouse not found', 404);
  return rows[0];
}

export interface WarehouseInput {
  name?: string;
  department?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_radius_miles?: number | null;
  status?: string | null;
}

export async function createWarehouse(b: WarehouseInput): Promise<Warehouse> {
  if (!b.name || !b.department) throw new AppError('name and department are required', 400);
  const { rows } = await query<Warehouse>(
    `INSERT INTO warehouses (name, department, address, city, state, zip, geo_lat, geo_lng, geo_radius_miles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [b.name, b.department, b.address ?? null, b.city ?? null, b.state ?? null,
     b.zip ?? null, b.geo_lat ?? null, b.geo_lng ?? null, b.geo_radius_miles ?? null],
  );
  return rows[0];
}

export async function updateWarehouse(id: string, b: WarehouseInput): Promise<Warehouse> {
  const { rows } = await query<Warehouse>(
    `UPDATE warehouses
        SET name             = COALESCE($1, name),
            address          = COALESCE($2, address),
            city             = COALESCE($3, city),
            state            = COALESCE($4, state),
            zip              = COALESCE($5, zip),
            geo_lat          = COALESCE($6, geo_lat),
            geo_lng          = COALESCE($7, geo_lng),
            geo_radius_miles = COALESCE($8, geo_radius_miles),
            status           = COALESCE($9, status),
            updated_at       = NOW()
      WHERE id = $10
      RETURNING *`,
    [b.name ?? null, b.address ?? null, b.city ?? null, b.state ?? null,
     b.zip ?? null, b.geo_lat ?? null, b.geo_lng ?? null, b.geo_radius_miles ?? null,
     b.status ?? null, id],
  );
  if (!rows[0]) throw new AppError('Warehouse not found', 404);
  return rows[0];
}
