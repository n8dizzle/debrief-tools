import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import type { Referral, ReferralStatus, Referrer } from "@/lib/supabase";
import ReferralsTable from "./ReferralsTable";

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
  const isProduction =
    (process.env.TREMENDOUS_ENV ?? "production").toLowerCase() === "production";

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

      <ReferralsTable rows={referrals} isProduction={isProduction} />
    </div>
  );
}
