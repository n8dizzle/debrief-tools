import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { Referral, ReferralStatus, Referrer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: ReferralStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "BOOKED", label: "Booked" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REWARD_ISSUED", label: "Reward issued" },
  { value: "EXPIRED", label: "Expired" },
  { value: "INELIGIBLE", label: "Ineligible" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function getReferrals(
  statusFilter: string
): Promise<(Referral & { referrer: Pick<Referrer, "first_name" | "last_name" | "referral_code"> })[]> {
  const supabase = getServerSupabase();
  let query = supabase
    .from("ref_referrals")
    .select("*, referrer:ref_referrers(first_name, last_name, referral_code)")
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]) || [];
}

export default async function ReferralsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = sp.status || "ALL";
  const referrals = await getReferrals(statusFilter);

  return (
    <div>
      <h1 className="text-4xl mb-2">Referrals</h1>
      <p className="opacity-70 mb-6">{referrals.length} match (showing most recent 200)</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/admin/referrals" : `/admin/referrals?status=${f.value}`}
            className="px-3 py-1.5 rounded-full text-sm transition-colors"
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
              <Th>Friend</Th>
              <Th>Referred by</Th>
              <Th>Service</Th>
              <Th>Status</Th>
              <Th className="text-right">Invoice</Th>
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td>
                  {r.referred_name}
                  <div className="text-xs opacity-60">{r.referred_phone}</div>
                </Td>
                <Td>
                  {r.referrer.first_name} {r.referrer.last_name}
                  <div className="text-xs opacity-60">
                    <code>{r.referrer.referral_code}</code>
                  </div>
                </Td>
                <Td className="opacity-80 text-xs max-w-xs">{r.service_requested}</Td>
                <Td>
                  <ReferralStatusBadge status={r.status} />
                </Td>
                <Td className="text-right">
                  {r.invoice_total
                    ? `$${Number(r.invoice_total).toFixed(0)}`
                    : "—"}
                </Td>
                <Td className="opacity-70 text-xs">
                  {new Date(r.submitted_at).toLocaleDateString()}
                </Td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center opacity-60">
                  No referrals match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReferralStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    SUBMITTED: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a", label: "Submitted" },
    BOOKED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af", label: "Booked" },
    COMPLETED: { bg: "rgba(97,139,96,0.15)", fg: "#415440", label: "Completed" },
    REWARD_ISSUED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d", label: "Reward issued" },
    EXPIRED: { bg: "rgba(135,76,59,0.1)", fg: "#874c3b", label: "Expired" },
    INELIGIBLE: { bg: "rgba(0,0,0,0.05)", fg: "#6b7280", label: "Ineligible" },
  };
  const s = styles[status] || styles.SUBMITTED;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
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
