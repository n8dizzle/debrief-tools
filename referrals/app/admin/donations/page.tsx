import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { CharityDonation, DonationStatus, Charity, Referrer, Referral } from "@/lib/supabase";
import PayoutQueueCard, { type PayoutSummary } from "./PayoutQueueCard";
import DonationsTable, { type DonationRow } from "./DonationsTable";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: DonationStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "ISSUED", label: "Issued" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "FAILED", label: "Failed" },
  { value: "ALL", label: "All" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function getDonations(statusFilter: string): Promise<DonationRow[]> {
  const supabase = getServerSupabase();
  let query = supabase
    .from("ref_charity_donations")
    .select(
      `*,
       charity:ref_charities(name, fulfillment_method),
       referral:ref_referrals(referred_name, referrer:ref_referrers(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]) || [];
}

/**
 * All APPROVED (awaiting-payout) donations grouped by charity. Drives the
 * payout queue cards at the top of the page. Aggregation done in-memory —
 * the donations table won't be large enough for ages for SQL aggregation
 * to matter.
 */
async function getPayoutSummary(): Promise<PayoutSummary[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_charity_donations")
    .select("amount, created_at, charity:ref_charities(id, name, fulfillment_method)")
    .eq("status", "APPROVED");

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as any[];
  const byCharity = new Map<string, PayoutSummary>();
  const now = Date.now();

  for (const r of rows) {
    const c = r.charity;
    if (!c?.id) continue;
    const existing = byCharity.get(c.id);
    const ageDays = Math.max(
      0,
      Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
    );
    if (!existing) {
      byCharity.set(c.id, {
        charityId: c.id,
        charityName: c.name,
        fulfillmentMethod: c.fulfillment_method ?? null,
        count: 1,
        total: Number(r.amount),
        oldestDays: ageDays,
      });
    } else {
      existing.count += 1;
      existing.total += Number(r.amount);
      if (ageDays > existing.oldestDays) existing.oldestDays = ageDays;
    }
  }

  return Array.from(byCharity.values()).sort(
    (a, b) => b.oldestDays - a.oldestDays
  );
}

export default async function DonationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = sp.status || "PENDING";
  const [donations, payoutSummary] = await Promise.all([
    getDonations(statusFilter),
    getPayoutSummary(),
  ]);

  const totalOwed = payoutSummary.reduce((sum, s) => sum + s.total, 0);

  return (
    <div>
      <h1 className="text-4xl mb-2">Charity donations</h1>
      <p className="opacity-70 mb-6">{donations.length} match</p>

      {payoutSummary.length > 0 && (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl" style={{ color: "var(--ca-dark-green)" }}>
              Payout queue
            </h2>
            <p className="text-sm opacity-70">
              <strong>${Math.round(totalOwed)}</strong> owed across{" "}
              {payoutSummary.length} charit
              {payoutSummary.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <p className="text-sm opacity-70 mb-4 max-w-2xl">
            These charities have approved donations waiting on manual payment.
            Write one check per charity covering all listed donations, then
            mark them paid with the check number for reconciliation.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {payoutSummary.map((s) => (
              <PayoutQueueCard key={s.charityId} summary={s} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/donations?status=${f.value}`}
            className="px-3 py-1.5 rounded-full text-sm"
            style={{
              background:
                statusFilter === f.value ? "var(--ca-green)" : "var(--bg-card)",
              color:
                statusFilter === f.value
                  ? "var(--ca-cream)"
                  : "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <DonationsTable rows={donations} />
    </div>
  );
}
