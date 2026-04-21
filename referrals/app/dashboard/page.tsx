import { getCurrentReferrer } from "@/lib/customer-auth";
import { getServerSupabase } from "@/lib/supabase";
import { getBooleanSetting } from "@/lib/settings";
import type { Charity, Referral } from "@/lib/supabase";
import CopyLink from "./CopyLink";

export const dynamic = "force-dynamic";

interface DashboardData {
  charity: Charity | null;
  referralCounts: {
    total: number;
    submitted: number;
    inProgress: number;
    completed: number;
    rewardIssued: number;
  };
  recentReferrals: Pick<
    Referral,
    "id" | "referred_name" | "status" | "submitted_at" | "invoice_total"
  >[];
}

async function getDashboardData(referrerId: string, charityId: string | null): Promise<DashboardData> {
  const supabase = getServerSupabase();

  const [{ data: charity }, { data: referrals }] = await Promise.all([
    charityId
      ? supabase.from("ref_charities").select("*").eq("id", charityId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("ref_referrals")
      .select("id, referred_name, status, submitted_at, invoice_total")
      .eq("referrer_id", referrerId)
      .order("submitted_at", { ascending: false })
      .limit(10),
  ]);

  const counts = {
    total: 0,
    submitted: 0,
    inProgress: 0,
    completed: 0,
    rewardIssued: 0,
  };
  for (const r of (referrals || []) as Pick<Referral, "status">[]) {
    counts.total++;
    if (r.status === "SUBMITTED") counts.submitted++;
    if (r.status === "BOOKED") counts.inProgress++;
    if (r.status === "COMPLETED") counts.completed++;
    if (r.status === "REWARD_ISSUED") counts.rewardIssued++;
  }

  return {
    charity: (charity as Charity) || null,
    referralCounts: counts,
    recentReferrals: (referrals || []) as DashboardData["recentReferrals"],
  };
}

export default async function DashboardPage() {
  const referrer = await getCurrentReferrer();
  if (!referrer) return null; // layout redirects

  const [{ charity, referralCounts, recentReferrals }, globalTripleWin] =
    await Promise.all([
      getDashboardData(referrer.id, referrer.selected_charity_id),
      getBooleanSetting("triple_win_enabled", true),
    ]);
  const tripleWinActive = globalTripleWin && !!referrer.selected_charity_id;

  return (
    <div className="max-w-5xl mx-auto">
      <section className="mb-10">
        <h1 className="text-4xl md:text-5xl mb-2">
          Welcome back, {referrer.first_name}.
        </h1>
        <p className="opacity-80">Here&apos;s your neighborhood impact.</p>
        {referrer.service_titan_id && (
          <p
            className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(97,139,96,0.12)",
              color: "var(--ca-dark-green)",
            }}
            title="We matched your enrollment to an existing Christmas Air customer record."
          >
            <span aria-hidden="true">✓</span>
            <span>Your Christmas Air account is connected</span>
          </p>
        )}
      </section>

      {/* Share link */}
      <section className="mb-10">
        <div className="card">
          <h2 className="text-2xl mb-1">Your referral link</h2>
          <p className="opacity-70 text-sm mb-4">
            Share this anywhere — text, email, social. Every booking through this
            link counts.
          </p>
          <CopyLink link={referrer.referral_link} />
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid gap-5 md:grid-cols-3 mb-10">
        <StatCard
          label="Total earned"
          value={`$${Number(referrer.total_earned).toFixed(0)}`}
          sub={`${referrer.lifetime_referrals} referral${referrer.lifetime_referrals === 1 ? "" : "s"} converted`}
        />
        <StatCard
          label="Referrals in flight"
          value={String(referralCounts.submitted + referralCounts.inProgress + referralCounts.completed)}
          sub={`${referralCounts.rewardIssued} completed`}
        />
        <ImpactCard
          tripleWin={tripleWinActive}
          charity={charity}
          totalDonated={Number(referrer.total_donated_on_their_behalf)}
        />
      </section>

      {/* Recent referrals */}
      <section>
        <h2 className="text-2xl mb-4">Recent referrals</h2>
        {recentReferrals.length === 0 ? (
          <div className="card text-center">
            <p className="opacity-70">
              No referrals yet. Share your link above to get started.
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--bg-muted)" }}>
                  <th className="text-left p-4 text-sm font-semibold">Name</th>
                  <th className="text-left p-4 text-sm font-semibold">Submitted</th>
                  <th className="text-left p-4 text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentReferrals.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <td className="p-4">{r.referred_name}</td>
                    <td className="p-4 opacity-70 text-sm">
                      {new Date(r.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
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

function ImpactCard({
  tripleWin,
  charity,
  totalDonated,
}: {
  tripleWin: boolean;
  charity: Charity | null;
  totalDonated: number;
}) {
  if (!tripleWin || !charity) {
    return (
      <div
        className="card"
        style={{
          background: "rgba(97,139,96,0.06)",
          borderColor: "var(--ca-green)",
        }}
      >
        <p className="text-sm uppercase tracking-wide opacity-60 mb-2">Triple Win</p>
        <p className="text-lg mb-3">
          {charity ? "Paused" : "Pick a charity"}
        </p>
        <p className="text-sm opacity-80 mb-3">
          {charity
            ? "Christmas Air has Triple Win paused right now. Your pick is saved."
            : "Choose a charity on the Your charity tab so your referrals trigger a matched donation."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        background: "rgba(97,139,96,0.08)",
        borderColor: "var(--ca-green)",
      }}
    >
      <p className="text-sm uppercase tracking-wide opacity-60 mb-2">Your impact</p>
      <p
        className="text-4xl mb-1"
        style={{
          fontFamily: "var(--font-lobster)",
          color: "var(--ca-dark-green)",
        }}
      >
        ${totalDonated.toFixed(0)}
      </p>
      <p className="text-sm">
        donated to <strong>{charity.name}</strong>
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    SUBMITTED: { bg: "rgba(184, 149, 107, 0.2)", fg: "#8a6a3a", label: "Submitted" },
    BOOKED: { bg: "rgba(59, 130, 246, 0.15)", fg: "#1e40af", label: "Booked" },
    COMPLETED: { bg: "rgba(97, 139, 96, 0.15)", fg: "#415440", label: "Completed" },
    REWARD_ISSUED: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", label: "Reward issued" },
    EXPIRED: { bg: "rgba(135, 76, 59, 0.1)", fg: "#874c3b", label: "Expired" },
    INELIGIBLE: { bg: "rgba(0,0,0,0.05)", fg: "#6b7280", label: "Ineligible" },
  };
  const s = styles[status] || styles.SUBMITTED;
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
