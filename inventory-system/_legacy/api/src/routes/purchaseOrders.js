'use strict';

/**
 * Purchase Order routes
 *
 * GET    /api/v1/purchase-orders                         — list POs
 * GET    /api/v1/purchase-orders/:id                     — PO detail + lines
 * POST   /api/v1/purchase-orders                         — create manual/emergency PO
 * PUT    /api/v1/purchase-orders/:id                     — update PO header
 * POST   /api/v1/purchase-orders/:id/lines               — add line item
 * PATCH  /api/v1/purchase-orders/:id/lines/:lineId       — update line item
 * DELETE /api/v1/purchase-orders/:id/lines/:lineId       — remove line (draft only)
 * POST   /api/v1/purchase-orders/:id/send                — email PO to supply house
 * POST   /api/v1/purchase-orders/:id/receive             — bulk-receive entire PO
 * PATCH  /api/v1/purchase-orders/:id/lines/:lineId/receive  — receive individual line
 */

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const poService = require('../services/poService');
const { query } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const router = Router();
router.use(requireAuth);

// GET /api/v1/purchase-orders
router.get('/', async (req, res, next) => {
  try {
    const { status, department, warehouse_id, supply_house_id, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (status)         { params.push(status);         conditions.push(`po.status = $${params.length}`); }
    if (department)     { params.push(department);     conditions.push(`po.department = $${params.length}`); }
    if (warehouse_id)   { params.push(warehouse_id);   conditions.push(`po.warehouse_id = $${params.length}`); }
    if (supply_house_id){ params.push(supply_house_id);conditions.push(`po.supply_house_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(
      `SELECT po.*,
              sh.name AS supply_house_name,
              w.name  AS warehouse_name,
              COUNT(pl.id) AS line_count
         FROM purchase_orders po
         JOIN supply_houses sh ON sh.id = po.supply_house_id
         JOIN warehouses w ON w.id = po.warehouse_id
         LEFT JOIN po_lines pl ON pl.po_id = po.id
        ${where}
        GROUP BY po.id, sh.name, w.name
        ORDER BY po.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ purchase_orders: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchase-orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [poRes, linesRes] = await Promise.all([
      query(
        `SELECT po.*, sh.name AS supply_house_name, sh.contact_email,
                w.name AS warehouse_name
           FROM purchase_orders po
           JOIN supply_houses sh ON sh.id = po.supply_house_id
           JOIN warehouses w ON w.id = po.warehouse_id
          WHERE po.id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT pl.*, m.name AS material_name, m.sku, m.unit_of_measure, m.barcode,
                bs.name AS backorder_supply_house_name
           FROM po_lines pl
           JOIN materials m ON m.id = pl.material_id
           LEFT JOIN supply_houses bs ON bs.id = pl.backorder_routed_to
          WHERE pl.po_id = $1
          ORDER BY m.category, m.name`,
        [req.params.id],
      ),
    ]);

    if (!poRes.rows[0]) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ purchase_order: poRes.rows[0], lines: linesRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchase-orders  — manual / emergency PO
router.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  validate({
    body: z.object({
      supply_house_id: z.string().uuid(),
      warehouse_id:    z.string().uuid(),
      department:      z.enum(['plumbing', 'hvac', 'office']),
      trigger_type:    z.enum(['scheduled_weekly', 'manual_emergency']),
      notes:           z.string().optional(),
      review_deadline: z.string().datetime().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const po = await poService.createPO({ ...req.body, created_by: req.user.id });
      res.status(201).json({ purchase_order: po });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/purchase-orders/:id/lines
router.post(
  '/:id/lines',
  requireRole('admin', 'warehouse_manager'),
  validate({
    body: z.object({
      material_id:    z.string().uuid(),
      quantity_ordered:z.number().positive(),
      unit_cost:      z.number().min(0).optional(),
      notes:          z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const line = await poService.addLine(req.params.id, req.body);
      res.status(201).json({ line });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/purchase-orders/:id/lines/:lineId
router.patch(
  '/:id/lines/:lineId',
  requireRole('admin', 'warehouse_manager'),
  validate({
    body: z.object({
      quantity_ordered:  z.number().positive().optional(),
      unit_cost:         z.number().min(0).optional(),
      notes:             z.string().optional(),
      backorder_routed_to: z.string().uuid().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const line = await poService.updateLine(req.params.lineId, req.body);
      res.json({ line });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/purchase-orders/:id/lines/:lineId
router.delete('/:id/lines/:lineId', requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    // Only allowed on draft POs
    const { rows } = await query(`SELECT status FROM purchase_orders WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'PO not found' });
    if (rows[0].status !== 'draft') throw new AppError('Lines can only be deleted from draft POs', 400);
    await query(`DELETE FROM po_lines WHERE id = $1 AND po_id = $2`, [req.params.lineId, req.params.id]);
    await poService.recalcTotals(req.params.id);
    res.json({ message: 'Line removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchase-orders/:id/send
router.post('/:id/send', requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const po = await poService.sendPO(req.params.id, req.user.id);
    res.json({ message: 'Purchase order sent', purchase_order: po });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/purchase-orders/:id/receive  — bulk receive
router.post(
  '/:id/receive',
  requireRole('admin', 'warehouse_manager', 'warehouse_staff'),
  validate({
    body: z.object({
      lines: z.array(z.object({
        line_id:           z.string().uuid(),
        quantity_received: z.number().min(0),
      })).min(1),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const result = await poService.receivePO(req.params.id, req.body.lines, req.user.id, req.body.notes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
