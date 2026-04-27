import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface TechBin {
  id: string;
  barcode: string;
  bin_label: string;
  technician_id: string;
  warehouse_id: string;
  status: string;
  [k: string]: unknown;
}

export interface TechBinListRow extends TechBin {
  technician_name: string;
  warehouse_name: string;
  item_count: string;
}

export async function listTechBins(filter: { technicianId?: string | null; warehouseId?: string | null; status?: string | null }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.technicianId) { params.push(filter.technicianId); conditions.push(`tb.technician_id = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`tb.warehouse_id = $${params.length}`); }
  if (filter.status) { params.push(filter.status); conditions.push(`tb.status = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query<TechBinListRow>(
    `SELECT tb.*,
            u.first_name || ' ' || u.last_name AS technician_name,
            w.name AS warehouse_name,
            COUNT(bi.id) AS item_count
       FROM tech_bins tb
       JOIN users u ON u.id = tb.technician_id
       JOIN warehouses w ON w.id = tb.warehouse_id
       LEFT JOIN bin_items bi ON bi.bin_id = tb.id AND bi.scanned_at IS NULL
      ${where}
      GROUP BY tb.id, u.first_name, u.last_name, w.name
      ORDER BY tb.bin_label`,
    params,
  );
  return rows;
}

export async function getTechBinByBarcode(barcode: string): Promise<TechBin> {
  const { rows } = await query<TechBin>(
    `SELECT tb.*, u.first_name || ' ' || u.last_name AS technician_name, w.name AS warehouse_name
       FROM tech_bins tb
       JOIN users u ON u.id = tb.technician_id
       JOIN warehouses w ON w.id = tb.warehouse_id
      WHERE tb.barcode = $1`,
    [barcode],
  );
  if (!rows[0]) throw new AppError('Bin not found for barcode', 404);
  return rows[0];
}

export async function getTechBin(id: string) {
  const [binRes, itemsRes] = await Promise.all([
    query<TechBin>(
      `SELECT tb.*, u.first_name || ' ' || u.last_name AS technician_name,
              w.name AS warehouse_name, t.truck_number AS assigned_truck_number
         FROM tech_bins tb
         JOIN users u ON u.id = tb.technician_id
         JOIN warehouses w ON w.id = tb.warehouse_id
         LEFT JOIN trucks t ON t.id = u.assigned_truck_id
        WHERE tb.id = $1`,
      [id],
    ),
    query(
      `SELECT bi.*, m.name AS material_name, m.sku, m.unit_of_measure
         FROM bin_items bi
         JOIN materials m ON m.id = bi.material_id
        WHERE bi.bin_id = $1
        ORDER BY bi.placed_at DESC`,
      [id],
    ),
  ]);
  if (!binRes.rows[0]) throw new AppError('Bin not found', 404);
  return { bin: binRes.rows[0], items: itemsRes.rows };
}

export async function createTechBin(b: { barcode: string; bin_label: string; technician_id: string; warehouse_id: string }): Promise<TechBin> {
  const { rows } = await query<TechBin>(
    `INSERT INTO tech_bins (barcode, bin_label, technician_id, warehouse_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [b.barcode, b.bin_label, b.technician_id, b.warehouse_id],
  );
  return rows[0];
}

interface BinScanItem {
  id: string;
  material_id: string;
  quantity: number;
  restock_line_id: string | null;
  batch_id: string | null;
  batch_warehouse_id: string | null;
}

export async function scanBin(binId: string, scannedByUserId: string) {
  return transaction(async (q) => {
    const { rows: binRows } = await q<TechBin & { assigned_truck_id: string | null; warehouse_id: string }>(
      `SELECT tb.*, u.assigned_truck_id, t.home_warehouse_id AS warehouse_id
         FROM tech_bins tb
         JOIN users u ON u.id = tb.technician_id
         LEFT JOIN trucks t ON t.id = u.assigned_truck_id
        WHERE tb.id = $1`,
      [binId],
    );
    const bin = binRows[0];
    if (!bin) throw new AppError('Bin not found', 404);
    if (!bin.assigned_truck_id) {
      throw new AppError('Technician has no truck assigned — cannot transfer bin contents', 400, 'NO_TRUCK');
    }

    const { rows: items } = await q<BinScanItem>(
      `SELECT bi.*, rl.batch_id, rb.warehouse_id AS batch_warehouse_id
         FROM bin_items bi
         LEFT JOIN restock_lines rl ON rl.id = bi.restock_line_id
         LEFT JOIN restock_batches rb ON rb.id = rl.batch_id
        WHERE bi.bin_id = $1 AND bi.scanned_at IS NULL`,
      [binId],
    );

    if (items.length === 0) return { message: 'Bin is empty — nothing to transfer', transferred: 0, bin };

    const transferred: Array<{ material_id: string; quantity: number }> = [];
    for (const item of items) {
      const sourceWarehouseId = item.batch_warehouse_id || bin.warehouse_id;

      await q(
        `UPDATE warehouse_stock
            SET quantity_on_hand  = GREATEST(0, quantity_on_hand  - $1),
                quantity_reserved = GREATEST(0, quantity_reserved - $1)
          WHERE material_id = $2 AND warehouse_id = $3`,
        [item.quantity, item.material_id, sourceWarehouseId],
      );

      await q(
        `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
         VALUES ($1,$2,$3)
         ON CONFLICT (material_id, truck_id)
         DO UPDATE SET quantity_on_hand = truck_stock.quantity_on_hand + $3`,
        [item.material_id, bin.assigned_truck_id, item.quantity],
      );

      await q(
        `INSERT INTO material_movements
           (material_id, movement_type, quantity, performed_by,
            from_warehouse_id, from_bin_id, to_truck_id,
            restock_batch_id, restock_line_id)
         VALUES ($1,'bin_to_truck',$2,$3,$4,$5,$6,$7,$8)`,
        [item.material_id, item.quantity, scannedByUserId,
         sourceWarehouseId, binId, bin.assigned_truck_id,
         item.batch_id, item.restock_line_id],
      );

      await q(
        `UPDATE bin_items SET scanned_at = NOW(), transferred_to_truck = $1 WHERE id = $2`,
        [bin.assigned_truck_id, item.id],
      );

      transferred.push({ material_id: item.material_id, quantity: item.quantity });
    }

    await q(`UPDATE tech_bins SET status = 'empty', updated_at = NOW() WHERE id = $1`, [binId]);

    return {
      message: `Transferred ${items.length} item type(s) to truck ${bin.assigned_truck_id}`,
      transferred: items.length,
      details: transferred,
    };
  });
}
