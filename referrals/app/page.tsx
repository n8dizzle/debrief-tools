import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  getCurrentProgram,
  BASELINE_PROGRAM,
} from "@/lib/rewards/public-display";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const program = (await getCurrentProgram()) ?? BASELINE_PROGRAM;

  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="px-4 md:px-6 pt-12 pb-16 md:pt-24 md:pb-28">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="badge-trust">Veteran-Owned</span>
            <span className="badge-trust">Locally-Owned since day one</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl mb-6 leading-tight">
            Neighbors helping neighbors.
          </h1>
          <p className="text-base md:text-xl max-w-2xl mx-auto opacity-80">
            You&apos;ve trusted us with your home. Tell your friends, and we&apos;ll
            say thanks in a big way — for you, for them, and for a cause you
            care about.
          </p>
          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 justify-center">
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
      <section className="section-white px-4 md:px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl text-center mb-10 md:mb-14">
            Three simple steps.
          </h2>
          <div className="grid gap-6 md:gap-8 md:grid-cols-3">
            <StepCard
              n="1"
              title="Join in two minutes"
              body="Tell us who you are. We'll match you to your Christmas Air account and send you your personal referral link."
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

      {/* Triple Win amounts — the three-way equation */}
      <section className="section-cream px-4 md:px-6 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl text-center mb-4">
            What&apos;s the reward?
          </h2>
          <p className="text-center text-base md:text-lg opacity-80 max-w-2xl mx-auto mb-10 md:mb-12">
            Three wins, every time. Simple.
          </p>
          <div className="grid gap-4 md:gap-5 md:grid-cols-3">
            <AmountCard
              label="You earn"
              amount={program.referrer_amount}
              sub="Gift card of your choice — Amazon, Target, Visa, and more."
            />
            <AmountCard
              label="Your friend gets"
              amount={program.friend_amount}
              sub="Gift card of their choice too — our thank-you for coming in on your word."
              highlight
            />
            <AmountCard
              label="We donate"
              amount={program.charity_amount}
              sub="To a charity you picked. On us — not taken from your reward."
            />
          </div>
          <p className="text-center text-sm opacity-60 mt-6">
            Every completed referral triggers all three. Amounts subject to
            change.
          </p>
        </div>
      </section>

      {/* Triple Win teaser */}
      <section className="section-green px-4 md:px-6 py-14 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl mb-5 md:mb-6">
            Every referral is a Triple Win.
          </h2>
          <p className="text-base md:text-xl opacity-90 max-w-2xl mx-auto mb-6 md:mb-8">
            You get your gift card. Your friend gets theirs. And we donate to a
            charity you picked — all three, every time, at no cost to you.
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
      <section className="px-4 md:px-6 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl mb-4">Ready when you are.</h2>
          <p className="text-base md:text-lg opacity-80 mb-6 md:mb-8">
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

function AmountCard({
  label,
  amount,
  sub,
  highlight,
}: {
  label: string;
  amount: number;
  sub: string;
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
      <p className="text-sm uppercase tracking-wide opacity-60 mb-2">{label}</p>
      <p
        className="text-5xl mb-3"
        style={{
          fontFamily: "var(--font-lobster)",
          color: "var(--ca-dark-green)",
        }}
      >
        ${amount}
      </p>
      <p className="text-sm opacity-80">{sub}</p>
    </div>
  );
}
