'use strict';

/**
 * Bin Service
 *
 * scanBin — tech scans their bin at the warehouse.
 *   All pending bin_items are transferred to the tech's assigned truck.
 *   - Decrements warehouse_stock (releases reservation)
 *   - Increments truck_stock
 *   - Records bin_to_truck material_movements
 *   - Marks bin_items as scanned
 *   - Resets bin status to 'empty'
 */

const { transaction, query } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

async function scanBin(binId, scannedByUserId) {
  return transaction(async (client) => {
    // Fetch bin + tech's assigned truck
    const { rows: [bin] } = await client.query(
      `SELECT tb.*, u.assigned_truck_id, t.home_warehouse_id AS warehouse_id
         FROM tech_bins tb
         JOIN users u ON u.id = tb.technician_id
         LEFT JOIN trucks t ON t.id = u.assigned_truck_id
        WHERE tb.id = $1`,
      [binId],
    );

    if (!bin) throw new AppError('Bin not found', 404);
    if (!bin.assigned_truck_id) {
      throw new AppError('Technician has no truck assigned — cannot transfer bin contents', 400, 'NO_TRUCK');
    }

    // Get all unscanned items in this bin
    const { rows: items } = await client.query(
      `SELECT bi.*, rl.batch_id,
              rb.warehouse_id AS batch_warehouse_id
         FROM bin_items bi
         LEFT JOIN restock_lines rl ON rl.id = bi.restock_line_id
         LEFT JOIN restock_batches rb ON rb.id = rl.batch_id
        WHERE bi.bin_id = $1 AND bi.scanned_at IS NULL`,
      [binId],
    );

    if (items.length === 0) {
      return { message: 'Bin is empty — nothing to transfer', transferred: 0, bin };
    }

    const transferred = [];

    for (const item of items) {
      const sourceWarehouseId = item.batch_warehouse_id || bin.warehouse_id;

      // Release warehouse reservation + decrement stock
      await client.query(
        `UPDATE warehouse_stock
            SET quantity_on_hand  = GREATEST(0, quantity_on_hand  - $1),
                quantity_reserved = GREATEST(0, quantity_reserved - $1)
          WHERE material_id = $2 AND warehouse_id = $3`,
        [item.quantity, item.material_id, sourceWarehouseId],
      );

      // Add to truck stock
      await client.query(
        `INSERT INTO truck_stock (material_id, truck_id, quantity_on_hand)
         VALUES ($1,$2,$3)
         ON CONFLICT (material_id, truck_id)
         DO UPDATE SET quantity_on_hand = truck_stock.quantity_on_hand + $3`,
        [item.material_id, bin.assigned_truck_id, item.quantity],
      );

      // Record movement
      await client.query(
        `INSERT INTO material_movements
           (material_id, movement_type, quantity, performed_by,
            from_warehouse_id, from_bin_id, to_truck_id,
            restock_batch_id, restock_line_id)
         VALUES ($1,'bin_to_truck',$2,$3,$4,$5,$6,$7,$8)`,
        [item.material_id, item.quantity, scannedByUserId,
         sourceWarehouseId, binId, bin.assigned_truck_id,
         item.batch_id, item.restock_line_id],
      );

      // Mark bin_item as scanned
      await client.query(
        `UPDATE bin_items
            SET scanned_at          = NOW(),
                transferred_to_truck= $1
          WHERE id = $2`,
        [bin.assigned_truck_id, item.id],
      );

      transferred.push({ material_id: item.material_id, quantity: item.quantity });
    }

    // Reset bin status
    await client.query(
      `UPDATE tech_bins SET status = 'empty', updated_at = NOW() WHERE id = $1`,
      [binId],
    );

    return {
      message: `Transferred ${items.length} item type(s) to truck ${bin.assigned_truck_id}`,
      transferred: items.length,
      details: transferred,
    };
  });
}

/**
 * Place items into a bin (called during the picking workflow).
 * Creates bin_items and updates bin status.
 */
async function loadBin(binId, items, placedByUserId) {
  return transaction(async (client) => {
    const { rows: [bin] } = await client.query(
      `SELECT * FROM tech_bins WHERE id = $1`,
      [binId],
    );
    if (!bin) throw new AppError('Bin not found', 404);

    for (const { material_id, quantity, restock_line_id } of items) {
      await client.query(
        `INSERT INTO bin_items (bin_id, material_id, quantity, restock_line_id)
         VALUES ($1,$2,$3,$4)`,
        [binId, material_id, quantity, restock_line_id],
      );

      // Record movement: loaded_to_bin
      await client.query(
        `INSERT INTO material_movements
           (material_id, movement_type, quantity, performed_by,
            from_warehouse_id, to_bin_id, restock_line_id)
         VALUES ($1,'loaded_to_bin',$2,$3,$4,$5,$6)`,
        [material_id, quantity, placedByUserId,
         bin.warehouse_id, binId, restock_line_id],
      );
    }

    await client.query(
      `UPDATE tech_bins SET status = 'pending_scan', updated_at = NOW() WHERE id = $1`,
      [binId],
    );

    return { message: `${items.length} item type(s) loaded into bin`, bin_id: binId };
  });
}

module.exports = { scanBin, loadBin };
