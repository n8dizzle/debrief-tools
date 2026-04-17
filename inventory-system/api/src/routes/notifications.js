'use strict';

/**
 * /notifications — real-time inventory alerts derived from DB state.
 *
 * Generates notifications on-the-fly from:
 *   - Materials below reorder point (warning)
 *   - Restock batches awaiting approval (info)
 *   - Tools overdue for return (warning)
 *   - POs pending review (info)
 *   - Equipment warranties expiring within 90 days (warning)
 *
 * A simple in-process read store tracks which IDs the current user
 * has marked read (persists for process lifetime; good enough for now).
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// Per-user read sets (in-memory; resets on server restart)
const readSets = {};   // userId → Set<notifId>

function getReadSet(userId) {
  if (!readSets[userId]) readSets[userId] = new Set();
  return readSets[userId];
}

// Build a deterministic ID from the source so the same alert keeps the same ID
function notifId(type, refId) {
  return `${type}::${refId}`;
}

async function buildNotifications(userId) {
  const read = getReadSet(userId);
  const notifs = [];

  // 1. Materials below reorder point
  const { rows: lowStock } = await query(`
    SELECT m.id, m.name, ws.quantity_on_hand, m.reorder_point, w.name AS warehouse_name
      FROM warehouse_stock ws
      JOIN materials m ON m.id = ws.material_id AND m.is_active = TRUE
      JOIN warehouses w ON w.id = ws.warehouse_id
     WHERE ws.quantity_on_hand <= m.reorder_point
       AND m.reorder_point > 0
     ORDER BY ws.quantity_on_hand ASC
     LIMIT 10
  `);
  for (const row of lowStock) {
    const id = notifId('low_stock', row.id);
    notifs.push({
      id,
      severity:   row.quantity_on_hand === 0 ? 'critical' : 'warning',
      title:      row.quantity_on_hand === 0 ? 'Out of Stock' : 'Low Stock',
      message:    `${row.name} — ${row.quantity_on_hand} remaining at ${row.warehouse_name} (reorder at ${row.reorder_point})`,
      link:       `/materials/${row.id}`,
      link_label: 'View material',
      read:       read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  // 2. Restock batches needing attention (locked = awaiting approval)
  const { rows: batches } = await query(`
    SELECT rb.id, rb.batch_number, rb.status,
           t.truck_number, w.name AS warehouse_name,
           COUNT(rl.id) AS line_count
      FROM restock_batches rb
      JOIN trucks t ON t.id = rb.truck_id
      JOIN warehouses w ON w.id = rb.warehouse_id
      LEFT JOIN restock_lines rl ON rl.batch_id = rb.id
     WHERE rb.status IN ('locked','approved')
     GROUP BY rb.id, t.truck_number, w.name
     ORDER BY rb.created_at DESC
     LIMIT 5
  `);
  for (const b of batches) {
    const id = notifId('restock_batch', b.id);
    notifs.push({
      id,
      severity:   b.status === 'locked' ? 'warning' : 'info',
      title:      b.status === 'locked' ? 'Batch Awaiting Approval' : 'Batch Ready to Pick',
      message:    `${b.batch_number} — Truck ${b.truck_number} · ${b.warehouse_name} · ${b.line_count} line(s)`,
      link:       `/restock-queue/${b.id}`,
      link_label: 'Review batch',
      read:       read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  // 3. Tools overdue for return
  const { rows: overdueTools } = await query(`
    SELECT t.id, t.name, t.expected_return_date,
           u.first_name || ' ' || u.last_name AS checked_out_to_name
      FROM tools t
      LEFT JOIN users u ON u.id = t.checked_out_to
     WHERE t.status = 'checked_out'
       AND t.expected_return_date IS NOT NULL
       AND t.expected_return_date < CURRENT_DATE
     ORDER BY t.expected_return_date ASC
     LIMIT 5
  `);
  for (const t of overdueTools) {
    const id = notifId('overdue_tool', t.id);
    notifs.push({
      id,
      severity:   'warning',
      title:      'Tool Overdue',
      message:    `${t.name} was due back ${t.expected_return_date}${t.checked_out_to_name ? ` (${t.checked_out_to_name})` : ''}`,
      link:       `/tools/${t.id}`,
      link_label: 'View tool',
      read:       read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  // 4. Purchase orders pending review
  const { rows: pendingPOs } = await query(`
    SELECT po.id, po.po_number, po.review_deadline, sh.name AS supply_house_name
      FROM purchase_orders po
      LEFT JOIN supply_houses sh ON sh.id = po.supply_house_id
     WHERE po.status = 'pending_review'
     ORDER BY po.review_deadline ASC
     LIMIT 5
  `);
  for (const po of pendingPOs) {
    const id = notifId('pending_po', po.id);
    notifs.push({
      id,
      severity:   'info',
      title:      'PO Pending Review',
      message:    `${po.po_number}${po.supply_house_name ? ` — ${po.supply_house_name}` : ''} needs your review`,
      link:       `/purchase-orders/${po.id}`,
      link_label: 'Review PO',
      read:       read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  // Sort: critical → warning → info, unread first
  const order = { critical: 0, warning: 1, info: 2 };
  notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const unread = notifs.filter(n => !n.read).length;
  return { notifications: notifs, unread, total: notifs.length };
}

// GET /api/v1/notifications
router.get('/', async (req, res, next) => {
  try {
    const result = await buildNotifications(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/:id/read
router.post('/:id/read', (req, res) => {
  getReadSet(req.user.id).add(req.params.id);
  res.json({ ok: true });
});

// POST /api/v1/notifications/read-all
router.post('/read-all', async (req, res, next) => {
  try {
    const { notifications } = await buildNotifications(req.user.id);
    const set = getReadSet(req.user.id);
    notifications.forEach(n => set.add(n.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
