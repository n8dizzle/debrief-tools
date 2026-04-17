'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

const supplyHouseSchema = z.object({
  name:             z.string().min(1),
  account_number:   z.string().optional(),
  contact_name:     z.string().optional(),
  contact_email:    z.string().email(),
  contact_phone:    z.string().optional(),
  department:       z.enum(['plumbing', 'hvac', 'office']).nullable().optional(),
  lead_time_days:   z.number().int().min(0).optional(),
  preferred_po_day: z.number().int().min(1).max(7).optional(),
  notes:            z.string().optional(),
  is_active:        z.boolean().optional(),
});

// GET /api/v1/supply-houses
router.get('/', async (req, res, next) => {
  try {
    const { department, is_active } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (department) { params.push(department); conditions.push(`(department = $${params.length} OR department IS NULL)`); }
    if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`is_active = $${params.length}`); }

    const { rows } = await query(
      `SELECT sh.*,
              (SELECT COUNT(*) FROM purchase_orders po WHERE po.supply_house_id = sh.id AND po.status NOT IN ('cancelled')) AS open_po_count
         FROM supply_houses sh
        WHERE ${conditions.join(' AND ')}
        ORDER BY sh.name`,
      params,
    );
    res.json({ supply_houses: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/supply-houses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM supply_houses WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Supply house not found' });
    res.json({ supply_house: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/supply-houses
router.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: supplyHouseSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO supply_houses (name, account_number, contact_name, contact_email, contact_phone, department, lead_time_days, preferred_po_day, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [b.name, b.account_number, b.contact_name, b.contact_email, b.contact_phone, b.department, b.lead_time_days, b.preferred_po_day, b.notes],
      );
      res.status(201).json({ supply_house: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/supply-houses/:id
router.put(
  '/:id',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: supplyHouseSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE supply_houses
            SET name             = COALESCE($1, name),
                account_number   = COALESCE($2, account_number),
                contact_name     = COALESCE($3, contact_name),
                contact_email    = COALESCE($4, contact_email),
                contact_phone    = COALESCE($5, contact_phone),
                department       = COALESCE($6, department),
                lead_time_days   = COALESCE($7, lead_time_days),
                preferred_po_day = COALESCE($8, preferred_po_day),
                notes            = COALESCE($9, notes),
                is_active        = COALESCE($10, is_active),
                updated_at       = NOW()
          WHERE id = $11
          RETURNING *`,
        [b.name, b.account_number, b.contact_name, b.contact_email, b.contact_phone,
         b.department, b.lead_time_days, b.preferred_po_day, b.notes, b.is_active, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Supply house not found' });
      res.json({ supply_house: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
