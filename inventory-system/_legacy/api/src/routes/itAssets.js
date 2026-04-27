'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const itAssetService = require('../services/itAssetService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

const assetTypes   = ['ipad', 'iphone', 'android_phone', 'laptop', 'desktop', 'other'];
const assetStatuses= ['unassigned', 'assigned', 'out_for_repair', 'retired'];

// GET /api/v1/it-assets
router.get('/', async (req, res, next) => {
  try {
    const { asset_type, status, department, assigned_to } = req.query;
    const conditions = [];
    const params = [];

    if (asset_type)  { params.push(asset_type);  conditions.push(`a.asset_type = $${params.length}`); }
    if (status)      { params.push(status);       conditions.push(`a.status = $${params.length}`); }
    if (department)  { params.push(department);   conditions.push(`a.department = $${params.length}`); }
    if (assigned_to) { params.push(assigned_to);  conditions.push(`a.assigned_to = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT a.*,
              u.first_name || ' ' || u.last_name AS assigned_to_name,
              u.email AS assigned_to_email
         FROM it_assets a
         LEFT JOIN users u ON u.id = a.assigned_to
        ${where}
        ORDER BY a.asset_type, a.model`,
      params,
    );
    res.json({ assets: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/it-assets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [assetRes, histRes] = await Promise.all([
      query(
        `SELECT a.*, u.first_name || ' ' || u.last_name AS assigned_to_name
           FROM it_assets a
           LEFT JOIN users u ON u.id = a.assigned_to
          WHERE a.id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT h.*,
                a.first_name || ' ' || a.last_name AS assigned_to_name,
                b.first_name || ' ' || b.last_name AS assigned_by_name
           FROM it_asset_assignments h
           LEFT JOIN users a ON a.id = h.assigned_to
           LEFT JOIN users b ON b.id = h.assigned_by
          WHERE h.asset_id = $1
          ORDER BY h.assigned_at DESC`,
        [req.params.id],
      ),
    ]);
    if (!assetRes.rows[0]) return res.status(404).json({ error: 'IT asset not found' });
    res.json({ asset: assetRes.rows[0], history: histRes.rows });
  } catch (err) {
    next(err);
  }
});

const assetSchema = z.object({
  asset_type:     z.enum(assetTypes),
  manufacturer:   z.string().min(1),
  model:          z.string().min(1),
  serial_number:  z.string().min(1),
  imei:           z.string().optional(),
  udid:           z.string().optional(),
  asset_tag:      z.string().optional(),
  department:     z.enum(['plumbing', 'hvac', 'office']).optional(),
  purchase_date:  z.string().optional(),
  purchase_cost:  z.number().min(0).optional(),
  vendor:         z.string().optional(),
  warranty_expiry:z.string().optional(),
  mdm_enrolled:   z.boolean().optional(),
  carrier:        z.string().optional(),
  phone_number:   z.string().optional(),
  notes:          z.string().optional(),
});

// POST /api/v1/it-assets
router.post(
  '/',
  requireRole('admin', 'it_admin'),
  validate({ body: assetSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO it_assets
           (asset_type, manufacturer, model, serial_number, imei, udid, asset_tag,
            department, purchase_date, purchase_cost, vendor, warranty_expiry,
            mdm_enrolled, carrier, phone_number, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [b.asset_type, b.manufacturer, b.model, b.serial_number, b.imei, b.udid, b.asset_tag,
         b.department, b.purchase_date, b.purchase_cost, b.vendor, b.warranty_expiry,
         b.mdm_enrolled, b.carrier, b.phone_number, b.notes],
      );
      res.status(201).json({ asset: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/it-assets/:id
router.put(
  '/:id',
  requireRole('admin', 'it_admin'),
  validate({ body: assetSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE it_assets
            SET manufacturer    = COALESCE($1, manufacturer),
                model           = COALESCE($2, model),
                asset_tag       = COALESCE($3, asset_tag),
                warranty_expiry = COALESCE($4, warranty_expiry),
                mdm_enrolled    = COALESCE($5, mdm_enrolled),
                carrier         = COALESCE($6, carrier),
                phone_number    = COALESCE($7, phone_number),
                status          = COALESCE($8, status),
                notes           = COALESCE($9, notes),
                updated_at      = NOW()
          WHERE id = $10
          RETURNING *`,
        [b.manufacturer, b.model, b.asset_tag, b.warranty_expiry, b.mdm_enrolled,
         b.carrier, b.phone_number, b.status, b.notes, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'IT asset not found' });
      res.json({ asset: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/it-assets/:id/assign
router.post(
  '/:id/assign',
  requireRole('admin', 'it_admin'),
  validate({
    body: z.object({
      user_id: z.string().uuid(),
      notes:   z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const asset = await itAssetService.assign(req.params.id, req.body.user_id, req.user.id, req.body.notes);
      res.json({ asset });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/it-assets/:id/unassign
router.post(
  '/:id/unassign',
  requireRole('admin', 'it_admin'),
  validate({
    body: z.object({
      return_notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const asset = await itAssetService.unassign(req.params.id, req.user.id, req.body.return_notes);
      res.json({ asset });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
