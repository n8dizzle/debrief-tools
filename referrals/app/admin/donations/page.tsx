import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { CharityDonation, DonationStatus, Charity, Referrer, Referral } from "@/lib/supabase";
import DonationActions from "./DonationActions";
import PayoutQueueCard, { type PayoutSummary } from "./PayoutQueueCard";

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

type DonationRow = CharityDonation & {
  charity: Pick<Charity, "name" | "fulfillment_method">;
  referral: Pick<Referral, "referred_name"> & {
    referrer: Pick<Referrer, "first_name" | "last_name">;
  };
};

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

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--bg-muted)" }}>
            <tr>
              <Th>Charity</Th>
              <Th>Method</Th>
              <Th>From referrer</Th>
              <Th>For friend</Th>
              <Th className="text-right">Amount</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td>{d.charity?.name || "—"}</Td>
                <Td className="text-xs opacity-70">
                  {(d.charity?.fulfillment_method || "").toLowerCase().replace(/_/g, " ")}
                </Td>
                <Td>
                  {d.referral?.referrer?.first_name} {d.referral?.referrer?.last_name}
                </Td>
                <Td className="opacity-80">{d.referral?.referred_name}</Td>
                <Td className="text-right font-semibold">
                  ${Number(d.amount).toFixed(0)}
                </Td>
                <Td>
                  <DonationStatusBadge status={d.status} />
                  {d.failure_reason && (
                    <div
                      className="text-xs mt-1 opacity-80"
                      style={{ color: "var(--ca-red)" }}
                    >
                      {d.failure_reason.slice(0, 80)}
                    </div>
                  )}
                </Td>
                <Td>
                  {d.status === "PENDING" && <DonationActions donationId={d.id} />}
                </Td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center opacity-60">
                  No donations match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DonationStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a" },
    APPROVED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af" },
    ISSUED: { bg: "rgba(97,139,96,0.15)", fg: "#415440" },
    CONFIRMED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d" },
    FAILED: { bg: "rgba(135,76,59,0.15)", fg: "#874c3b" },
  };
  const s = styles[status] || styles.PENDING;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {status.toLowerCase()}
    </span>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left p-3 text-xs font-semibold uppercase tracking-wide ${className}`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}
