import 'server-only';
import { query } from '../db';

export interface Notification {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  link: string;
  link_label: string;
  read: boolean;
  created_at: string;
}

// Per-user read sets (in-memory; persists for the lifetime of the Node process).
declare global {
  // eslint-disable-next-line no-var
  var __invReadSets: Map<string, Set<string>> | undefined;
}
const readSets = global.__invReadSets || new Map<string, Set<string>>();
if (process.env.NODE_ENV !== 'production') global.__invReadSets = readSets;

function getReadSet(userId: string): Set<string> {
  let s = readSets.get(userId);
  if (!s) { s = new Set<string>(); readSets.set(userId, s); }
  return s;
}

const notifId = (type: string, refId: string) => `${type}::${refId}`;

async function safeQuery<T extends Record<string, unknown>>(
  text: string,
): Promise<T[]> {
  try {
    const r = await query<T>(text);
    return r.rows;
  } catch (e) {
    console.warn('[notifications] query skipped:', (e as Error).message);
    return [];
  }
}

export async function buildNotifications(userId: string) {
  const read = getReadSet(userId);
  const notifs: Notification[] = [];

  const lowStock = await safeQuery<{
    id: string; name: string; quantity_on_hand: number; reorder_point: number; warehouse_name: string;
  }>(`
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
      severity: row.quantity_on_hand === 0 ? 'critical' : 'warning',
      title: row.quantity_on_hand === 0 ? 'Out of Stock' : 'Low Stock',
      message: `${row.name} — ${row.quantity_on_hand} remaining at ${row.warehouse_name} (reorder at ${row.reorder_point})`,
      link: `/materials/${row.id}`,
      link_label: 'View material',
      read: read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  const batches = await safeQuery<{
    id: string; batch_number: string; status: string; truck_number: string; warehouse_name: string; line_count: string;
  }>(`
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
      severity: b.status === 'locked' ? 'warning' : 'info',
      title: b.status === 'locked' ? 'Batch Awaiting Approval' : 'Batch Ready to Pick',
      message: `${b.batch_number} — Truck ${b.truck_number} · ${b.warehouse_name} · ${b.line_count} line(s)`,
      link: `/restock-queue/${b.id}`,
      link_label: 'Review batch',
      read: read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  const overdueTools = await safeQuery<{
    id: string; name: string; expected_return_date: string; checked_out_to_name: string | null;
  }>(`
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
      severity: 'warning',
      title: 'Tool Overdue',
      message: `${t.name} was due back ${t.expected_return_date}${t.checked_out_to_name ? ` (${t.checked_out_to_name})` : ''}`,
      link: `/tools/${t.id}`,
      link_label: 'View tool',
      read: read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  const pendingPOs = await safeQuery<{
    id: string; po_number: string; review_deadline: string | null; supply_house_name: string | null;
  }>(`
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
      severity: 'info',
      title: 'PO Pending Review',
      message: `${po.po_number}${po.supply_house_name ? ` — ${po.supply_house_name}` : ''} needs your review`,
      link: `/purchase-orders/${po.id}`,
      link_label: 'Review PO',
      read: read.has(id),
      created_at: new Date().toISOString(),
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return order[a.severity] - order[b.severity];
  });

  const unread = notifs.filter(n => !n.read).length;
  return { notifications: notifs, unread, total: notifs.length };
}

export function markNotificationRead(userId: string, id: string) {
  getReadSet(userId).add(id);
}

export async function markAllNotificationsRead(userId: string) {
  const { notifications } = await buildNotifications(userId);
  const set = getReadSet(userId);
  notifications.forEach((n) => set.add(n.id));
}
