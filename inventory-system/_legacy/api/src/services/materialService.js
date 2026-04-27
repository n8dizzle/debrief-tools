'use strict';

/**
 * Material Service
 *
 * Handles all inventory movement recording, stock adjustments, and cycle counts.
 * All stock mutations are transactional and write to material_movements for audit.
 */

const { transaction, query } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const restockService = require('./restockService');

/**
 * Record a material movement and update stock tables accordingly.
 *
 * Handles:
 *  received          → to_warehouse_id stock increases
 *  transferred       → from_warehouse → to_warehouse (or truck)
 *  loaded_to_bin     → warehouse stock reserved, bin_items created
 *  bin_to_truck      → bin cleared, truck stock increases
 *  consumed_on_job   → truck stock decreases, restock line auto-created
 *  returned_to_stock → truck/job → warehouse stock increases
 *  adjustment        → direct stock override (use adjustStock() instead)
 *  cycle_count       → reconcile via submitCycleCount() instead
 */
async function recordMovement(data) {
  return transaction(async (client) => {
    const {
      material_id, movement_type, quantity, performed_by,
      from_warehouse_id, from_truck_id, from_bin_id,
      to_warehouse_id, to_truck_id, to_bin_id,
      st_job_id, st_work_order_id, notes,
      restock_batch_id, restock_line_id, po_id,
    } = data;

    // ── Insert movement record ──────────────────────────────────────────
    const { rows: [movement] } = await client.query(
      `INSERT INTO material_movements
         (material_id, movement_type, quantity, performed_by,
          from_warehouse_id, from_truck_id, from_bin_id,
          to_warehouse_id,   to_truck_id,   to_bin_id,
          st_job_id, st_work_order_id, notes, restock_batch_id, restock_line_id, po_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [material_id, movement_type, quantity, performed_by,
       from_warehouse_id, from_truck_id, from_bin_id,
       to_warehouse_id, to_truck_id, to_bin_id,
       st_job_id, st_work_order_id, notes, restock_batch_id, restock_line_id, po_id],
    );

    // ── Update stock tables ─────────────────────────────────────────────
    switch (movement_type) {
      case 'received':
        await upsertWarehouseStock(client, material_id, to_warehouse_id, quantity);
        break;

      case 'transferred':
        if (from_warehouse_id) await adjustWarehouseStock(client, material_id, from_warehouse_id, -quantity);
        if (from_truck_id)     await adjustTruckStock(client, material_id, from_truck_id, -quantity);
        if (to_warehouse_id)   await upsertWarehouseStock(client, material_id, to_warehouse_id, quantity);
        if (to_truck_id)       await upsertTruckStock(client, material_id, to_truck_id, quantity);
        break;

      case 'loaded_to_bin':
        // Warehouse stock reserved (not yet decremented — decremented when bin scanned)
        if (from_warehouse_id) {
          await client.query(
            `UPDATE warehouse_stock
                SET quantity_reserved = quantity_reserved + $1
              WHERE material_id = $2 AND warehouse_id = $3`,
            [quantity, material_id, from_warehouse_id],
          );
        }
        break;

      case 'bin_to_truck':
        // Clear reservation from warehouse, decrement, add to truck
        if (from_warehouse_id) {
          await client.query(
            `UPDATE warehouse_stock
                SET quantity_on_hand  = quantity_on_hand  - $1,
                    quantity_reserved = quantity_reserved - $1
              WHERE material_id = $2 AND warehouse_id = $3`,
            [quantity, material_id, from_warehouse_id],
          );
        }
        if (to_truck_id) await upsertTruckStock(client, material_id, to_truck_id, quantity);
        break;

      case 'consumed_on_job':
        // Decrement truck stock
        if (from_truck_id) await adjustTruckStock(client, material_id, from_truck_id, -quantity);
        // Auto-create restock line (do this outside transaction callback to avoid nesting)
        break;

      case 'returned_to_stock':
        if (from_truck_id)   await adjustTruckStock(client, material_id, from_truck_id, -quantity);
        if (to_warehouse_id) await upsertWarehouseStock(client, material_id, to_warehouse_id, quantity);
        break;

      default:
        break;
    }

    return movement;
  }).then(async (movement) => {
    // Post-transaction: auto-create restock line for consumed_on_job
    if (movement.movement_type === 'consumed_on_job' && movement.from_truck_id && movement.st_job_id) {
      try {
        await restockService.autoCreateRestockLine({
          truck_id:          movement.from_truck_id,
          material_id:       movement.material_id,
          quantity_requested:movement.quantity,
          st_job_id:         movement.st_job_id,
          st_work_order_id:  movement.st_work_order_id,
        });
      } catch (err) {
        // Log but don't fail the movement — restock line can be added manually
        console.warn('Failed to auto-create restock line:', err.message);
      }
    }
    return movement;
  });
}

// ── Stock helpers ───────────────────────────────────────────────────────────

async function upsertWarehouseStock(client, materialId, warehouseId, delta) {
  await client.query(
    `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand)
     VALUES ($1, $2, $3)
     ON CONFLICT (material_id, warehouse_id, location_id)
     DO UPDATE SET quantity_on_hand = warehouse_stock.quantity_on_hand + $3,
                   last_counted_at  = CASE WHEN $3 = 0 THEN NOW() ELSE warehouse_stock.last_counted_at END`,
    [materialId, warehouseId, delta],
  );
}

async function adjustWarehouseStock(client, materialId, warehouseId, delta) {
  const { rows } = await client.query(
    `UPDATE warehouse_stock
        SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1)
      WHERE material_id = $2 AND warehouse_id = $3
      RETURNING quantity_on_hand`,
    [delta, materialId, warehouseId],
  );
  if (!rows[0]) throw new AppError(`No warehouse stock record for material ${materialId}`, 400);
  return rows[0].quantity_on_hand;
}

async function upsertTruckStock(client, materialId, truckId, delta) {
  await client.query(
    `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
     VALUES ($1, $2, $3)
     ON CONFLICT (material_id, truck_id)
     DO UPDATE SET quantity_on_hand = GREATEST(0, truck_stock.quantity_on_hand + $3)`,
    [materialId, truckId, delta],
  );
}

async function adjustTruckStock(client, materialId, truckId, delta) {
  const { rows } = await client.query(
    `UPDATE truck_stock
        SET quantity_on_hand = GREATEST(0, quantity_on_hand + $1)
      WHERE material_id = $2 AND truck_id = $3
      RETURNING quantity_on_hand`,
    [delta, materialId, truckId],
  );
  // If no row, it's a new usage — upsert with 0 floor
  if (!rows[0]) {
    await client.query(
      `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
       VALUES ($1, $2, GREATEST(0, $3))
       ON CONFLICT DO NOTHING`,
      [materialId, truckId, delta],
    );
  }
}

// ── Public: manual adjustment ───────────────────────────────────────────────

async function adjustStock({ material_id, warehouse_id, truck_id, new_quantity, notes, performed_by }) {
  return transaction(async (client) => {
    let old_quantity;

    if (warehouse_id) {
      const { rows } = await client.query(
        `SELECT quantity_on_hand FROM warehouse_stock WHERE material_id=$1 AND warehouse_id=$2`,
        [material_id, warehouse_id],
      );
      old_quantity = rows[0]?.quantity_on_hand ?? 0;
      await client.query(
        `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand, last_counted_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (material_id, warehouse_id, location_id)
         DO UPDATE SET quantity_on_hand = $3, last_counted_at = NOW()`,
        [material_id, warehouse_id, new_quantity],
      );
    } else {
      const { rows } = await client.query(
        `SELECT quantity_on_hand FROM truck_stock WHERE material_id=$1 AND truck_id=$2`,
        [material_id, truck_id],
      );
      old_quantity = rows[0]?.quantity_on_hand ?? 0;
      await client.query(
        `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand, last_counted_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (material_id, truck_id)
         DO UPDATE SET quantity_on_hand = $3, last_counted_at = NOW()`,
        [material_id, truck_id, new_quantity],
      );
    }

    const delta = new_quantity - old_quantity;

    // Log movement
    await client.query(
      `INSERT INTO material_movements
         (material_id, movement_type, quantity, performed_by,
          from_warehouse_id, from_truck_id, to_warehouse_id, to_truck_id, notes)
       VALUES ($1,'adjustment',$2,$3,$4,$5,$6,$7,$8)`,
      [material_id, Math.abs(delta), performed_by,
       delta < 0 ? warehouse_id : null, delta < 0 ? truck_id : null,
       delta > 0 ? warehouse_id : null, delta > 0 ? truck_id : null,
       notes],
    );

    return { old_quantity, new_quantity, delta };
  });
}

// ── Cycle count ─────────────────────────────────────────────────────────────

async function submitCycleCount({ warehouse_id, counts, performed_by }) {
  const results = [];

  for (const { material_id, counted_qty, notes } of counts) {
    const result = await adjustStock({
      material_id, warehouse_id,
      new_quantity: counted_qty,
      notes: notes || 'Cycle count',
      performed_by,
    });

    // Also mark last_counted_at
    await query(
      `UPDATE warehouse_stock SET last_counted_at = NOW()
        WHERE material_id = $1 AND warehouse_id = $2`,
      [material_id, warehouse_id],
    );

    results.push({ material_id, ...result });
  }

  return results;
}

module.exports = { recordMovement, adjustStock, submitCycleCount };
