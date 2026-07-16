import { getServerSupabase } from '@/lib/supabase';

// Central-time day counting without toISOString (which would shift to UTC).
function centralTodayUTC(): number {
  const d = new Date(Date.now() - 5 * 3600 * 1000); // ~Central (CDT = UTC-5)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const [y, m, dd] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y) return 0;
  return Math.round((centralTodayUTC() - Date.UTC(y, m - 1, dd)) / 86400_000);
}

export interface ARDeal {
  projectId: number;
  customer: string;
  invoiceNumber: string | null;
  balance: number;
  total: number;
  days: number;
}
export interface HealthData {
  execution: {
    soldBooked: { count: number; avgAge: number };
    scheduled: { count: number; avgAge: number };
    installedAwaitingInvoice: number;
    total: number;
  };
  ar: {
    count: number;
    outstanding: number;
    buckets: { over90: number; over90Amount: number; d60_90: number; d30_60: number; under30: number };
    deals: ARDeal[];
  };
}

const EMPTY: HealthData = {
  execution: { soldBooked: { count: 0, avgAge: 0 }, scheduled: { count: 0, avgAge: 0 }, installedAwaitingInvoice: 0, total: 0 },
  ar: { count: 0, outstanding: 0, buckets: { over90: 0, over90Amount: 0, d60_90: 0, d30_60: 0, under30: 0 }, deals: [] },
};

// Full System workflow health: install-execution funnel (live, not-yet-installed deals)
// + awaiting-payment AR list. Bucketed by suggested_class so in-flight deals count before
// a human triages them; excludes deliberately-archived deals.
export async function getFullSystemHealth(): Promise<HealthData> {
  const supabase = getServerSupabase();
  if (!supabase) return EMPTY;
  const { data } = await supabase
    .from('install_deals')
    .select('st_project_id, customer_name, sold_on, scheduled_date, completed_date, invoice_number, invoice_date, invoice_balance, invoice_total')
    .eq('suggested_class', 'full_system')
    .neq('triage_status', 'archived');
  type Row = {
    st_project_id: number; customer_name: string | null; sold_on: string | null; scheduled_date: string | null;
    completed_date: string | null; invoice_number: string | null; invoice_date: string | null;
    invoice_balance: number | string | null; invoice_total: number | string | null;
  };
  const rows = ((data as unknown) as Row[]) || [];
  const avg = (arr: Row[]) => (arr.length ? Math.round(arr.reduce((s, r) => s + daysSince(r.sold_on), 0) / arr.length) : 0);

  // Section 1 — install execution: sold, not yet installed.
  const exec = rows.filter((r) => r.sold_on && !r.completed_date);
  const soldBooked = exec.filter((r) => !r.scheduled_date);
  const scheduled = exec.filter((r) => r.scheduled_date);
  const installedAwaitingInvoice = rows.filter((r) => r.completed_date && !r.invoice_number).length;

  // Section 2 — awaiting payment: installed + invoiced + balance owed.
  const deals: ARDeal[] = rows
    .filter((r) => r.completed_date && r.invoice_number && Number(r.invoice_balance) > 0)
    .map((r) => ({
      projectId: r.st_project_id,
      customer: r.customer_name || `Project ${r.st_project_id}`,
      invoiceNumber: r.invoice_number,
      balance: Number(r.invoice_balance) || 0,
      total: Number(r.invoice_total) || 0,
      days: daysSince(r.invoice_date || r.sold_on),
    }))
    .sort((a, b) => b.days - a.days);

  const over90 = deals.filter((d) => d.days > 90);
  return {
    execution: {
      soldBooked: { count: soldBooked.length, avgAge: avg(soldBooked) },
      scheduled: { count: scheduled.length, avgAge: avg(scheduled) },
      installedAwaitingInvoice,
      total: exec.length,
    },
    ar: {
      count: deals.length,
      outstanding: deals.reduce((s, d) => s + d.balance, 0),
      buckets: {
        over90: over90.length,
        over90Amount: over90.reduce((s, d) => s + d.balance, 0),
        d60_90: deals.filter((d) => d.days >= 60 && d.days <= 90).length,
        d30_60: deals.filter((d) => d.days >= 30 && d.days < 60).length,
        under30: deals.filter((d) => d.days < 30).length,
      },
      deals,
    },
  };
}
