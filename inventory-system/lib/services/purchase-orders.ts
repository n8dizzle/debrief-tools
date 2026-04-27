import 'server-only';
import { query, transaction } from '../db';
import { AppError } from '../errors';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supply_house_id: string;
  warehouse_id: string;
  department: string;
  status: string;
  total: number | string | null;
  [k: string]: unknown;
}

export interface POLine {
  id: string;
  po_id: string;
  material_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number | string | null;
  line_total: number | string | null;
  [k: string]: unknown;
}

function generatePONumber(): string {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `PO-${year}-${rand}`;
}

export async function recalcTotals(poId: string) {
  await query(
    `UPDATE purchase_orders po
        SET subtotal   = COALESCE((SELECT SUM(line_total) FROM po_lines WHERE po_id = $1), 0),
            total      = COALESCE((SELECT SUM(line_total) FROM po_lines WHERE po_id = $1), 0),
            updated_at = NOW()
      WHERE id = $1`,
    [poId],
  );
}

export async function listPurchaseOrders(filter: {
  status?: string | null;
  department?: string | null;
  warehouseId?: string | null;
  supplyHouseId?: string | null;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.status) { params.push(filter.status); conditions.push(`po.status = $${params.length}`); }
  if (filter.department) { params.push(filter.department); conditions.push(`po.department = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`po.warehouse_id = $${params.length}`); }
  if (filter.supplyHouseId) { params.push(filter.supplyHouseId); conditions.push(`po.supply_house_id = $${params.length}`); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(filter.limit ?? 50);
  params.push(filter.offset ?? 0);

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
  return rows;
}

export async function getPurchaseOrder(id: string) {
  const [poRes, linesRes] = await Promise.all([
    query<PurchaseOrder>(
      `SELECT po.*, sh.name AS supply_house_name, sh.contact_email,
              w.name AS warehouse_name
         FROM purchase_orders po
         JOIN supply_houses sh ON sh.id = po.supply_house_id
         JOIN warehouses w ON w.id = po.warehouse_id
        WHERE po.id = $1`,
      [id],
    ),
    query(
      `SELECT pl.*, m.name AS material_name, m.sku, m.unit_of_measure, m.barcode,
              bs.name AS backorder_supply_house_name
         FROM po_lines pl
         JOIN materials m ON m.id = pl.material_id
         LEFT JOIN supply_houses bs ON bs.id = pl.backorder_routed_to
        WHERE pl.po_id = $1
        ORDER BY m.category, m.name`,
      [id],
    ),
  ]);
  if (!poRes.rows[0]) throw new AppError('Purchase order not found', 404);
  return { purchase_order: poRes.rows[0], lines: linesRes.rows };
}

export interface CreatePOInput {
  supply_house_id: string;
  warehouse_id: string;
  department: string;
  trigger_type: string;
  notes?: string | null;
  review_deadline?: string | null;
  created_by?: string | null;
}

export async function createPO(b: CreatePOInput): Promise<PurchaseOrder> {
  let poNumber = '';
  for (let i = 0; i < 10; i++) {
    poNumber = generatePONumber();
    const { rows } = await query(`SELECT id FROM purchase_orders WHERE po_number = $1`, [poNumber]);
    if (!rows[0]) break;
  }
  const deadline = b.review_deadline ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { rows } = await query<PurchaseOrder>(
    `INSERT INTO purchase_orders
       (po_number, supply_house_id, warehouse_id, department, trigger_type, status, review_deadline, created_by, notes)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8) RETURNING *`,
    [poNumber, b.supply_house_id, b.warehouse_id, b.department, b.trigger_type, deadline, b.created_by ?? null, b.notes ?? null],
  );
  return rows[0];
}

export async function addPOLine(poId: string, b: { material_id: string; quantity_ordered: number; unit_cost?: number | null; notes?: string | null }) {
  let cost = b.unit_cost;
  if (cost === undefined || cost === null) {
    const { rows } = await query<{ unit_cost: number | string | null }>(`SELECT unit_cost FROM materials WHERE id = $1`, [b.material_id]);
    cost = (rows[0]?.unit_cost as number | null) ?? 0;
  }
  const lineTotal = b.quantity_ordered * (cost ?? 0);

  const { rows } = await query<POLine>(
    `INSERT INTO po_lines (po_id, material_id, quantity_ordered, unit_cost, line_total, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [poId, b.material_id, b.quantity_ordered, cost, lineTotal, b.notes ?? null],
  );
  await recalcTotals(poId);
  return rows[0];
}

export async function updatePOLine(lineId: string, b: { quantity_ordered?: number; unit_cost?: number | null; notes?: string | null; backorder_routed_to?: string | null }) {
  const { rows: existing } = await query<POLine>(`SELECT * FROM po_lines WHERE id = $1`, [lineId]);
  if (!existing[0]) throw new AppError('PO line not found', 404);

  const newQty = b.quantity_ordered ?? existing[0].quantity_ordered;
  const newCost = (b.unit_cost ?? existing[0].unit_cost) as number | null;
  const newTotal = newQty * (newCost ?? 0);

  const { rows } = await query<POLine>(
    `UPDATE po_lines
        SET quantity_ordered = $1, unit_cost = $2, line_total = $3,
            notes = COALESCE($4, notes),
            backorder_routed_to = COALESCE($5, backorder_routed_to),
            updated_at = NOW()
      WHERE id = $6 RETURNING *`,
    [newQty, newCost, newTotal, b.notes ?? null, b.backorder_routed_to ?? null, lineId],
  );
  await recalcTotals(rows[0].po_id);
  return rows[0];
}

export async function deletePOLine(poId: string, lineId: string) {
  const { rows } = await query<{ status: string }>(`SELECT status FROM purchase_orders WHERE id = $1`, [poId]);
  if (!rows[0]) throw new AppError('PO not found', 404);
  if (rows[0].status !== 'draft') throw new AppError('Lines can only be deleted from draft POs', 400);
  await query(`DELETE FROM po_lines WHERE id = $1 AND po_id = $2`, [lineId, poId]);
  await recalcTotals(poId);
}

/** Mark PO as 'sent'. Email delivery is intentionally a no-op in Next.js;
 *  we'll plug Resend or SendGrid in a later phase. */
export async function sendPO(poId: string, sentBy: string) {
  const { rows: poRows } = await query<PurchaseOrder>(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
  if (!poRows[0]) throw new AppError('PO not found', 404);
  if (!['draft', 'pending_review'].includes(poRows[0].status)) {
    throw new AppError(`PO cannot be sent in status: ${poRows[0].status}`, 400);
  }
  const { rows: lines } = await query(`SELECT id FROM po_lines WHERE po_id = $1`, [poId]);
  if (lines.length === 0) throw new AppError('Cannot send PO with no line items', 400);

  const { rows } = await query<PurchaseOrder>(
    `UPDATE purchase_orders
        SET status = 'sent', sent_at = NOW(), reviewed_by = $1, updated_at = NOW()
      WHERE id = $2 RETURNING *`,
    [sentBy, poId],
  );
  return rows[0];
}

export async function receivePO(
  poId: string,
  lineReceipts: Array<{ line_id: string; quantity_received: number }>,
  receivedBy: string,
  notes?: string | null,
) {
  return transaction(async (q) => {
    const { rows: poRows } = await q<PurchaseOrder>(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
    const po = poRows[0];
    if (!po) throw new AppError('PO not found', 404);
    if (!['sent', 'partially_received'].includes(po.status)) {
      throw new AppError(`PO cannot be received in status: ${po.status}`, 400);
    }

    const results: Array<{ line_id: string; quantity_received: number; material_id: string }> = [];

    for (const { line_id, quantity_received } of lineReceipts) {
      const { rows } = await q<POLine>(
        `UPDATE po_lines
            SET quantity_received = quantity_received + $1, updated_at = NOW()
          WHERE id = $2 AND po_id = $3 RETURNING *`,
        [quantity_received, line_id, poId],
      );
      const line = rows[0];
      if (!line) continue;

      if (quantity_received > 0) {
        await q(
          `INSERT INTO warehouse_stock (material_id, warehouse_id, quantity_on_hand)
           VALUES ($1,$2,$3)
           ON CONFLICT (material_id, warehouse_id, location_id)
           DO UPDATE SET quantity_on_hand = warehouse_stock.quantity_on_hand + $3`,
          [line.material_id, po.warehouse_id, quantity_received],
        );
        await q(
          `INSERT INTO material_movements
             (material_id, movement_type, quantity, performed_by, to_warehouse_id, po_id, notes)
           VALUES ($1,'received',$2,$3,$4,$5,$6)`,
          [line.material_id, quantity_received, receivedBy, po.warehouse_id, poId, notes ?? null],
        );
      }
      results.push({ line_id, quantity_received, material_id: line.material_id });
    }

    const { rows: allLines } = await q<{ quantity_ordered: number; quantity_received: number }>(
      `SELECT quantity_ordered, quantity_received FROM po_lines WHERE po_id = $1`,
      [poId],
    );
    const fullyReceived = allLines.every((l) => l.quantity_received >= l.quantity_ordered);
    const anyReceived = allLines.some((l) => l.quantity_received > 0);
    const newStatus = fullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status;

    await q(
      `UPDATE purchase_orders
          SET status = $1,
              received_at = CASE WHEN $1 = 'received' THEN NOW() ELSE received_at END,
              received_by = $2,
              notes = COALESCE($3, notes),
              updated_at = NOW()
        WHERE id = $4`,
      [newStatus, receivedBy, notes ?? null, poId],
    );

    return { status: newStatus, receipts: results };
  });
}

export async function generateWeeklyPOs() {
  const { rows: lowStock } = await query<{
    material_id: string; warehouse_id: string; quantity_on_hand: number;
    reorder_point: number; reorder_quantity: number; max_stock: number | null;
    primary_supply_house_id: string; department: string; unit_cost: number | string | null; material_name: string;
  }>(
    `SELECT ws.material_id, ws.warehouse_id, ws.quantity_on_hand,
            m.reorder_point, m.reorder_quantity, m.max_stock,
            m.primary_supply_house_id, m.department, m.unit_cost,
            m.name AS material_name
       FROM warehouse_stock ws
       JOIN materials m ON m.id = ws.material_id AND m.is_active = TRUE AND m.primary_supply_house_id IS NOT NULL
       JOIN warehouses w ON w.id = ws.warehouse_id AND w.status = 'active'
      WHERE ws.quantity_on_hand <= m.reorder_point AND m.reorder_quantity > 0`,
  );

  if (lowStock.length === 0) return { pos_created: 0, lines_added: 0 };

  const groups = new Map<string, { warehouse_id: string; supply_house_id: string; department: string; items: typeof lowStock }>();
  for (const item of lowStock) {
    const key = `${item.warehouse_id}::${item.primary_supply_house_id}::${item.department}`;
    if (!groups.has(key)) {
      groups.set(key, {
        warehouse_id: item.warehouse_id,
        supply_house_id: item.primary_supply_house_id,
        department: item.department,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  let posCreated = 0;
  let linesAdded = 0;

  for (const group of groups.values()) {
    const po = await createPO({
      supply_house_id: group.supply_house_id,
      warehouse_id: group.warehouse_id,
      department: group.department,
      trigger_type: 'scheduled_weekly',
      created_by: null,
      review_deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });

    for (const item of group.items) {
      const qty = item.max_stock
        ? Math.max(item.reorder_quantity, item.max_stock - item.quantity_on_hand)
        : item.reorder_quantity;
      if (qty > 0) {
        await addPOLine(po.id, {
          material_id: item.material_id,
          quantity_ordered: qty,
          unit_cost: (item.unit_cost as number) ?? null,
        });
        linesAdded++;
      }
    }
    posCreated++;
  }

  return { pos_created: posCreated, lines_added: linesAdded };
}
