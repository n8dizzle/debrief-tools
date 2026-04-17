'use strict';

/**
 * Restock Batch workflow routes
 *
 * The full lifecycle:
 *   collecting → locked → approved → picked → completed (or partially_completed)
 *
 * GET    /api/v1/restock-batches                        — list (filterable)
 * GET    /api/v1/restock-batches/:id                    — single batch + lines
 * POST   /api/v1/restock-batches/:id/lock               — manual lock
 * POST   /api/v1/restock-batches/:id/lines              — add a line to collecting batch
 * PATCH  /api/v1/restock-batches/:id/lines/:lineId      — approve / deny a line
 * POST   /api/v1/restock-batches/:id/approve            — approve entire batch (bulk)
 * POST   /api/v1/restock-batches/:id/pick               — mark batch as picked (warehouse staff)
 * POST   /api/v1/restock-batches/:id/complete           — complete batch
 */

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const restockService = require('../services/restockService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// ────────────────────────────────────────────────
// List batches
// ────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, truck_id, warehouse_id, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (status)       { params.push(status);       conditions.push(`rb.status = $${params.length}`); }
    if (truck_id)     { params.push(truck_id);     conditions.push(`rb.truck_id = $${params.length}`); }
    if (warehouse_id) { params.push(warehouse_id); conditions.push(`rb.warehouse_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

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
    res.json({ batches: rows });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Get single batch with all lines
// ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const [batchRes, linesRes] = await Promise.all([
      query(
        `SELECT rb.*, t.truck_number, w.name AS warehouse_name
           FROM restock_batches rb
           JOIN trucks t ON t.id = rb.truck_id
           JOIN warehouses w ON w.id = rb.warehouse_id
          WHERE rb.id = $1`,
        [req.params.id],
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
        [req.params.id],
      ),
    ]);

    if (!batchRes.rows[0]) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch: batchRes.rows[0], lines: linesRes.rows });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Manual lock
// ────────────────────────────────────────────────
router.post('/:id/lock', requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const batch = await restockService.lockBatch(req.params.id, req.user.id, 'manual');
    res.json({ message: 'Batch locked', batch });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Add a line to a collecting batch
// ────────────────────────────────────────────────
router.post(
  '/:id/lines',
  validate({
    body: z.object({
      material_id:       z.string().uuid(),
      quantity_requested:z.number().positive(),
      st_job_id:         z.string().min(1),
      st_work_order_id:  z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const line = await restockService.addLine(req.params.id, req.body);
      res.status(201).json({ line });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────
// Approve / deny a single line
// ────────────────────────────────────────────────
router.patch(
  '/:id/lines/:lineId',
  requireRole('admin', 'warehouse_manager'),
  validate({
    body: z.object({
      status:           z.enum(['approved', 'denied']),
      quantity_approved:z.number().positive().optional(),
      denial_reason:    z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const line = await restockService.updateLine(req.params.lineId, req.body);
      res.json({ line });
    } catch (err) {
      next(err);
    }
  },
);

// ────────────────────────────────────────────────
// Bulk-approve entire batch
// ────────────────────────────────────────────────
router.post('/:id/approve', requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const batch = await restockService.approveBatch(req.params.id, req.user.id);
    res.json({ message: 'Batch approved', batch });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Mark batch as picked (warehouse staff starts pulling)
// ────────────────────────────────────────────────
router.post('/:id/pick', requireRole('admin', 'warehouse_manager', 'warehouse_staff'), async (req, res, next) => {
  try {
    const batch = await restockService.startPicking(req.params.id, req.user.id);
    res.json({ message: 'Picking started', batch });
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Complete batch (all items loaded to bin / truck)
// ────────────────────────────────────────────────
router.post('/:id/complete', requireRole('admin', 'warehouse_manager', 'warehouse_staff'), async (req, res, next) => {
  try {
    const batch = await restockService.completeBatch(req.params.id, req.user.id);
    res.json({ message: 'Batch completed', batch });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
