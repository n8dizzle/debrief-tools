'use strict';

/**
 * /settings — system configuration read/write + admin triggers.
 *
 * Settings are stored as rows in a key/value table (app_settings).
 * Sections: company, servicetitan, notifications, inventory
 *
 * GET  /api/v1/settings        — all settings grouped by section
 * PATCH /api/v1/settings       — update one section
 * POST /api/v1/settings/st-sync-now — trigger an immediate ST sync
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');
const env = require('../config/env');

const router = Router();
router.use(requireAuth);

// Default settings shape returned when the table is empty
const DEFAULTS = {
  company: {
    name:    'Davis Plumbing & AC',
    email:   'ray@christmasair.com',
    phone:   '972-555-0100',
    address: '1200 Lakeside Pkwy, Lewisville TX 75057',
  },
  servicetitan: {
    tenant_id:         env.st?.tenantId  || '',
    sync_frequency:    'every_4_hours',
    auto_sync_enabled: false,
    last_sync_at:      null,
  },
  notifications: {
    email_alerts_enabled: true,
    low_stock_threshold:  1.0,   // multiplier of reorder_point
    manager_email:        env.sendgrid?.managerEmail || '',
  },
  inventory: {
    default_department:     'plumbing',
    reorder_lead_days:       3,
    auto_lock_batches:       true,
    auto_lock_hour:          6,
    weekly_po_enabled:       true,
    weekly_po_day:          'monday',
  },
};

async function loadSettings() {
  try {
    const { rows } = await query(`SELECT section, key, value FROM app_settings ORDER BY section, key`);
    const result = JSON.parse(JSON.stringify(DEFAULTS)); // deep clone defaults
    for (const row of rows) {
      if (!result[row.section]) result[row.section] = {};
      try { result[row.section][row.key] = JSON.parse(row.value); }
      catch { result[row.section][row.key] = row.value; }
    }
    return result;
  } catch {
    // app_settings table might not exist yet — return defaults
    return DEFAULTS;
  }
}

// GET /api/v1/settings
router.get('/', async (req, res, next) => {
  try {
    const settings = await loadSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/settings  { section: 'company', data: { name: '...' } }
router.patch('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { section, data } = req.body;
    if (!section || !data || typeof data !== 'object') {
      return res.status(400).json({ error: 'section and data are required' });
    }

    // Upsert each key in the section
    for (const [key, value] of Object.entries(data)) {
      await query(
        `INSERT INTO app_settings (section, key, value)
         VALUES ($1, $2, $3::text)
         ON CONFLICT (section, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [section, key, JSON.stringify(value)],
      );
    }

    const settings = await loadSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/settings/st-sync-now
router.post('/st-sync-now', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    // If ST is not configured, return a friendly message
    const stConfigured = env.st?.clientId && env.st.clientId !== 'placeholder';
    if (!stConfigured) {
      return res.json({
        ok: true,
        message: 'ServiceTitan credentials not configured — sync skipped.',
        synced: 0,
      });
    }

    // Dynamically load ST service to avoid crash on startup when creds missing
    const stService = require('../services/stService');
    const result = await stService.syncAll();
    res.json({ ok: true, message: 'ST sync triggered', result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
