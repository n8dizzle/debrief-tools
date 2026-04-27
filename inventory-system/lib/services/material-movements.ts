import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

type Q = (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

export interface RecordMovementInput {
  material_id: string;
  movement_type:
    | 'received' | 'transferred' | 'loaded_to_bin' | 'bin_to_truck'
    | 'consumed_on_job' | 'returned_to_stock' | 'adjustment' | 'cycle_count';
  quantity: number;
  performed_by?: string | null;
  from_warehouse_id?: string | null;
  from_truck_id?: string | null;
  from_bin_id?: string | null;
  to_warehouse_id?: string | null;
  to_truck_id?: string | null;
  to_bin_id?: string | null;
  st_job_id?: string | null;
  st_work_order_id?: string | null;
  notes?: string | null;
  restock_batch_id?: string | null;
  restock_line_id?: string | null;
  po_id?: string | null;
}

interface MovementRow {
  id: string;
  material_id: string;
  movement_type: string;
  quantity: number;
  from_truck_id: string | null;
  st_job_id: string | null;
  st_work_order_id: string | null;
  [k: string]: unknown;
}

async function upsertWarehouseStock(q: Q, materialId: string, warehouseId: string, delta: number) {
  await q(
    `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand)
     VALUES ($1,$2,$3)
     ON CONFLICT (material_id, warehouse_id, location_id)
     DO UPDATE SET quantity_on_hand = warehouse_stock.quantity_on_hand + $3,
                   last_counted_at = CASE WHEN $3 = 0 THEN NOW() ELSE warehouse_stock.last_counted_at END`,
    [materialId, warehouseId, delta],
  );
}

async function adjustWarehouseStock(q: Q, materialId: string, warehouseId: string, delta: number) {
  const { rows } = await q(
    `UPDATE warehouse_stock
        SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1)
      WHERE material_id = $2 AND warehouse_id = $3
      RETURNING quantity_on_hand`,
    [delta, materialId, warehouseId],
  );
  if (!rows[0]) throw new AppError(`No warehouse stock record for material ${materialId}`, 400);
}

async function upsertTruckStock(q: Q, materialId: string, truckId: string, delta: number) {
  await q(
    `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
     VALUES ($1,$2,$3)
     ON CONFLICT (material_id, truck_id)
     DO UPDATE SET quantity_on_hand = GREATEST(0, truck_stock.quantity_on_hand + $3)`,
    [materialId, truckId, delta],
  );
}

async function adjustTruckStock(q: Q, materialId: string, truckId: string, delta: number) {
  const { rows } = await q(
    `UPDATE truck_stock
        SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1)
      WHERE material_id = $2 AND truck_id = $3
      RETURNING quantity_on_hand`,
    [delta, materialId, truckId],
  );
  if (!rows[0]) {
    await q(
      `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
       VALUES ($1,$2, GREATEST(0, $3))
       ON CONFLICT DO NOTHING`,
      [materialId, truckId, delta],
    );
  }
}

export async function recordMovement(data: RecordMovementInput): Promise<MovementRow> {
  const movement = await transaction<MovementRow>(async (q) => {
    const { rows } = await q<MovementRow>(
      `INSERT INTO material_movements
         (material_id, movement_type, quantity, performed_by,
          from_warehouse_id, from_truck_id, from_bin_id,
          to_warehouse_id,   to_truck_id,   to_bin_id,
          st_job_id, st_work_order_id, notes, restock_batch_id, restock_line_id, po_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.material_id, data.movement_type, data.quantity, data.performed_by ?? null,
        data.from_warehouse_id ?? null, data.from_truck_id ?? null, data.from_bin_id ?? null,
        data.to_warehouse_id ?? null, data.to_truck_id ?? null, data.to_bin_id ?? null,
        data.st_job_id ?? null, data.st_work_order_id ?? null, data.notes ?? null,
        data.restock_batch_id ?? null, data.restock_line_id ?? null, data.po_id ?? null,
      ],
    );
    const movement = rows[0];
    const wrap: Q = q as unknown as Q;

    switch (data.movement_type) {
      case 'received':
        if (data.to_warehouse_id) await upsertWarehouseStock(wrap, data.material_id, data.to_warehouse_id, data.quantity);
        break;
      case 'transferred':
        if (data.from_warehouse_id) await adjustWarehouseStock(wrap, data.material_id, data.from_warehouse_id, -data.quantity);
        if (data.from_truck_id) await adjustTruckStock(wrap, data.material_id, data.from_truck_id, -data.quantity);
        if (data.to_warehouse_id) await upsertWarehouseStock(wrap, data.material_id, data.to_warehouse_id, data.quantity);
        if (data.to_truck_id) await upsertTruckStock(wrap, data.material_id, data.to_truck_id, data.quantity);
        break;
      case 'loaded_to_bin':
        if (data.from_warehouse_id) {
          await q(
            `UPDATE warehouse_stock
                SET quantity_reserved = quantity_reserved + $1
              WHERE material_id = $2 AND warehouse_id = $3`,
            [data.quantity, data.material_id, data.from_warehouse_id],
          );
        }
        break;
      case 'bin_to_truck':
        if (data.from_warehouse_id) {
          await q(
            `UPDATE warehouse_stock
                SET quantity_on_hand = quantity_on_hand - $1,
                    quantity_reserved = quantity_reserved - $1
              WHERE material_id = $2 AND warehouse_id = $3`,
            [data.quantity, data.material_id, data.from_warehouse_id],
          );
        }
        if (data.to_truck_id) await upsertTruckStock(wrap, data.material_id, data.to_truck_id, data.quantity);
        break;
      case 'consumed_on_job':
        if (data.from_truck_id) await adjustTruckStock(wrap, data.material_id, data.from_truck_id, -data.quantity);
        break;
      case 'returned_to_stock':
        if (data.from_truck_id) await adjustTruckStock(wrap, data.material_id, data.from_truck_id, -data.quantity);
        if (data.to_warehouse_id) await upsertWarehouseStock(wrap, data.material_id, data.to_warehouse_id, data.quantity);
        break;
      default:
        break;
    }
    return movement;
  });

  // Auto-create restock line for consumed_on_job (outside the transaction)
  if (movement.movement_type === 'consumed_on_job' && movement.from_truck_id && movement.st_job_id) {
    try {
      // Lazy import to avoid circular dep at module load
      const { autoCreateRestockLine } = await import('./restock-batches-auto');
      await autoCreateRestockLine({
        truck_id: movement.from_truck_id,
        material_id: movement.material_id,
        quantity_requested: movement.quantity,
        st_job_id: movement.st_job_id,
        st_work_order_id: movement.st_work_order_id,
      });
    } catch (err) {
      console.warn('[recordMovement] auto-create restock line failed:', (err as Error).message);
    }
  }

  return movement;
}

export interface ListMovementsFilter {
  materialId?: string | null;
  truckId?: string | null;
  warehouseId?: string | null;
  movementType?: string | null;
  stJobId?: string | null;
  limit?: number;
  offset?: number;
}

export async function listMovements(filter: ListMovementsFilter) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.materialId) { params.push(filter.materialId); conditions.push(`mm.material_id = $${params.length}`); }
  if (filter.truckId) { params.push(filter.truckId); conditions.push(`(mm.from_truck_id = $${params.length} OR mm.to_truck_id = $${params.length})`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`(mm.from_warehouse_id = $${params.length} OR mm.to_warehouse_id = $${params.length})`); }
  if (filter.movementType) { params.push(filter.movementType); conditions.push(`mm.movement_type = $${params.length}`); }
  if (filter.stJobId) { params.push(filter.stJobId); conditions.push(`mm.st_job_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(filter.limit ?? 100);
  params.push(filter.offset ?? 0);

  const { rows } = await query(
    `SELECT mm.*,
            m.name AS material_name, m.sku, m.unit_of_measure,
            u.first_name || ' ' || u.last_name AS performed_by_name,
            fw.name AS from_warehouse_name, tw.name AS to_warehouse_name,
            ft.truck_number AS from_truck_number, tt.truck_number AS to_truck_number
       FROM material_movements mm
       JOIN materials m ON m.id = mm.material_id
       LEFT JOIN users u ON u.id = mm.performed_by
       LEFT JOIN warehouses fw ON fw.id = mm.from_warehouse_id
       LEFT JOIN warehouses tw ON tw.id = mm.to_warehouse_id
       LEFT JOIN trucks ft ON ft.id = mm.from_truck_id
       LEFT JOIN trucks tt ON tt.id = mm.to_truck_id
      ${where}
      ORDER BY mm.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getWarehouseStock(warehouseId: string, opts: { category?: string | null; belowReorder?: boolean } = {}) {
  const conditions = [`ws.warehouse_id = $1`];
  const params: unknown[] = [warehouseId];
  if (opts.category) { params.push(opts.category); conditions.push(`m.category = $${params.length}`); }
  const havingClause = opts.belowReorder ? 'HAVING ws.quantity_on_hand <= m.reorder_point' : '';

  const { rows } = await query(
    `SELECT ws.*, m.name, m.sku, m.barcode, m.category, m.unit_of_measure,
            m.reorder_point, m.reorder_quantity, m.max_stock, m.unit_cost,
            wl.label AS location_label,
            (ws.quantity_on_hand * m.unit_cost) AS stock_value
       FROM warehouse_stock ws
       JOIN materials m ON m.id = ws.material_id AND m.is_active = TRUE
       LEFT JOIN warehouse_locations wl ON wl.id = ws.location_id
      WHERE ${conditions.join(' AND ')}
      ${havingClause}
      ORDER BY m.category, m.name`,
    params,
  );
  return rows;
}

export async function adjustStock({
  material_id, warehouse_id, truck_id, new_quantity, notes, performed_by,
}: {
  material_id: string;
  warehouse_id?: string | null;
  truck_id?: string | null;
  new_quantity: number;
  notes: string;
  performed_by: string | null;
}) {
  if (!warehouse_id && !truck_id) throw new AppError('Either warehouse_id or truck_id is required', 400);

  return transaction(async (q) => {
    let old_quantity = 0;

    if (warehouse_id) {
      const { rows } = await q<{ quantity_on_hand: number }>(
        `SELECT quantity_on_hand FROM warehouse_stock WHERE material_id=$1 AND warehouse_id=$2`,
        [material_id, warehouse_id],
      );
      old_quantity = rows[0]?.quantity_on_hand ?? 0;
      await q(
        `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand, last_counted_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (material_id, warehouse_id, location_id)
         DO UPDATE SET quantity_on_hand = $3, last_counted_at = NOW()`,
        [material_id, warehouse_id, new_quantity],
      );
    } else {
      const { rows } = await q<{ quantity_on_hand: number }>(
        `SELECT quantity_on_hand FROM truck_stock WHERE material_id=$1 AND truck_id=$2`,
        [material_id, truck_id],
      );
      old_quantity = rows[0]?.quantity_on_hand ?? 0;
      await q(
        `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand, last_counted_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (material_id, truck_id)
         DO UPDATE SET quantity_on_hand = $3, last_counted_at = NOW()`,
        [material_id, truck_id, new_quantity],
      );
    }

    const delta = new_quantity - old_quantity;

    await q(
      `INSERT INTO material_movements
         (material_id, movement_type, quantity, performed_by,
          from_warehouse_id, from_truck_id, to_warehouse_id, to_truck_id, notes)
       VALUES ($1,'adjustment',$2,$3,$4,$5,$6,$7,$8)`,
      [
        material_id, Math.abs(delta), performed_by,
        delta < 0 ? warehouse_id ?? null : null,
        delta < 0 ? truck_id ?? null : null,
        delta > 0 ? warehouse_id ?? null : null,
        delta > 0 ? truck_id ?? null : null,
        notes,
      ],
    );

    return { old_quantity, new_quantity, delta };
  });
}

export async function submitCycleCount({
  warehouse_id, counts, performed_by,
}: {
  warehouse_id: string;
  counts: Array<{ material_id: string; counted_qty: number; notes?: string | null }>;
  performed_by: string | null;
}) {
  const results = [];
  for (const { material_id, counted_qty, notes } of counts) {
    const r = await adjustStock({
      material_id, warehouse_id,
      new_quantity: counted_qty,
      notes: notes || 'Cycle count',
      performed_by,
    });
    await query(
      `UPDATE warehouse_stock SET last_counted_at = NOW()
        WHERE material_id = $1 AND warehouse_id = $2`,
      [material_id, warehouse_id],
    );
    results.push({ material_id, ...r });
  }
  return results;
}
