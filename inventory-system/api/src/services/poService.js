'use strict';

/**
 * Purchase Order Service
 *
 * createPO          — create a PO shell
 * addLine           — add a line item to a PO
 * updateLine        — update a line item
 * recalcTotals      — recalculate PO subtotal/total
 * generateWeeklyPOs — weekly scheduler logic: detect below-reorder materials and create POs
 * sendPO            — email PO PDF to supply house via SendGrid
 * receivePO         — receive items from supplier, update warehouse stock
 */

const sgMail = require('@sendgrid/mail');
const { transaction, query } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const env = require('../config/env');

sgMail.setApiKey(env.sendgrid.apiKey);

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePONumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `PO-${year}-${rand}`;
}

async function recalcTotals(poId) {
  await query(
    `UPDATE purchase_orders po
        SET subtotal   = COALESCE((SELECT SUM(line_total) FROM po_lines WHERE po_id = $1), 0),
            total      = COALESCE((SELECT SUM(line_total) FROM po_lines WHERE po_id = $1), 0),
            updated_at = NOW()
      WHERE id = $1`,
    [poId],
  );
}

// ── Create PO ────────────────────────────────────────────────────────────────

async function createPO({ supply_house_id, warehouse_id, department, trigger_type, created_by, notes, review_deadline }) {
  let poNumber;
  // Ensure unique PO number
  for (let attempts = 0; attempts < 10; attempts++) {
    poNumber = generatePONumber();
    const { rows } = await query(`SELECT id FROM purchase_orders WHERE po_number = $1`, [poNumber]);
    if (!rows[0]) break;
  }

  const deadline = review_deadline ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { rows: [po] } = await query(
    `INSERT INTO purchase_orders
       (po_number, supply_house_id, warehouse_id, department, trigger_type, status, review_deadline, created_by, notes)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8)
     RETURNING *`,
    [poNumber, supply_house_id, warehouse_id, department, trigger_type, deadline, created_by, notes],
  );

  return po;
}

// ── Add / update lines ───────────────────────────────────────────────────────

async function addLine(poId, { material_id, quantity_ordered, unit_cost, notes }) {
  // Fetch current material cost if not provided
  let cost = unit_cost;
  if (cost === undefined || cost === null) {
    const { rows } = await query(`SELECT unit_cost FROM materials WHERE id = $1`, [material_id]);
    cost = rows[0]?.unit_cost ?? 0;
  }

  const lineTotal = quantity_ordered * (cost ?? 0);

  const { rows: [line] } = await query(
    `INSERT INTO po_lines (po_id, material_id, quantity_ordered, unit_cost, line_total, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [poId, material_id, quantity_ordered, cost, lineTotal, notes],
  );

  await recalcTotals(poId);
  return line;
}

async function updateLine(lineId, { quantity_ordered, unit_cost, notes, backorder_routed_to }) {
  const { rows: [existing] } = await query(`SELECT * FROM po_lines WHERE id = $1`, [lineId]);
  if (!existing) throw new AppError('PO line not found', 404);

  const newQty  = quantity_ordered  ?? existing.quantity_ordered;
  const newCost = unit_cost         ?? existing.unit_cost;
  const newTotal = newQty * (newCost ?? 0);

  const { rows: [line] } = await query(
    `UPDATE po_lines
        SET quantity_ordered    = $1,
            unit_cost           = $2,
            line_total          = $3,
            notes               = COALESCE($4, notes),
            backorder_routed_to = COALESCE($5, backorder_routed_to),
            updated_at          = NOW()
      WHERE id = $6
      RETURNING *`,
    [newQty, newCost, newTotal, notes, backorder_routed_to, lineId],
  );

  await recalcTotals(line.po_id);
  return line;
}

// ── Send PO via email ────────────────────────────────────────────────────────

async function sendPO(poId, sentBy) {
  // Get PO details
  const { rows: [po] } = await query(
    `SELECT po.*, sh.contact_email, sh.name AS supply_house_name, sh.account_number,
            w.name AS warehouse_name
       FROM purchase_orders po
       JOIN supply_houses sh ON sh.id = po.supply_house_id
       JOIN warehouses w ON w.id = po.warehouse_id
      WHERE po.id = $1`,
    [poId],
  );

  if (!po) throw new AppError('PO not found', 404);
  if (!['draft', 'pending_review'].includes(po.status)) {
    throw new AppError(`PO cannot be sent in status: ${po.status}`, 400);
  }

  // Get PO lines
  const { rows: lines } = await query(
    `SELECT pl.*, m.name AS material_name, m.sku, m.unit_of_measure, m.barcode
       FROM po_lines pl
       JOIN materials m ON m.id = pl.material_id
      WHERE pl.po_id = $1
      ORDER BY m.name`,
    [poId],
  );

  if (lines.length === 0) throw new AppError('Cannot send PO with no line items', 400);

  // Build HTML email
  const linesHtml = lines.map((l) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd">${l.sku || ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${l.material_name}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${l.quantity_ordered}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${l.unit_of_measure || 'each'}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">$${Number(l.unit_cost ?? 0).toFixed(2)}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">$${Number(l.line_total ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto">
      <h2 style="color:#1a1a2e">Purchase Order: ${po.po_number}</h2>
      <table style="width:100%;margin-bottom:16px">
        <tr><td><strong>Date:</strong></td><td>${new Date().toLocaleDateString()}</td></tr>
        <tr><td><strong>Supplier:</strong></td><td>${po.supply_house_name} ${po.account_number ? `(Acct: ${po.account_number})` : ''}</td></tr>
        <tr><td><strong>Ship To:</strong></td><td>${po.warehouse_name}</td></tr>
        <tr><td><strong>Department:</strong></td><td>${po.department.toUpperCase()}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:8px;border:1px solid #ddd;text-align:left">SKU</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Item</th>
            <th style="padding:8px;border:1px solid #ddd">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">UoM</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right">Unit Price</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="padding:8px;border:1px solid #ddd;text-align:right"><strong>Total:</strong></td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right"><strong>$${Number(po.total ?? 0).toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      ${po.notes ? `<p style="margin-top:16px"><strong>Notes:</strong> ${po.notes}</p>` : ''}
    </div>
  `;

  const msg = {
    to:      po.contact_email,
    from:    { email: env.sendgrid.fromEmail, name: env.sendgrid.fromName },
    subject: `Purchase Order ${po.po_number} — ${po.warehouse_name}`,
    html:    htmlBody,
  };

  // Add internal CC
  if (env.sendgrid.managerEmail) {
    msg.cc = env.sendgrid.managerEmail;
  }

  await sgMail.send(msg);

  // Update PO status
  const { rows: [updated] } = await query(
    `UPDATE purchase_orders
        SET status     = 'sent',
            sent_at    = NOW(),
            reviewed_by= $1,
            updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
    [sentBy, poId],
  );

  return updated;
}

// ── Receive PO ───────────────────────────────────────────────────────────────

async function receivePO(poId, lineReceipts, receivedBy, notes) {
  return transaction(async (client) => {
    const { rows: [po] } = await client.query(
      `SELECT * FROM purchase_orders WHERE id = $1`,
      [poId],
    );
    if (!po) throw new AppError('PO not found', 404);
    if (!['sent', 'partially_received'].includes(po.status)) {
      throw new AppError(`PO cannot be received in status: ${po.status}`, 400);
    }

    const results = [];

    for (const { line_id, quantity_received } of lineReceipts) {
      const { rows: [line] } = await client.query(
        `UPDATE po_lines
            SET quantity_received = quantity_received + $1,
                updated_at        = NOW()
          WHERE id = $2 AND po_id = $3
          RETURNING *`,
        [quantity_received, line_id, poId],
      );

      if (!line) continue;

      // Add to warehouse stock
      if (quantity_received > 0) {
        await client.query(
          `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand)
           VALUES ($1, $2, $3)
           ON CONFLICT (material_id, warehouse_id, location_id)
           DO UPDATE SET quantity_on_hand = warehouse_stock.quantity_on_hand + $3`,
          [line.material_id, po.warehouse_id, quantity_received],
        );

        // Record movement
        await client.query(
          `INSERT INTO material_movements
             (material_id, movement_type, quantity, performed_by, to_warehouse_id, po_id, notes)
           VALUES ($1,'received',$2,$3,$4,$5,$6)`,
          [line.material_id, quantity_received, receivedBy, po.warehouse_id, poId, notes],
        );
      }

      results.push({ line_id, quantity_received, material_id: line.material_id });
    }

    // Determine new PO status
    const { rows: allLines } = await client.query(
      `SELECT quantity_ordered, quantity_received FROM po_lines WHERE po_id = $1`,
      [poId],
    );

    const fullyReceived = allLines.every((l) => l.quantity_received >= l.quantity_ordered);
    const anyReceived   = allLines.some((l) => l.quantity_received > 0);

    const newStatus = fullyReceived
      ? 'received'
      : anyReceived
        ? 'partially_received'
        : po.status;

    await client.query(
      `UPDATE purchase_orders
          SET status      = $1,
              received_at = CASE WHEN $1 = 'received' THEN NOW() ELSE received_at END,
              received_by = $2,
              notes       = COALESCE($3, notes),
              updated_at  = NOW()
        WHERE id = $4`,
      [newStatus, receivedBy, notes, poId],
    );

    return { status: newStatus, receipts: results };
  });
}

// ── Generate weekly POs (called by scheduler) ────────────────────────────────

async function generateWeeklyPOs() {
  // Find all materials below reorder_point per warehouse
  const { rows: lowStockItems } = await query(
    `SELECT ws.material_id, ws.warehouse_id, ws.quantity_on_hand,
            m.reorder_point, m.reorder_quantity, m.max_stock,
            m.primary_supply_house_id, m.department, m.unit_cost,
            m.name AS material_name
       FROM warehouse_stock ws
       JOIN materials m ON m.id = ws.material_id
                       AND m.is_active = TRUE
                       AND m.primary_supply_house_id IS NOT NULL
       JOIN warehouses w ON w.id = ws.warehouse_id AND w.status = 'active'
      WHERE ws.quantity_on_hand <= m.reorder_point
        AND m.reorder_quantity > 0`,
  );

  if (lowStockItems.length === 0) return { pos_created: 0, lines_added: 0 };

  // Group by warehouse + supply_house + department
  const groups = {};
  for (const item of lowStockItems) {
    const key = `${item.warehouse_id}::${item.primary_supply_house_id}::${item.department}`;
    if (!groups[key]) {
      groups[key] = {
        warehouse_id:    item.warehouse_id,
        supply_house_id: item.primary_supply_house_id,
        department:      item.department,
        items:           [],
      };
    }
    groups[key].items.push(item);
  }

  let posCreated = 0;
  let linesAdded = 0;

  for (const group of Object.values(groups)) {
    const po = await createPO({
      supply_house_id: group.supply_house_id,
      warehouse_id:    group.warehouse_id,
      department:      group.department,
      trigger_type:    'scheduled_weekly',
      created_by:      null,
      review_deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8-hour review window
    });

    for (const item of group.items) {
      // Order enough to reach max_stock, at minimum reorder_quantity
      const qty = item.max_stock
        ? Math.max(item.reorder_quantity, item.max_stock - item.quantity_on_hand)
        : item.reorder_quantity;

      if (qty > 0) {
        await addLine(po.id, {
          material_id:     item.material_id,
          quantity_ordered: qty,
          unit_cost:        item.unit_cost,
        });
        linesAdded++;
      }
    }

    posCreated++;
  }

  return { pos_created: posCreated, lines_added: linesAdded };
}

module.exports = { createPO, addLine, updateLine, recalcTotals, sendPO, receivePO, generateWeeklyPOs };
