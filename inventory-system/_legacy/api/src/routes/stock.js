'use strict';

/**
 * Stock & Movements routes
 *
 * POST /api/v1/stock/movements      — record any material movement
 * GET  /api/v1/stock/movements      — movement history (filterable)
 * GET  /api/v1/stock/warehouse/:id  — warehouse stock summary
 * POST /api/v1/stock/adjust         — manual inventory adjustment
 * POST /api/v1/stock/cycle-count    — submit cycle count results
 */

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const materialService = require('../services/materialService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// ────────────────────────────────────────────────
// Movement history
// ────────────────────────────────────────────────
router.get('/movements', async (req, res, next) => {
  try {
    const { material_id, truck_id, warehouse_id, movement_type, st_job_id, limit = 100, offset = 0 } = req.query;

    const conditions = [];
    const params = [];

    if (material_id)    { params.push(material_id);    conditions.push(`mm.material_id = $${params.length}`); }
    if (truck_id)       { params.push(truck_id);       conditions.push(`(mm.from_truck_id = $${params.length} OR mm.to_truck_id = $${params.length})`); }
    if (warehouse_id)   { params.push(warehouse_id);   conditions.push(`(mm.from_warehouse_id = $${params.length} OR mm.to_warehouse_id = $${params.length})`); }
    if (movement_type)  { params.push(movement_type);  conditions.push(`mm.movement_type = $${params.length}`); }
    if (st_job_id)      { params.push(st_job_id);      conditions.push(`mm.st_job_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

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
    res.json({ movements: rows });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Record a material movement
// ────────────────────────────────────────────────
const movementSchema = z.object({
  material_id:       z.string().uuid(),
  movement_type:     z.enum([
    'received', 'transferred', 'loaded_to_bin', 'bin_to_truck',
    'consumed_on_job', 'returned_to_stock', 'adjustment', 'cycle_count',
  ]),
  quantity:          z.number().positive(),
  from_warehouse_id: z.string().uuid().optional(),
  from_truck_id:     z.string().uuid().optional(),
  from_bin_id:       z.string().uuid().optional(),
  to_warehouse_id:   z.string().uuid().optional(),
  to_truck_id:       z.string().uuid().optional(),
  to_bin_id:         z.string().uuid().optional(),
  st_job_id:         z.string().optional(),
  st_work_order_id:  z.string().optional(),
  notes:             z.string().optional(),
});

router.post(
  '/movements',
  validate({ body: movementSchema }),
  async (req, res, next) => {
    try {
      const movement = await materialService.recordMovement({
        ...req.body,
        performed_by: req.user.id,
      });
      res.status(201).json({ movement });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────
// Warehouse stock view
// ────────────────────────────────────────────────
router.get('/warehouse/:warehouseId', async (req, res, next) => {
  try {
    const { category, below_reorder } = req.query;
    const conditions = [`ws.warehouse_id = $1`];
    const params = [req.params.warehouseId];

    if (category) { params.push(category); conditions.push(`m.category = $${params.length}`); }

    const havingClause = below_reorder === 'true'
      ? 'HAVING ws.quantity_on_hand <= m.reorder_point'
      : '';

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
    res.json({ stock: rows });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Manual adjustment
// ────────────────────────────────────────────────
router.post(
  '/adjust',
  requireRole('admin', 'manager'),
  validate({
    body: z.object({
      material_id:    z.string().uuid(),
      warehouse_id:   z.string().uuid().optional(),
      truck_id:       z.string().uuid().optional(),
      new_quantity:   z.number().min(0),
      notes:          z.string().min(1),
    }).refine((d) => d.warehouse_id || d.truck_id, {
      message: 'Either warehouse_id or truck_id is required',
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await materialService.adjustStock({
        ...req.body,
        performed_by: req.user.id,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────
// Cycle count (physical count reconciliation)
// ────────────────────────────────────────────────
router.post(
  '/cycle-count',
  requireRole('admin', 'manager', 'tech'),
  validate({
    body: z.object({
      warehouse_id: z.string().uuid(),
      counts: z.array(z.object({
        material_id:   z.string().uuid(),
        counted_qty:   z.number().min(0),
        notes:         z.string().optional(),
      })).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const results = await materialService.submitCycleCount({
        warehouse_id: req.body.warehouse_id,
        counts: req.body.counts,
        performed_by: req.user.id,
      });
      res.json({ message: `Cycle count processed`, results });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────
// Transfer stock between warehouse ↔ truck
// ────────────────────────────────────────────────
router.post(
  '/transfer',
  validate({
    body: z.object({
      material_id: z.string().uuid(),
      from_type:   z.enum(['warehouse', 'truck']),
      from_id:     z.string().uuid(),
      to_type:     z.enum(['warehouse', 'truck']),
      to_id:       z.string().uuid(),
      quantity:    z.number().positive(),
      notes:       z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { material_id, from_type, from_id, to_type, to_id, quantity, notes } = req.body;

      if (from_type === to_type && from_id === to_id) {
        return res.status(400).json({ error: 'Source and destination cannot be the same.' });
      }

      // Resolve source / destination names for the response
      let fromName, toName;
      if (from_type === 'warehouse') {
        const { rows } = await query(`SELECT name FROM warehouses WHERE id = $1`, [from_id]);
        if (!rows[0]) return res.status(404).json({ error: 'Source warehouse not found.' });
        fromName = rows[0].name;
      } else {
        const { rows } = await query(`SELECT truck_number FROM trucks WHERE id = $1`, [from_id]);
        if (!rows[0]) return res.status(404).json({ error: 'Source truck not found.' });
        fromName = `Truck ${rows[0].truck_number}`;
      }

      if (to_type === 'warehouse') {
        const { rows } = await query(`SELECT name FROM warehouses WHERE id = $1`, [to_id]);
        if (!rows[0]) return res.status(404).json({ error: 'Destination warehouse not found.' });
        toName = rows[0].name;
      } else {
        const { rows } = await query(`SELECT truck_number FROM trucks WHERE id = $1`, [to_id]);
        if (!rows[0]) return res.status(404).json({ error: 'Destination truck not found.' });
        toName = `Truck ${rows[0].truck_number}`;
      }

      // Check source has sufficient stock
      if (from_type === 'warehouse') {
        const { rows } = await query(
          `SELECT quantity_on_hand FROM warehouse_stock WHERE material_id = $1 AND warehouse_id = $2`,
          [material_id, from_id],
        );
        const avail = rows[0]?.quantity_on_hand ?? 0;
        if (avail < quantity) {
          return res.status(400).json({ error: `Insufficient stock — ${avail} available at ${fromName}.` });
        }
      } else {
        const { rows } = await query(
          `SELECT quantity_on_hand FROM truck_stock WHERE material_id = $1 AND truck_id = $2`,
          [material_id, from_id],
        );
        const avail = rows[0]?.quantity_on_hand ?? 0;
        if (avail < quantity) {
          return res.status(400).json({ error: `Insufficient stock — ${avail} available on ${fromName}.` });
        }
      }

      // Get material name for response
      const matRes = await query(`SELECT name, sku FROM materials WHERE id = $1`, [material_id]);
      if (!matRes.rows[0]) return res.status(404).json({ error: 'Material not found.' });
      const material = matRes.rows[0];

      // Record the movement — materialService.recordMovement handles stock ledger updates
      const movement = await materialService.recordMovement({
        material_id,
        movement_type: 'transferred',
        quantity,
        from_warehouse_id: from_type === 'warehouse' ? from_id : undefined,
        from_truck_id:     from_type === 'truck'      ? from_id : undefined,
        to_warehouse_id:   to_type   === 'warehouse' ? to_id   : undefined,
        to_truck_id:       to_type   === 'truck'      ? to_id   : undefined,
        notes,
        performed_by: req.user.id,
      });

      res.status(201).json({
        transfer_id: movement.id,
        quantity,
        material: { id: material_id, name: material.name, sku: material.sku },
        from:     { id: from_id, type: from_type, name: fromName },
        to:       { id: to_id,   type: to_type,   name: toName },
        notes:    notes || null,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
