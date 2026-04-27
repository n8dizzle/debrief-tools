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
    material: matRes.rows[0] as MaterialDetail['material'],
    warehouse_stock: wsRes.rows as MaterialDetail['warehouse_stock'],
    truck_stock: tsRes.rows as MaterialDetail['truck_stock'],
  };
}

export async function getMaterialByBarcode(barcode: string) {
  const { rows } = await query<MaterialListRow>(
    `SELECT m.*,
            COALESCE(SUM(ws.quantity_on_hand), 0) AS total_warehouse_stock,
            COALESCE(SUM(ts.quantity_on_hand), 0) AS total_truck_stock
       FROM materials m
       LEFT JOIN warehouse_stock ws ON ws.material_id = m.id
       LEFT JOIN truck_stock ts ON ts.material_id = m.id
      WHERE m.barcode = $1
      GROUP BY m.id`,
    [barcode],
  );
  if (!rows[0]) throw new AppError('Material not found for barcode', 404);
  return rows[0];
}

export interface MaterialInput {
  name?: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  unit_of_measure?: string | null;
  department?: string;
  category?: string | null;
  st_pricebook_id?: string | null;
  unit_cost?: number | null;
  reorder_point?: number | null;
  reorder_quantity?: number | null;
  max_stock?: number | null;
  primary_supply_house_id?: string | null;
  secondary_supply_house_id?: string | null;
  is_active?: boolean | null;
}

export async function createMaterial(b: MaterialInput): Promise<Material> {
  if (!b.name || !b.department) throw new AppError('name and department are required', 400);
  const { rows } = await query<Material>(
    `INSERT INTO materials
       (name, description, sku, barcode, unit_of_measure, department, category,
        st_pricebook_id, unit_cost, reorder_point, reorder_quantity, max_stock,
        primary_supply_house_id, secondary_supply_house_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [b.name, b.description ?? null, b.sku ?? null, b.barcode ?? null,
     b.unit_of_measure ?? null, b.department, b.category ?? null, b.st_pricebook_id ?? null,
     b.unit_cost ?? null, b.reorder_point ?? null, b.reorder_quantity ?? null, b.max_stock ?? null,
     b.primary_supply_house_id ?? null, b.secondary_supply_house_id ?? null],
  );
  return rows[0];
}

export async function updateMaterial(id: string, b: MaterialInput): Promise<Material> {
  const { rows } = await query<Material>(
    `UPDATE materials
        SET name                      = COALESCE($1, name),
            description               = COALESCE($2, description),
            sku                       = COALESCE($3, sku),
            barcode                   = COALESCE($4, barcode),
            unit_of_measure           = COALESCE($5, unit_of_measure),
            category                  = COALESCE($6, category),
            st_pricebook_id           = COALESCE($7, st_pricebook_id),
            unit_cost                 = COALESCE($8, unit_cost),
            reorder_point             = COALESCE($9, reorder_point),
            reorder_quantity          = COALESCE($10, reorder_quantity),
            max_stock                 = COALESCE($11, max_stock),
            primary_supply_house_id   = COALESCE($12, primary_supply_house_id),
            secondary_supply_house_id = COALESCE($13, secondary_supply_house_id),
            is_active                 = COALESCE($14, is_active),
            updated_at                = NOW()
      WHERE id = $15 RETURNING *`,
    [b.name ?? null, b.description ?? null, b.sku ?? null, b.barcode ?? null,
     b.unit_of_measure ?? null, b.category ?? null, b.st_pricebook_id ?? null,
     b.unit_cost ?? null, b.reorder_point ?? null, b.reorder_quantity ?? null, b.max_stock ?? null,
     b.primary_supply_house_id ?? null, b.secondary_supply_house_id ?? null, b.is_active ?? null, id],
  );
  if (!rows[0]) throw new AppError('Material not found', 404);
  return rows[0];
}
