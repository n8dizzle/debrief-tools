import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  getDefaultConfigTiers,
  formatTierReward,
} from "@/lib/rewards/public-display";
import type { RewardTier } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TierCardData = {
  label: string;
  reward: string;
  refereeBenefit: string;
  highlight?: boolean;
};

const FALLBACK_TIERS: TierCardData[] = [
  {
    label: "Service Call or Repair",
    reward: "$50",
    refereeBenefit: "$50 off their first service",
  },
  {
    label: "Maintenance Membership",
    reward: "$75",
    refereeBenefit: "First month free",
  },
  {
    label: "HVAC or Water Heater Replacement",
    reward: "$250 – $500",
    refereeBenefit: "$250 off their project",
    highlight: true,
  },
  {
    label: "Commercial Services",
    reward: "$500+",
    refereeBenefit: "Case-by-case benefit",
  },
];

function tierToCard(tier: RewardTier): TierCardData | null {
  const reward = formatTierReward(tier);
  if (!reward) return null;
  return {
    label: tier.service_category_label,
    reward,
    refereeBenefit: tier.referee_discount_label,
    highlight: tier.service_category === "REPLACEMENT",
  };
}

export default async function LandingPage() {
  const dbTiers = await getDefaultConfigTiers();
  const tierCards: TierCardData[] =
    dbTiers
      .map(tierToCard)
      .filter((c): c is TierCardData => c !== null);
  const tiers = tierCards.length > 0 ? tierCards : FALLBACK_TIERS;

  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex justify-center gap-2 mb-6">
            <span className="badge-trust">Veteran-Owned</span>
            <span className="badge-trust">Locally-Owned since day one</span>
          </div>
          <h1 className="text-5xl md:text-7xl mb-6">
            Neighbors helping neighbors.
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-80">
            You&apos;ve trusted us with your home. Tell your friends, and we&apos;ll
            say thanks in a big way — for you, for them, and for a cause you
            care about.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/enroll" className="btn btn-primary">
              Join the program
            </Link>
            <Link href="/triple-win" className="btn btn-secondary">
              Learn about Triple Win
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-center mb-14">
            Three simple steps.
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              n="1"
              title="Join in two minutes"
              body="Tell us who you are. We&apos;ll match you to your Christmas Air account and send you your personal referral link."
            />
            <StepCard
              n="2"
              title="Share with your neighbors"
              body="Text it, email it, post it. Anyone who books through your link counts as a referral."
            />
            <StepCard
              n="3"
              title="Get thanked when they book"
              body="Once the job is complete, we send you a reward — and we donate to the charity you picked, too."
            />
          </div>
        </div>
      </section>

      {/* Reward tiers */}
      <section className="section-cream px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl text-center mb-4">
            What&apos;s the reward?
          </h2>
          <p className="text-center text-lg opacity-80 max-w-2xl mx-auto mb-12">
            Bigger jobs, bigger thanks. Your friend saves too.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {tiers.map((t) => (
              <TierCard
                key={t.label}
                label={t.label}
                reward={t.reward}
                refereeBenefit={t.refereeBenefit}
                highlight={t.highlight}
              />
            ))}
          </div>
          <p className="text-center text-sm opacity-60 mt-6">
            Rewards issued as a Visa gift card, Amazon credit, or account credit — your choice.
          </p>
        </div>
      </section>

      {/* Triple Win teaser */}
      <section className="section-green px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-6">
            Every referral is a Triple Win.
          </h2>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto mb-8">
            You keep your full reward. Your friend gets their discount. And we
            donate to a charity you pick — at no cost to you.
          </p>
          <Link
            href="/triple-win"
            className="btn"
            style={{
              background: "var(--ca-cream)",
              color: "var(--ca-dark-green)",
            }}
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-4">Ready when you are.</h2>
          <p className="text-lg opacity-80 mb-8">
            Takes two minutes. No obligations. Free to leave any time.
          </p>
          <Link href="/enroll" className="btn btn-primary">
            Join the program
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-4"
        style={{
          background: "var(--ca-green)",
          color: "var(--ca-cream)",
          fontFamily: "var(--font-lobster)",
        }}
      >
        {n}
      </div>
      <h3 className="text-2xl mb-2">{title}</h3>
      <p className="opacity-80">{body}</p>
    </div>
  );
}

function TierCard({
  label,
  reward,
  refereeBenefit,
  highlight,
}: {
  label: string;
  reward: string;
  refereeBenefit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="card"
      style={
        highlight
          ? {
              borderColor: "var(--ca-green)",
              borderWidth: "2px",
              background: "rgba(97, 139, 96, 0.05)",
            }
          : {}
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide opacity-60 mb-1">
            {label}
          </p>
          <p
            className="text-3xl"
            style={{
              fontFamily: "var(--font-lobster)",
              color: "var(--ca-dark-green)",
            }}
          >
            {reward}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm opacity-80">
        Plus: <span className="font-semibold">{refereeBenefit}</span>
      </p>
    </div>
  );
}
