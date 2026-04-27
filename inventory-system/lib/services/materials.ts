import 'server-only';
import { query } from '../db';
import { AppError } from '../errors';
import type { Material } from '@/types';

export interface MaterialListFilter {
  department?: string | null;
  category?: string | null;
  search?: string | null;
  isActive?: boolean | null;
  belowReorder?: boolean;
}

export interface MaterialListRow extends Material {
  primary_supply_house_name?: string | null;
  secondary_supply_house_name?: string | null;
  total_warehouse_stock: string | number;
  total_truck_stock: string | number;
}

export async function listMaterials(filter: MaterialListFilter = {}): Promise<MaterialListRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.department) {
    params.push(filter.department);
    conditions.push(`m.department = $${params.length}`);
  }
  if (filter.category) {
    params.push(filter.category);
    conditions.push(`m.category = $${params.length}`);
  }
  if (filter.isActive !== null && filter.isActive !== undefined) {
    params.push(filter.isActive);
    conditions.push(`m.is_active = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search}%`);
    conditions.push(
      `(m.name ILIKE $${params.length} OR m.sku ILIKE $${params.length} OR m.barcode ILIKE $${params.length})`,
    );
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const having = filter.belowReorder ? 'HAVING COALESCE(SUM(ws.quantity_on_hand), 0) <= m.reorder_point' : '';

  const { rows } = await query<MaterialListRow>(
    `SELECT m.*,
            ps.name AS primary_supply_house_name,
            ss.name AS secondary_supply_house_name,
            COALESCE(SUM(ws.quantity_on_hand), 0) AS total_warehouse_stock,
            COALESCE(SUM(ts.quantity_on_hand), 0) AS total_truck_stock
       FROM materials m
       LEFT JOIN supply_houses ps ON ps.id = m.primary_supply_house_id
       LEFT JOIN supply_houses ss ON ss.id = m.secondary_supply_house_id
       LEFT JOIN warehouse_stock ws ON ws.material_id = m.id
       LEFT JOIN truck_stock ts ON ts.material_id = m.id
      ${where}
      GROUP BY m.id, ps.name, ss.name
      ${having}
      ORDER BY m.category, m.name`,
    params,
  );
  return rows;
}

export interface MaterialDetail {
  material: Material & {
    primary_supply_house_name?: string | null;
    secondary_supply_house_name?: string | null;
  };
  warehouse_stock: Array<{
    warehouse_id: string;
    warehouse_name: string;
    location_label: string | null;
    quantity_on_hand: number | string;
  }>;
  truck_stock: Array<{
    truck_id: string;
    truck_number: string;
    quantity_on_hand: number | string;
  }>;
}

export async function getMaterial(id: string): Promise<MaterialDetail> {
  const [matRes, wsRes, tsRes] = await Promise.all([
    query(
      `SELECT m.*,
              ps.name AS primary_supply_house_name,
              ss.name AS secondary_supply_house_name
         FROM materials m
         LEFT JOIN supply_houses ps ON ps.id = m.primary_supply_house_id
         LEFT JOIN supply_houses ss ON ss.id = m.secondary_supply_house_id
        WHERE m.id = $1`,
      [id],
    ),
    query(
      `SELECT ws.*, w.name AS warehouse_name, wl.label AS location_label
         FROM warehouse_stock ws
         JOIN warehouses w ON w.id = ws.warehouse_id
         LEFT JOIN warehouse_locations wl ON wl.id = ws.location_id
        WHERE ws.material_id = $1`,
      [id],
    ),
    query(
      `SELECT ts.*, t.truck_number
         FROM truck_stock ts
         JOIN trucks t ON t.id = ts.truck_id
        WHERE ts.material_id = $1 AND ts.quantity_on_hand > 0`,
      [id],
    ),
  ]);

  if (!matRes.rows[0]) throw new AppError('Material not found', 404);

  return {
    material: matRes.rows[0],
    warehouse_stock: wsRes.rows as MaterialDetail['warehouse_stock'],
    truck_stock: tsRes.rows as MaterialDetail['truck_stock'],
  };
}
