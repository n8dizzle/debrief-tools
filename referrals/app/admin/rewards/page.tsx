import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { Reward, RewardStatus, Referrer } from "@/lib/supabase";
import RewardsTable from "./RewardsTable";

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
  const tremendousEnv = (process.env.TREMENDOUS_ENV || "production").toLowerCase();

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

      <RewardsTable rows={rewards} tremendousEnv={tremendousEnv} />
    </div>
  );
}
