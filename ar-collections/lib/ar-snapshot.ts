// Compute and persist daily AR snapshots.
//
// Historical reconstruction rules (data reality as of Apr 2026):
//   - ar_invoices.last_payment_date is universally null in this deployment.
//   - ar_invoices.status is 'open' or 'paid'.
//   - ar_payments has records for only some paid invoices (~10%).
//
// Reconstruction strategy:
//   - status='open' invoice: assumed outstanding since invoice_date with
//     amount = today's balance. (Lower bound: if pre-D partial payments
//     happened we'd underestimate, but we can't see them.)
//   - status='paid' with ar_payments record: use max(payment_date) as
//     close date. Outstanding on D if payment_date > D, amount = invoice_total.
//   - status='paid' with NO ar_payments record: unknown close date.
//     SKIP entirely from the historical series. The alternative (assume
//     perpetually outstanding) inflated the chart by ~$2M.
//
// Control bucket and group mapping still use today's state — documented
// caveats remain.

import { getServerSupabase } from '@/lib/supabase';

const DSO_PERIOD_DAYS = 30;

interface SnapshotInvoice {
  id: string;
  invoice_date: string;
  last_payment_date: string | null;
  invoice_total: number | string | null;
  balance: number | string | null;
  business_unit_name: string | null;
  status: string | null;
}

interface TrackingRow {
  invoice_id: string;
  control_bucket: string | null;
}

interface PaymentRow {
  invoice_id: string;
  payment_date: string;
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function daysBetween(a: number, b: number): number {
  return Math.floor((b - a) / 86400000);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface SnapshotResult {
  snapshot_date: string;
  total_outstanding: number;
  actionable_ar: number;
  pending_closures: number;
  bucket_current: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90_plus: number;
  period_revenue: number;
  period_days: number;
  true_dso_total: number;
  true_dso_actionable: number;
  true_dso_pending: number;
  by_group: { group_id: string; total_outstanding: number }[];
}

interface PreparedInvoice {
  id: string;
  invoiceDateMs: number;
  // Latest payment_date from ar_payments (or ar_invoices.last_payment_date if
  // populated). Null means we have no timing info.
  closedAtMs: number | null;
  balance: number;
  invoiceTotal: number;
  businessUnitName: string | null;
  status: string | null; // 'open' | 'paid' | other
  bucket: string | null;
  groupId: string | null;
}

export interface BulkData {
  invoices: PreparedInvoice[];
  groupIds: string[];
}

/**
 * Fetch all data needed for snapshot computation. Returns a denormalized
 * in-memory structure so multiple dates can be computed without DB round trips.
 */
export async function fetchBulkData(): Promise<BulkData> {
  const supabase = getServerSupabase();

  // Invoices (paginated).
  const rawInvoices: SnapshotInvoice[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await supabase
      .from('ar_invoices')
      .select('id, invoice_date, last_payment_date, invoice_total, balance, business_unit_name, status')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rawInvoices.push(...(data as SnapshotInvoice[]));
    if (data.length < pageSize) break;
  }

  // Payments — collect latest payment_date per invoice.
  const latestPaymentByInvoice = new Map<string, number>(); // invoice_id -> ms
  for (let offset = 0; offset < 100000; offset += pageSize) {
    const { data, error } = await supabase
      .from('ar_payments')
      .select('invoice_id, payment_date')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of (data as PaymentRow[]) || []) {
      if (!row.invoice_id || !row.payment_date) continue;
      const ms = new Date(`${row.payment_date}T12:00:00`).getTime();
      const prior = latestPaymentByInvoice.get(row.invoice_id);
      if (prior === undefined || ms > prior) latestPaymentByInvoice.set(row.invoice_id, ms);
    }
    if (data.length < pageSize) break;
  }

  // Tracking (paginated).
  const trackingByInvoice = new Map<string, string | null>();
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await supabase
      .from('ar_invoice_tracking')
      .select('invoice_id, control_bucket')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of (data as TrackingRow[]) || []) {
      trackingByInvoice.set(row.invoice_id, row.control_bucket);
    }
    if (data.length < pageSize) break;
  }

  // Active groups + members.
  const [groupsRes, membersRes] = await Promise.all([
    supabase
      .from('shared_business_unit_groups')
      .select('id')
      .eq('is_active', true),
    supabase
      .from('shared_business_unit_group_members')
      .select('group_id, business_unit_name'),
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (membersRes.error) throw membersRes.error;

  const groupOf = new Map<string, string>();
  for (const m of (membersRes.data as { group_id: string; business_unit_name: string }[]) || []) {
    groupOf.set(m.business_unit_name, m.group_id);
  }

  const invoices: PreparedInvoice[] = rawInvoices.map((inv) => {
    // Prefer the latest payment from ar_payments; fall back to
    // ar_invoices.last_payment_date if populated.
    const paymentMs = latestPaymentByInvoice.get(inv.id);
    const legacyMs = inv.last_payment_date
      ? new Date(`${inv.last_payment_date}T12:00:00`).getTime()
      : undefined;
    let closedAtMs: number | null = null;
    if (paymentMs !== undefined) closedAtMs = paymentMs;
    else if (legacyMs !== undefined) closedAtMs = legacyMs;
    return {
      id: inv.id,
      invoiceDateMs: new Date(`${inv.invoice_date}T12:00:00`).getTime(),
      closedAtMs,
      balance: toNum(inv.balance),
      invoiceTotal: toNum(inv.invoice_total),
      businessUnitName: inv.business_unit_name,
      status: inv.status,
      bucket: trackingByInvoice.get(inv.id) ?? null,
      groupId: inv.business_unit_name ? (groupOf.get(inv.business_unit_name) ?? null) : null,
    };
  });

  const groupIds = ((groupsRes.data as { id: string }[]) || []).map((g) => g.id);

  return { invoices, groupIds };
}

/** Pure in-memory aggregation for one date. */
export function computeSnapshotFromData(asOfDate: Date, bulk: BulkData): SnapshotResult {
  const dateStr = ymd(asOfDate);
  const asOfMs = new Date(`${dateStr}T12:00:00`).getTime();
  const periodStartMs = asOfMs - DSO_PERIOD_DAYS * 86400000;

  let total = 0;
  let actionable = 0;
  let pending = 0;
  let bucket_current = 0;
  let bucket_30 = 0;
  let bucket_60 = 0;
  let bucket_90_plus = 0;
  let period_revenue = 0;
  const byGroup = new Map<string, number>();

  for (const inv of bulk.invoices) {
    // Revenue window: invoice_date in (D-30, D]. Independent of payment state.
    if (inv.invoiceDateMs > periodStartMs && inv.invoiceDateMs <= asOfMs) {
      period_revenue += inv.invoiceTotal;
    }

    if (inv.invoiceDateMs > asOfMs) continue;

    // Outstanding-on-D decision + amount:
    //   - status='open'  -> outstanding at D; amount = balance today
    //     (lower bound; actual historical balance may be higher if there were
    //      pre-D partial payments we can't see)
    //   - status='paid' with closedAtMs set:
    //       outstanding at D iff closedAtMs > asOfMs; amount = invoice_total
    //   - status='paid' with closedAtMs null: SKIP (unknowable close date)
    let amount = 0;
    if (inv.status === 'open') {
      amount = inv.balance;
    } else if (inv.status === 'paid') {
      if (inv.closedAtMs === null) {
        continue; // no payment record, skip
      }
      if (inv.closedAtMs <= asOfMs) continue; // closed by D
      amount = inv.invoiceTotal;
    } else {
      continue; // unknown status
    }

    if (amount <= 0) continue;

    total += amount;

    const age = daysBetween(inv.invoiceDateMs, asOfMs);
    if (age < 30) bucket_current += amount;
    else if (age < 60) bucket_30 += amount;
    else if (age < 90) bucket_60 += amount;
    else bucket_90_plus += amount;

    if (inv.bucket === 'ar_collectible') actionable += amount;
    else if (inv.bucket === 'ar_not_in_our_control') pending += amount;

    if (inv.groupId) byGroup.set(inv.groupId, (byGroup.get(inv.groupId) || 0) + amount);
  }

  const true_dso_total =
    period_revenue > 0 ? Math.round((total / period_revenue) * DSO_PERIOD_DAYS) : 0;
  const true_dso_actionable =
    period_revenue > 0 ? Math.round((actionable / period_revenue) * DSO_PERIOD_DAYS) : 0;
  const true_dso_pending =
    period_revenue > 0 ? Math.round((pending / period_revenue) * DSO_PERIOD_DAYS) : 0;

  return {
    snapshot_date: dateStr,
    total_outstanding: total,
    actionable_ar: actionable,
    pending_closures: pending,
    bucket_current,
    bucket_30,
    bucket_60,
    bucket_90_plus,
    period_revenue,
    period_days: DSO_PERIOD_DAYS,
    true_dso_total,
    true_dso_actionable,
    true_dso_pending,
    by_group: Array.from(byGroup.entries()).map(([group_id, total_outstanding]) => ({
      group_id,
      total_outstanding,
    })),
  };
}

export async function computeSnapshot(asOfDate: Date): Promise<SnapshotResult> {
  const bulk = await fetchBulkData();
  return computeSnapshotFromData(asOfDate, bulk);
}

/** Single-date upsert. Keeps previous callers unchanged. */
export async function upsertSnapshot(
  asOfDate: Date,
  { isBackfill = false }: { isBackfill?: boolean } = {},
): Promise<SnapshotResult> {
  const result = await computeSnapshot(asOfDate);
  await persistSnapshots([result], { isBackfill });
  return result;
}

/** Efficient batch: compute + upsert many dates using one bulk fetch. */
export async function upsertSnapshotRange(
  fromDate: Date,
  toDate: Date,
): Promise<SnapshotResult[]> {
  const bulk = await fetchBulkData();
  const results: SnapshotResult[] = [];
  const d = new Date(fromDate);
  d.setHours(12, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayMs = today.getTime();
  while (d.getTime() <= end.getTime()) {
    const r = computeSnapshotFromData(d, bulk);
    results.push(r);
    d.setDate(d.getDate() + 1);
  }
  // Mark as backfill unless the date is today (authoritative daily snapshot).
  await persistSnapshots(results, {
    perRowIsBackfill: (r) => new Date(`${r.snapshot_date}T12:00:00`).getTime() !== todayMs,
  });
  return results;
}

async function persistSnapshots(
  results: SnapshotResult[],
  opts: { isBackfill?: boolean; perRowIsBackfill?: (r: SnapshotResult) => boolean } = {},
): Promise<void> {
  if (results.length === 0) return;
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const rows = results.map((r) => ({
    snapshot_date: r.snapshot_date,
    total_outstanding: r.total_outstanding,
    actionable_ar: r.actionable_ar,
    pending_closures: r.pending_closures,
    bucket_current: r.bucket_current,
    bucket_30: r.bucket_30,
    bucket_60: r.bucket_60,
    bucket_90_plus: r.bucket_90_plus,
    period_revenue: r.period_revenue,
    period_days: r.period_days,
    true_dso_total: r.true_dso_total,
    true_dso_actionable: r.true_dso_actionable,
    true_dso_pending: r.true_dso_pending,
    is_backfilled: opts.perRowIsBackfill ? opts.perRowIsBackfill(r) : (opts.isBackfill ?? false),
    updated_at: now,
  }));

  const { error: upErr } = await supabase
    .from('ar_daily_snapshots')
    .upsert(rows, { onConflict: 'snapshot_date' });
  if (upErr) throw upErr;

  const dates = results.map((r) => r.snapshot_date);
  const { error: delErr } = await supabase
    .from('ar_daily_group_snapshots')
    .delete()
    .in('snapshot_date', dates);
  if (delErr) throw delErr;

  const groupRows: {
    snapshot_date: string;
    group_id: string;
    total_outstanding: number;
    is_backfilled: boolean;
  }[] = [];
  for (const r of results) {
    const isBf = opts.perRowIsBackfill ? opts.perRowIsBackfill(r) : (opts.isBackfill ?? false);
    for (const g of r.by_group) {
      groupRows.push({
        snapshot_date: r.snapshot_date,
        group_id: g.group_id,
        total_outstanding: g.total_outstanding,
        is_backfilled: isBf,
      });
    }
  }
  if (groupRows.length > 0) {
    const { error: grpErr } = await supabase
      .from('ar_daily_group_snapshots')
      .insert(groupRows);
    if (grpErr) throw grpErr;
  }
}
