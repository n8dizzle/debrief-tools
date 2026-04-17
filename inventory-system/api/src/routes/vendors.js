'use strict';

/**
 * /vendors — compatibility alias for /supply-houses.
 *
 * The frontend calls /vendors; the real data lives in supply_houses.
 * This route maps to the same table and normalises field names so the
 * frontend receives the shape it expects (lead_days, contact, email).
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// Shape a supply_house row into what the frontend expects
function toVendor(row) {
  return {
    id:         row.id,
    name:       row.name,
    contact:    row.contact_name,
    email:      row.contact_email,
    phone:      row.contact_phone,
    department: row.department,
    lead_days:  row.lead_time_days,
    account_number: row.account_number,
    is_active:  row.is_active,
  };
}

// GET /api/v1/vendors?department=plumbing
router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    const params = [];
    const conditions = ['is_active = TRUE'];

    if (department) {
      params.push(department);
      conditions.push(`(department = $${params.length} OR department = 'all')`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await query(
      `SELECT * FROM supply_houses ${where} ORDER BY name`,
      params,
    );

    res.json({ vendors: rows.map(toVendor) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM supply_houses WHERE id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: toVendor(rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
