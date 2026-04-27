'use strict';

/**
 * Restock Service
 *
 * Manages the full restock batch lifecycle:
 *   collecting → locked → approved → picked → completed
 *
 * Also handles auto-creation of restock lines when materials are
 * consumed on a job (triggered by materialService.recordMovement).
 */

const { transaction, query } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// ── Open batch helpers ───────────────────────────────────────────────────────

/**
 * Find the current 'collecting' batch for a truck, or create one.
 */
async function getOrCreateCollectingBatch(client, truckId) {
  const { rows } = await client.query(
    `SELECT rb.*, w.id AS wh_id
       FROM restock_batches rb
       JOIN trucks t ON t.id = rb.truck_id
       JOIN warehouses w ON w.id = t.home_warehouse_id
      WHERE rb.truck_id = $1 AND rb.status = 'collecting'
      ORDER BY rb.created_at DESC
      LIMIT 1`,
    [truckId],
  );

  if (rows[0]) return rows[0];

  // Create new collecting batch
  // Determine home warehouse from truck
  const { rows: truckRows } = await client.query(
    `SELECT home_warehouse_id FROM trucks WHERE id = $1`,
    [truckId],
  );
  if (!truckRows[0]) throw new AppError('Truck not found', 404);

  const { rows: [newBatch] } = await client.query(
    `INSERT INTO restock_batches (truck_id, warehouse_id, status)
     VALUES ($1, $2, 'collecting')
     RETURNING *`,
    [truckId, truckRows[0].home_warehouse_id],
  );

  return newBatch;
}

// ── Auto-create restock line (called after consumed_on_job movement) ─────────

async function autoCreateRestockLine({ truck_id, material_id, quantity_requested, st_job_id, st_work_order_id }) {
  return transaction(async (client) => {
    const batch = await getOrCreateCollectingBatch(client, truck_id);

    // Check if a line for this material + job already exists in this batch
    const { rows: existing } = await client.query(
      `SELECT id, quantity_requested FROM restock_lines
        WHERE batch_id = $1 AND material_id = $2 AND st_job_id = $3`,
      [batch.id, material_id, st_job_id],
    );

    if (existing[0]) {
      // Accumulate quantity
      const { rows: [updated] } = await client.query(
        `UPDATE restock_lines
            SET quantity_requested = quantity_requested + $1,
                updated_at = NOW()
          WHERE id = $2
          RETURNING *`,
        [quantity_requested, existing[0].id],
      );
      return updated;
    }

    const { rows: [line] } = await client.query(
      `INSERT INTO restock_lines (batch_id, material_id, quantity_requested, st_job_id, st_work_order_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [batch.id, material_id, quantity_requested, st_job_id, st_work_order_id],
    );

    return line;
  });
}

// ── Manual line addition ────────────────────────────────────────────────────

async function addLine(batchId, data) {
  return transaction(async (client) => {
    const { rows: [batch] } = await client.query(
      `SELECT * FROM restock_batches WHERE id = $1`,
      [batchId],
    );
    if (!batch) throw new AppError('Batch not found', 404);
    if (batch.status !== 'collecting') {
      throw new AppError(`Cannot add lines to a batch in '${batch.status}' status`, 400, 'BATCH_NOT_COLLECTING');
    }

    const { rows: [line] } = await client.query(
      `INSERT INTO restock_lines (batch_id, material_id, quantity_requested, st_job_id, st_work_order_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [batchId, data.material_id, data.quantity_requested, data.st_job_id, data.st_work_order_id],
    );

    return line;
  });
}

// ── Lock a batch ────────────────────────────────────────────────────────────

async function lockBatch(batchId, lockedBy = null, trigger = 'manual') {
  const { rows: [batch] } = await query(
    `UPDATE restock_batches
        SET status       = 'locked',
            locked_at    = NOW(),
            locked_by    = $1,
            lock_trigger = $2,
            updated_at   = NOW()
      WHERE id = $3 AND status = 'collecting'
      RETURNING *`,
    [lockedBy, trigger, batchId],
  );

  if (!batch) throw new AppError('Batch not found or not in collecting status', 400, 'BATCH_NOT_COLLECTING');
  return batch;
}

/**
 * Lock ALL currently-collecting batches. Called by the 6 AM scheduler.
 * Returns counts of locked batches.
 */
async function lockAllCollectingBatches(trigger = 'scheduled') {
  const { rows } = await query(
    `UPDATE restock_batches
        SET status       = 'locked',
            locked_at    = NOW(),
            lock_trigger = $1,
            updated_at   = NOW()
      WHERE status = 'collecting'
      RETURNING id, truck_id, warehouse_id`,
    [trigger],
  );
  return rows;
}

// ── Update a single line (approve/deny) ─────────────────────────────────────

async function updateLine(lineId, data) {
  const { status, quantity_approved, denial_reason } = data;

  // Validate
  if (status === 'approved' && !quantity_approved) {
    throw new AppError('quantity_approved is required when approving a line', 400);
  }
  if (status === 'denied' && !denial_reason) {
    throw new AppError('denial_reason is required when denying a line', 400);
  }

  const { rows: [line] } = await query(
    `UPDATE restock_lines
        SET status            = $1,
            quantity_approved = COALESCE($2, quantity_approved),
            denial_reason     = COALESCE($3, denial_reason),
            updated_at        = NOW()
      WHERE id = $4
      RETURNING *`,
    [status, quantity_approved, denial_reason, lineId],
  );

  if (!line) throw new AppError('Restock line not found', 404);

  // Reserve warehouse stock when line is approved
  if (status === 'approved') {
    const { rows: [batch] } = await query(
      `SELECT warehouse_id FROM restock_batches WHERE id = $1`,
      [line.batch_id],
    );
    if (batch) {
      await query(
        `UPDATE warehouse_stock
            SET quantity_reserved = quantity_reserved + $1
          WHERE material_id = $2 AND warehouse_id = $3`,
        [quantity_approved, line.material_id, batch.warehouse_id],
      );
    }
  }

  return line;
}

// ── Approve entire batch (bulk approve all pending lines) ───────────────────

async function approveBatch(batchId, approvedBy) {
  return transaction(async (client) => {
    const { rows: [batch] } = await client.query(
      `SELECT * FROM restock_batches WHERE id = $1`,
      [batchId],
    );
    if (!batch) throw new AppError('Batch not found', 404);
    if (batch.status !== 'locked') {
      throw new AppError(`Batch must be locked before approval (current: ${batch.status})`, 400, 'BATCH_NOT_LOCKED');
    }

    // Bulk-approve pending lines at requested quantity
    const { rows: approvedLines } = await client.query(
      `UPDATE restock_lines
          SET status            = 'approved',
              quantity_approved = quantity_requested,
              updated_at        = NOW()
        WHERE batch_id = $1 AND status = 'pending'
        RETURNING *`,
      [batchId],
    );

    // Reserve stock for newly-approved lines
    for (const line of approvedLines) {
      await client.query(
        `UPDATE warehouse_stock
            SET quantity_reserved = quantity_reserved + $1
          WHERE material_id = $2 AND warehouse_id = $3`,
        [line.quantity_approved, line.material_id, batch.warehouse_id],
      );
    }

    // Advance batch status
    const { rows: [updated] } = await client.query(
      `UPDATE restock_batches
          SET status      = 'approved',
              approved_at = NOW(),
              approved_by = $1,
              updated_at  = NOW()
        WHERE id = $2
        RETURNING *`,
      [approvedBy, batchId],
    );

    return updated;
  });
}

// ── Start picking ────────────────────────────────────────────────────────────

async function startPicking(batchId, pickedBy) {
  const { rows: [batch] } = await query(
    `UPDATE restock_batches
        SET status    = 'picked',
            picked_at = NOW(),
            picked_by = $1,
            updated_at = NOW()
      WHERE id = $2 AND status = 'approved'
      RETURNING *`,
    [pickedBy, batchId],
  );
  if (!batch) throw new AppError('Batch not found or not in approved status', 400);
  return batch;
}

// ── Complete batch ───────────────────────────────────────────────────────────

async function completeBatch(batchId, completedBy) {
  return transaction(async (client) => {
    const { rows: [batch] } = await client.query(
      `SELECT rb.*, rb.warehouse_id
         FROM restock_batches rb
        WHERE id = $1 AND status = 'picked'`,
      [batchId],
    );
    if (!batch) throw new AppError('Batch not found or not in picked status', 400);

    // Check if any approved lines are still short
    const { rows: lines } = await client.query(
      `SELECT * FROM restock_lines WHERE batch_id = $1 AND status = 'approved'`,
      [batchId],
    );

    // Determine if partial
    const allFilled = lines.every((l) => !l.is_short);
    const newStatus = allFilled ? 'completed' : 'partially_completed';

    const { rows: [updated] } = await client.query(
      `UPDATE restock_batches
          SET status       = $1,
              completed_at = NOW(),
              updated_at   = NOW()
        WHERE id = $2
        RETURNING *`,
      [newStatus, batchId],
    );

    return updated;
  });
}

module.exports = {
  autoCreateRestockLine,
  addLine,
  lockBatch,
  lockAllCollectingBatches,
  updateLine,
  approveBatch,
  startPicking,
  completeBatch,
};
