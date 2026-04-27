import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface RestockBatch {
  id: string;
  truck_id: string;
  warehouse_id: string;
  status: string;
  [k: string]: unknown;
}

export interface RestockLine {
  id: string;
  batch_id: string;
  material_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  status: string;
  [k: string]: unknown;
}

export async function listBatches(filter: {
  status?: string | null;
  truckId?: string | null;
  warehouseId?: string | null;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status) { params.push(filter.status); conditions.push(`rb.status = $${params.length}`); }
  if (filter.truckId) { params.push(filter.truckId); conditions.push(`rb.truck_id = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`rb.warehouse_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);

  const { rows } = await query(
    `SELECT rb.*,
            t.truck_number,
            w.name AS warehouse_name,
            COUNT(rl.id) AS line_count,
            COUNT(rl.id) FILTER (WHERE rl.status = 'approved') AS approved_count,
            COUNT(rl.id) FILTER (WHERE rl.status = 'denied')   AS denied_count,
            COUNT(rl.id) FILTER (WHERE rl.status = 'pending')  AS pending_count
       FROM restock_batches rb
       JOIN trucks t ON t.id = rb.truck_id
       JOIN warehouses w ON w.id = rb.warehouse_id
       LEFT JOIN restock_lines rl ON rl.batch_id = rb.id
      ${where}
      GROUP BY rb.id, t.truck_number, w.name
      ORDER BY rb.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getBatch(id: string) {
  const [batchRes, linesRes] = await Promise.all([
    query<RestockBatch & { truck_number: string; warehouse_name: string }>(
      `SELECT rb.*, t.truck_number, w.name AS warehouse_name
         FROM restock_batches rb
         JOIN trucks t ON t.id = rb.truck_id
         JOIN warehouses w ON w.id = rb.warehouse_id
        WHERE rb.id = $1`,
      [id],
    ),
    query(
      `SELECT rl.*, m.name AS material_name, m.sku, m.unit_of_measure, m.unit_cost,
              ws.quantity_on_hand AS warehouse_qty_on_hand,
              ts.quantity_on_hand AS truck_qty_on_hand
         FROM restock_lines rl
         JOIN materials m ON m.id = rl.material_id
         JOIN restock_batches rb ON rb.id = rl.batch_id
         LEFT JOIN warehouse_stock ws ON ws.material_id = rl.material_id AND ws.warehouse_id = rb.warehouse_id
         LEFT JOIN truck_stock ts ON ts.material_id = rl.material_id AND ts.truck_id = rb.truck_id
        WHERE rl.batch_id = $1
        ORDER BY m.category, m.name`,
      [id],
    ),
  ]);
  if (!batchRes.rows[0]) throw new AppError('Batch not found', 404);
  return { batch: batchRes.rows[0], lines: linesRes.rows };
}

export async function lockBatch(batchId: string, lockedBy: string | null = null, trigger = 'manual') {
  const { rows } = await query<RestockBatch>(
    `UPDATE restock_batches
        SET status = 'locked', locked_at = NOW(), locked_by = $1, lock_trigger = $2, updated_at = NOW()
      WHERE id = $3 AND status = 'collecting'
      RETURNING *`,
    [lockedBy, trigger, batchId],
  );
  if (!rows[0]) throw new AppError('Batch not found or not in collecting status', 400, 'BATCH_NOT_COLLECTING');
  return rows[0];
}

export async function lockAllCollectingBatches(trigger = 'scheduled') {
  const { rows } = await query<{ id: string; truck_id: string; warehouse_id: string }>(
    `UPDATE restock_batches
        SET status = 'locked', locked_at = NOW(), lock_trigger = $1, updated_at = NOW()
      WHERE status = 'collecting'
      RETURNING id, truck_id, warehouse_id`,
    [trigger],
  );
  return rows;
}

export interface AddLineInput {
  material_id: string;
  quantity_requested: number;
  st_job_id: string;
  st_work_order_id?: string | null;
}

export async function addLine(batchId: string, data: AddLineInput) {
  return transaction(async (q) => {
    const { rows: batchRows } = await q<RestockBatch>(`SELECT * FROM restock_batches WHERE id = $1`, [batchId]);
    const batch = batchRows[0];
    if (!batch) throw new AppError('Batch not found', 404);
    if (batch.status !== 'collecting') {
      throw new AppError(`Cannot add lines to a batch in '${batch.status}' status`, 400, 'BATCH_NOT_COLLECTING');
    }
    const { rows } = await q<RestockLine>(
      `INSERT INTO restock_lines (batch_id, material_id, quantity_requested, st_job_id, st_work_order_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [batchId, data.material_id, data.quantity_requested, data.st_job_id, data.st_work_order_id ?? null],
    );
    return rows[0];
  });
}

export interface UpdateLineInput {
  status: 'approved' | 'denied';
  quantity_approved?: number;
  denial_reason?: string;
}

export async function updateLine(lineId: string, data: UpdateLineInput) {
  if (data.status === 'approved' && !data.quantity_approved) {
    throw new AppError('quantity_approved is required when approving a line', 400);
  }
  if (data.status === 'denied' && !data.denial_reason) {
    throw new AppError('denial_reason is required when denying a line', 400);
  }

  const { rows } = await query<RestockLine>(
    `UPDATE restock_lines
        SET status = $1, quantity_approved = COALESCE($2, quantity_approved),
            denial_reason = COALESCE($3, denial_reason), updated_at = NOW()
      WHERE id = $4 RETURNING *`,
    [data.status, data.quantity_approved ?? null, data.denial_reason ?? null, lineId],
  );
  if (!rows[0]) throw new AppError('Restock line not found', 404);
  const line = rows[0];

  if (data.status === 'approved' && data.quantity_approved) {
    const { rows: bRows } = await query<{ warehouse_id: string }>(
      `SELECT warehouse_id FROM restock_batches WHERE id = $1`,
      [line.batch_id],
    );
    if (bRows[0]) {
      await query(
        `UPDATE warehouse_stock
            SET quantity_reserved = quantity_reserved + $1
          WHERE material_id = $2 AND warehouse_id = $3`,
        [data.quantity_approved, line.material_id, bRows[0].warehouse_id],
      );
    }
  }

  return line;
}

export async function approveBatch(batchId: string, approvedBy: string) {
  return transaction(async (q) => {
    const { rows: bRows } = await q<RestockBatch>(`SELECT * FROM restock_batches WHERE id = $1`, [batchId]);
    const batch = bRows[0];
    if (!batch) throw new AppError('Batch not found', 404);
    if (batch.status !== 'locked') {
      throw new AppError(`Batch must be locked before approval (current: ${batch.status})`, 400, 'BATCH_NOT_LOCKED');
    }

    const { rows: approvedLines } = await q<RestockLine>(
      `UPDATE restock_lines
          SET status = 'approved', quantity_approved = quantity_requested, updated_at = NOW()
        WHERE batch_id = $1 AND status = 'pending'
        RETURNING *`,
      [batchId],
    );

    for (const line of approvedLines) {
      await q(
        `UPDATE warehouse_stock
            SET quantity_reserved = quantity_reserved + $1
          WHERE material_id = $2 AND warehouse_id = $3`,
        [line.quantity_approved, line.material_id, batch.warehouse_id],
      );
    }

    const { rows: updRows } = await q<RestockBatch>(
      `UPDATE restock_batches
          SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [approvedBy, batchId],
    );
    return updRows[0];
  });
}

export async function startPicking(batchId: string, pickedBy: string) {
  const { rows } = await query<RestockBatch>(
    `UPDATE restock_batches
        SET status = 'picked', picked_at = NOW(), picked_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'approved'
      RETURNING *`,
    [pickedBy, batchId],
  );
  if (!rows[0]) throw new AppError('Batch not found or not in approved status', 400);
  return rows[0];
}

export async function completeBatch(batchId: string, _completedBy: string) {
  void _completedBy;
  return transaction(async (q) => {
    const { rows: bRows } = await q<RestockBatch>(
      `SELECT * FROM restock_batches WHERE id = $1 AND status = 'picked'`,
      [batchId],
    );
    if (!bRows[0]) throw new AppError('Batch not found or not in picked status', 400);

    const { rows: lines } = await q<RestockLine & { is_short?: boolean }>(
      `SELECT * FROM restock_lines WHERE batch_id = $1 AND status = 'approved'`,
      [batchId],
    );
    const allFilled = lines.every((l) => !l.is_short);
    const newStatus = allFilled ? 'completed' : 'partially_completed';

    const { rows: updRows } = await q<RestockBatch>(
      `UPDATE restock_batches SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, batchId],
    );
    return updRows[0];
  });
}
