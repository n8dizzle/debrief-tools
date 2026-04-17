import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { Reward, RewardStatus, Referrer } from "@/lib/supabase";
import RewardActions from "./RewardActions";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: RewardStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "ISSUED", label: "Issued" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function getRewards(statusFilter: string): Promise<
  (Reward & {
    referrer: Pick<Referrer, "first_name" | "last_name" | "email">;
  })[]
> {
  const supabase = getServerSupabase();
  let query = supabase
    .from("ref_rewards")
    .select("*, referrer:ref_referrers(first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]) || [];
}

export default async function RewardsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = sp.status || "PENDING";
  const rewards = await getRewards(statusFilter);

  return (
    <div>
      <h1 className="text-4xl mb-2">Rewards</h1>
      <p className="opacity-70 mb-6">{rewards.length} match</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/rewards?status=${f.value}`}
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
              <Th>Referrer</Th>
              <Th className="text-right">Amount</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td>
                  {r.referrer.first_name} {r.referrer.last_name}
                  <div className="text-xs opacity-60">{r.referrer.email}</div>
                </Td>
                <Td className="text-right font-semibold">
                  ${Number(r.amount).toFixed(0)}
                </Td>
                <Td className="text-xs opacity-80">{r.type.replace(/_/g, " ")}</Td>
                <Td>
                  <RewardStatusBadge status={r.status} />
                  {r.failure_reason && (
                    <div
                      className="text-xs mt-1 opacity-80"
                      style={{ color: "var(--ca-red)" }}
                    >
                      {r.failure_reason.slice(0, 80)}
                    </div>
                  )}
                </Td>
                <Td className="opacity-70 text-xs">
                  {new Date(r.created_at).toLocaleDateString()}
                </Td>
                <Td>
                  {r.status === "PENDING" && <RewardActions rewardId={r.id} />}
                </Td>
              </tr>
            ))}
            {rewards.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center opacity-60">
                  No rewards match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RewardStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a" },
    APPROVED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af" },
    ISSUED: { bg: "rgba(97,139,96,0.15)", fg: "#415440" },
    DELIVERED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d" },
    FAILED: { bg: "rgba(135,76,59,0.15)", fg: "#874c3b" },
    CANCELLED: { bg: "rgba(0,0,0,0.05)", fg: "#6b7280" },
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
