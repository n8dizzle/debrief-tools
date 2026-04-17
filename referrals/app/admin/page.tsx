import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface DashboardKpis {
  totalReferrers: number;
  activeReferrers: number;
  newReferrersThisMonth: number;
  referralsThisMonth: number;
  referralsAllTime: number;
  conversionPct: number;
  totalEarnedAllTime: number;
  totalDonatedAllTime: number;
  pendingRewards: number;
  pendingDonations: number;
  failedRewards: number;
}

async function getDashboardData(): Promise<DashboardKpis> {
  const supabase = getServerSupabase();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  const [
    { count: totalReferrers },
    { count: activeReferrers },
    { count: newReferrersThisMonth },
    { count: referralsAllTime },
    { count: referralsThisMonth },
    { count: completedReferrals },
    { data: referrerRollups },
    { data: donationRollups },
    { count: pendingRewards },
    { count: pendingDonations },
    { count: failedRewards },
  ] = await Promise.all([
    supabase.from("ref_referrers").select("*", { count: "exact", head: true }),
    supabase
      .from("ref_referrers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("ref_referrers")
      .select("*", { count: "exact", head: true })
      .gte("enrolled_at", monthStartIso),
    supabase.from("ref_referrals").select("*", { count: "exact", head: true }),
    supabase
      .from("ref_referrals")
      .select("*", { count: "exact", head: true })
      .gte("submitted_at", monthStartIso),
    supabase
      .from("ref_referrals")
      .select("*", { count: "exact", head: true })
      .in("status", ["COMPLETED", "REWARD_ISSUED"]),
    supabase.from("ref_referrers").select("total_earned"),
    supabase
      .from("ref_charity_donations")
      .select("amount")
      .in("status", ["ISSUED", "CONFIRMED"]),
    supabase
      .from("ref_rewards")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("ref_charity_donations")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("ref_rewards")
      .select("*", { count: "exact", head: true })
      .eq("status", "FAILED"),
  ]);

  const totalEarnedAllTime = (referrerRollups || []).reduce(
    (sum, r) => sum + Number(r.total_earned || 0),
    0
  );
  const totalDonatedAllTime = (donationRollups || []).reduce(
    (sum, d) => sum + Number(d.amount || 0),
    0
  );

  const conversionPct =
    referralsAllTime && referralsAllTime > 0
      ? ((completedReferrals || 0) / referralsAllTime) * 100
      : 0;

  return {
    totalReferrers: totalReferrers || 0,
    activeReferrers: activeReferrers || 0,
    newReferrersThisMonth: newReferrersThisMonth || 0,
    referralsThisMonth: referralsThisMonth || 0,
    referralsAllTime: referralsAllTime || 0,
    conversionPct,
    totalEarnedAllTime,
    totalDonatedAllTime,
    pendingRewards: pendingRewards || 0,
    pendingDonations: pendingDonations || 0,
    failedRewards: failedRewards || 0,
  };
}

export default async function AdminDashboard() {
  const k = await getDashboardData();

  return (
    <div className="max-w-6xl">
      <h1 className="text-4xl mb-8">Dashboard</h1>

      {(k.pendingRewards + k.pendingDonations + k.failedRewards) > 0 && (
        <div
          className="card mb-8"
          style={{
            background: "rgba(184,149,107,0.12)",
            borderColor: "#8a6a3a",
          }}
        >
          <h2 className="text-xl mb-2">Needs your attention</h2>
          <ul className="space-y-1 text-sm">
            {k.pendingRewards > 0 && (
              <li>
                <a href="/admin/rewards" className="font-semibold">
                  {k.pendingRewards} reward{k.pendingRewards === 1 ? "" : "s"} awaiting approval →
                </a>
              </li>
            )}
            {k.pendingDonations > 0 && (
              <li>
                <a href="/admin/donations" className="font-semibold">
                  {k.pendingDonations} donation{k.pendingDonations === 1 ? "" : "s"} awaiting approval →
                </a>
              </li>
            )}
            {k.failedRewards > 0 && (
              <li>
                <a href="/admin/rewards" className="font-semibold">
                  {k.failedRewards} failed reward{k.failedRewards === 1 ? "" : "s"} need review →
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

      <section className="grid gap-5 md:grid-cols-3 mb-8">
        <Kpi
          label="Active referrers"
          value={k.activeReferrers.toString()}
          sub={`${k.newReferrersThisMonth} new this month`}
        />
        <Kpi
          label="Referrals this month"
          value={k.referralsThisMonth.toString()}
          sub={`${k.referralsAllTime} all-time`}
        />
        <Kpi
          label="Conversion rate"
          value={`${k.conversionPct.toFixed(1)}%`}
          sub="completed / submitted"
        />
        <Kpi
          label="Rewards earned (all-time)"
          value={`$${k.totalEarnedAllTime.toFixed(0)}`}
          sub="referrer totals"
        />
        <Kpi
          label="Donated to charity"
          value={`$${k.totalDonatedAllTime.toFixed(0)}`}
          sub="Triple Win impact"
        />
        <Kpi
          label="Pending approvals"
          value={(k.pendingRewards + k.pendingDonations).toString()}
          sub={`${k.pendingRewards} rewards · ${k.pendingDonations} donations`}
        />
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <p className="text-sm uppercase tracking-wide opacity-60 mb-2">{label}</p>
      <p
        className="text-4xl mb-1"
        style={{
          fontFamily: "var(--font-lobster)",
          color: "var(--ca-dark-green)",
        }}
      >
        {value}
      </p>
      <p className="text-sm opacity-70">{sub}</p>
    </div>
  );
}
