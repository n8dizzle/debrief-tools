'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const toolService = require('../services/toolService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/tools
router.get('/', async (req, res, next) => {
  try {
    const { department, status, category, warehouse_id } = req.query;
    const conditions = [];
    const params = [];

    if (department)  { params.push(department);  conditions.push(`t.department = $${params.length}`); }
    if (status)      { params.push(status);       conditions.push(`t.status = $${params.length}`); }
    if (category)    { params.push(category);     conditions.push(`t.category = $${params.length}`); }
    if (warehouse_id){ params.push(warehouse_id); conditions.push(`t.home_warehouse_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT t.*,
              w.name AS home_warehouse_name,
              u.first_name || ' ' || u.last_name AS checked_out_to_name,
              tr.truck_number AS checked_out_truck_number
         FROM tools t
         JOIN warehouses w ON w.id = t.home_warehouse_id
         LEFT JOIN users u ON u.id = t.checked_out_to
         LEFT JOIN trucks tr ON tr.id = t.checked_out_truck
        ${where}
        ORDER BY t.category, t.name`,
      params,
    );
    res.json({ tools: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tools/by-barcode/:barcode
router.get('/by-barcode/:barcode', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*, w.name AS home_warehouse_name,
              u.first_name || ' ' || u.last_name AS checked_out_to_name
         FROM tools t
         JOIN warehouses w ON w.id = t.home_warehouse_id
         LEFT JOIN users u ON u.id = t.checked_out_to
        WHERE t.barcode = $1`,
      [req.params.barcode],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tool not found for barcode' });
    res.json({ tool: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tools/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [toolRes, histRes] = await Promise.all([
      query(
        `SELECT t.*, w.name AS home_warehouse_name,
                u.first_name || ' ' || u.last_name AS checked_out_to_name,
                tr.truck_number AS checked_out_truck_number
           FROM tools t
           JOIN warehouses w ON w.id = t.home_warehouse_id
           LEFT JOIN users u ON u.id = t.checked_out_to
           LEFT JOIN trucks tr ON tr.id = t.checked_out_truck
          WHERE t.id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT tm.*,
                u.first_name || ' ' || u.last_name AS performed_by_name,
                tech.first_name || ' ' || tech.last_name AS technician_name,
                tr.truck_number
           FROM tool_movements tm
           LEFT JOIN users u ON u.id = tm.performed_by
           LEFT JOIN users tech ON tech.id = tm.technician_id
           LEFT JOIN trucks tr ON tr.id = tm.truck_id
          WHERE tm.tool_id = $1
          ORDER BY tm.created_at DESC
          LIMIT 50`,
        [req.params.id],
      ),
    ]);

    if (!toolRes.rows[0]) return res.status(404).json({ error: 'Tool not found' });
    res.json({ tool: toolRes.rows[0], history: histRes.rows });
  } catch (err) {
    next(err);
  }
});

const toolSchema = z.object({
  name:              z.string().min(1),
  manufacturer:      z.string().min(1),
  model:             z.string().min(1),
  serial_number:     z.string().min(1),
  barcode:           z.string().min(1),
  department:        z.enum(['plumbing', 'hvac', 'office']),
  home_warehouse_id: z.string().uuid(),
  category:          z.string().optional(),
  purchase_date:     z.string().optional(),
  purchase_cost:     z.number().min(0).optional(),
  warranty_expiry:   z.string().optional(),
  notes:             z.string().optional(),
});

// POST /api/v1/tools
router.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: toolSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO tools (name, manufacturer, model, serial_number, barcode, department, home_warehouse_id, category, purchase_date, purchase_cost, warranty_expiry, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [b.name, b.manufacturer, b.model, b.serial_number, b.barcode, b.department,
         b.home_warehouse_id, b.category, b.purchase_date, b.purchase_cost, b.warranty_expiry, b.notes],
      );
      res.status(201).json({ tool: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/tools/:id
router.put(
  '/:id',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: toolSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE tools
            SET name             = COALESCE($1, name),
                category         = COALESCE($2, category),
                purchase_date    = COALESCE($3, purchase_date),
                purchase_cost    = COALESCE($4, purchase_cost),
                warranty_expiry  = COALESCE($5, warranty_expiry),
                current_condition= COALESCE($6, current_condition),
                status           = COALESCE($7, status),
                notes            = COALESCE($8, notes),
                updated_at       = NOW()
          WHERE id = $9
          RETURNING *`,
        [b.name, b.category, b.purchase_date, b.purchase_cost, b.warranty_expiry,
         b.current_condition, b.status, b.notes, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Tool not found' });
      res.json({ tool: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/tools/:id/checkout
router.post(
  '/:id/checkout',
  validate({
    body: z.object({
      technician_id: z.string().uuid(),
      truck_id:      z.string().uuid().optional(),
      st_job_id:     z.string().optional(),
      condition:     z.enum(['good', 'needs_service', 'damaged']).optional(),
      notes:         z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tool = await toolService.checkout(req.params.id, req.body, req.user.id);
      res.json({ tool });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/tools/:id/checkin
router.post(
  '/:id/checkin',
  validate({
    body: z.object({
      condition: z.enum(['good', 'needs_service', 'damaged']).optional(),
      notes:     z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tool = await toolService.checkin(req.params.id, req.body, req.user.id);
      res.json({ tool });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/tools/:id/send-for-service
router.post('/:id/send-for-service', requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const tool = await toolService.sendForService(req.params.id, req.body, req.user.id);
    res.json({ tool });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
