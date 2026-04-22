// Compute and persist daily AR snapshots.
//
// Historical reconstruction uses ar_invoices.{invoice_date, last_payment_date,
// invoice_total, balance, business_unit_name} to approximate "balance as of
// date D". Caveats documented in the feature spec: partial payments before
// last_payment_date are not precisely reconstructible; today's control_bucket
// is applied to historical invoices (fine for stable ones, wrong for re-bucketed).

import { getServerSupabase } from '@/lib/supabase';

const DSO_PERIOD_DAYS = 30;

interface SnapshotInvoice {
  invoice_date: string;
  last_payment_date: string | null;
  invoice_total: number | string | null;
  balance: number | string | null;
  business_unit_name: string | null;
}

interface TrackingRow {
  invoice_id: string;
  control_bucket: string | null;
}

type Supabase = ReturnType<typeof getServerSupabase>;

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
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

/**
 * Compute an AR snapshot for a specific date. If `asOfDate` is today, uses
 * current data. If it's in the past, reconstructs historical state from
 * `ar_invoices` (with the documented caveats).
 */
export async function computeSnapshot(asOfDate: Date): Promise<SnapshotResult> {
  const supabase = getServerSupabase();
  const dateStr = ymd(asOfDate);

  // Pull all invoices (paginated). Cap at 10k — AR table is ~1k today.
  const invoices: SnapshotInvoice[] = [];
  const invoiceIdMap = new Map<string, SnapshotInvoice>();
  const invoiceIds: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const { data, error } = await supabase
      .from('ar_invoices')
      .select('id, invoice_date, last_payment_date, invoice_total, balance, business_unit_name')
      .lte('invoice_date', dateStr)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const inv = row as SnapshotInvoice & { id: string };
      invoices.push(inv);
      invoiceIdMap.set(inv.id, inv);
      invoiceIds.push(inv.id);
    }
    if (data.length < pageSize) break;
  }

  // Pull tracking rows to know control_bucket (current state — see caveat).
  const trackingByInvoice = new Map<string, string | null>();
  for (let i = 0; i < invoiceIds.length; i += pageSize) {
    const chunk = invoiceIds.slice(i, i + pageSize);
    if (chunk.length === 0) break;
    const { data, error } = await supabase
      .from('ar_invoice_tracking')
      .select('invoice_id, control_bucket')
      .in('invoice_id', chunk);
    if (error) throw error;
    for (const row of (data as TrackingRow[]) || []) {
      trackingByInvoice.set(row.invoice_id, row.control_bucket);
    }
  }

  // Pull shared BU groups + members for by-group aggregation.
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

  const groupOf = new Map<string, string>(); // business_unit_name -> group_id
  for (const m of (membersRes.data as { group_id: string; business_unit_name: string }[]) || []) {
    groupOf.set(m.business_unit_name, m.group_id);
  }

  // Aggregate.
  let total = 0;
  let actionable = 0;
  let pending = 0;
  let bucket_current = 0;
  let bucket_30 = 0;
  let bucket_60 = 0;
  let bucket_90_plus = 0;
  const byGroup = new Map<string, number>();

  const asOf = new Date(`${dateStr}T12:00:00`); // noon to avoid TZ edge

  for (const inv of invoices as (SnapshotInvoice & { id: string })[]) {
    const invDate = new Date(`${inv.invoice_date}T12:00:00`);
    if (invDate.getTime() > asOf.getTime()) continue;

    const lastPayment = inv.last_payment_date
      ? new Date(`${inv.last_payment_date}T12:00:00`)
      : null;

    // Outstanding-on-D heuristic:
    //   - Not outstanding if last_payment_date <= D AND balance == 0
    //   - Otherwise outstanding (approximates partial-payment cases slightly high)
    const balance = toNum(inv.balance);
    const paidByD = lastPayment !== null && lastPayment.getTime() <= asOf.getTime();
    if (paidByD && balance === 0) continue;

    // Amount on D: use invoice_total as the approximation. Overestimates
    // cases where partial payments happened before D.
    const amount = toNum(inv.invoice_total);
    if (amount <= 0) continue;

    total += amount;

    // Aging bucket
    const age = daysBetween(invDate, asOf);
    if (age < 30) bucket_current += amount;
    else if (age < 60) bucket_30 += amount;
    else if (age < 90) bucket_60 += amount;
    else bucket_90_plus += amount;

    // Control bucket (uses TODAY's tracking — see caveat)
    const bucket = trackingByInvoice.get(inv.id);
    if (bucket === 'ar_collectible') actionable += amount;
    else if (bucket === 'ar_not_in_our_control') pending += amount;

    // By group
    if (inv.business_unit_name) {
      const gid = groupOf.get(inv.business_unit_name);
      if (gid) byGroup.set(gid, (byGroup.get(gid) || 0) + amount);
    }
  }

  // Period revenue = sum of invoice_total for invoices with
  // invoice_date in (D - period_days, D]
  const periodStart = new Date(asOf);
  periodStart.setDate(periodStart.getDate() - DSO_PERIOD_DAYS);
  let period_revenue = 0;
  for (const inv of invoices) {
    const invDate = new Date(`${inv.invoice_date}T12:00:00`);
    if (invDate.getTime() > periodStart.getTime() && invDate.getTime() <= asOf.getTime()) {
      period_revenue += toNum(inv.invoice_total);
    }
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

export async function upsertSnapshot(
  asOfDate: Date,
  { isBackfill = false }: { isBackfill?: boolean } = {},
): Promise<SnapshotResult> {
  const result = await computeSnapshot(asOfDate);
  const supabase = getServerSupabase();

  const { error: upErr } = await supabase.from('ar_daily_snapshots').upsert(
    {
      snapshot_date: result.snapshot_date,
      total_outstanding: result.total_outstanding,
      actionable_ar: result.actionable_ar,
      pending_closures: result.pending_closures,
      bucket_current: result.bucket_current,
      bucket_30: result.bucket_30,
      bucket_60: result.bucket_60,
      bucket_90_plus: result.bucket_90_plus,
      period_revenue: result.period_revenue,
      period_days: result.period_days,
      true_dso_total: result.true_dso_total,
      true_dso_actionable: result.true_dso_actionable,
      true_dso_pending: result.true_dso_pending,
      is_backfilled: isBackfill,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'snapshot_date' },
  );
  if (upErr) throw upErr;

  // Replace per-group snapshot rows for this date.
  const { error: delErr } = await supabase
    .from('ar_daily_group_snapshots')
    .delete()
    .eq('snapshot_date', result.snapshot_date);
  if (delErr) throw delErr;

  if (result.by_group.length > 0) {
    const { error: grpErr } = await supabase.from('ar_daily_group_snapshots').insert(
      result.by_group.map((g) => ({
        snapshot_date: result.snapshot_date,
        group_id: g.group_id,
        total_outstanding: g.total_outstanding,
        is_backfilled: isBackfill,
      })),
    );
    if (grpErr) throw grpErr;
  }

  return result;
}
