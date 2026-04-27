import 'server-only';
import { transaction } from '../db';
import { AppError } from '../errors';

/** Auto-create or accumulate a restock line when a material is consumed on a job.
 *  Pulled out into its own module to break the circular dep between
 *  material-movements and restock-batches. */
export async function autoCreateRestockLine(opts: {
  truck_id: string;
  material_id: string;
  quantity_requested: number;
  st_job_id: string;
  st_work_order_id?: string | null;
}) {
  return transaction(async (q) => {
    // Find or create a 'collecting' batch for the truck
    const { rows: batchRows } = await q<{ id: string; warehouse_id: string }>(
      `SELECT rb.id, rb.warehouse_id
         FROM restock_batches rb
        WHERE rb.truck_id = $1 AND rb.status = 'collecting'
        ORDER BY rb.created_at DESC
        LIMIT 1`,
      [opts.truck_id],
    );

    let batchId = batchRows[0]?.id;

    if (!batchId) {
      const { rows: tRows } = await q<{ home_warehouse_id: string }>(
        `SELECT home_warehouse_id FROM trucks WHERE id = $1`,
        [opts.truck_id],
      );
      if (!tRows[0]) throw new AppError('Truck not found', 404);

      const { rows: nRows } = await q<{ id: string }>(
        `INSERT INTO restock_batches (truck_id, warehouse_id, status)
         VALUES ($1, $2, 'collecting') RETURNING id`,
        [opts.truck_id, tRows[0].home_warehouse_id],
      );
      batchId = nRows[0].id;
    }

    // Accumulate if a line for this material+job already exists
    const { rows: existing } = await q<{ id: string }>(
      `SELECT id FROM restock_lines
        WHERE batch_id = $1 AND material_id = $2 AND st_job_id = $3`,
      [batchId, opts.material_id, opts.st_job_id],
    );

    if (existing[0]) {
      const { rows } = await q(
        `UPDATE restock_lines
            SET quantity_requested = quantity_requested + $1, updated_at = NOW()
          WHERE id = $2 RETURNING *`,
        [opts.quantity_requested, existing[0].id],
      );
      return rows[0];
    }

    const { rows } = await q(
      `INSERT INTO restock_lines (batch_id, material_id, quantity_requested, st_job_id, st_work_order_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [batchId, opts.material_id, opts.quantity_requested, opts.st_job_id, opts.st_work_order_id ?? null],
    );
    return rows[0];
  });
}
