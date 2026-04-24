import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import {
  getCurrentProgram,
  BASELINE_PROGRAM,
} from "@/lib/rewards/public-display";
import type { Charity } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

async function getActiveCharities(): Promise<Charity[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_charities")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  return (data as Charity[]) || [];
}

export default async function TripleWinPage() {
  const [charities, program] = await Promise.all([
    getActiveCharities(),
    getCurrentProgram(),
  ]);
  const p = program ?? BASELINE_PROGRAM;

  return (
    <>
      <SiteHeader />

      <section className="px-4 md:px-6 pt-12 md:pt-24 pb-8 md:pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <span className="badge-trust mb-4">One referral. Three winners.</span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl mt-4 mb-5 md:mb-6 leading-tight">
            Triple Win
          </h1>
          <p className="text-base md:text-xl max-w-2xl mx-auto opacity-80">
            When you refer a neighbor, you get your reward, they get their
            discount, <em>and</em> we donate to a charity you choose. All three
            wins — every single time.
          </p>
        </div>
      </section>

      <section className="section-white px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid gap-6 md:gap-8 md:grid-cols-3">
            <WinCard
              n="1"
              title="You win"
              body={`$${p.referrer_amount} gift card for every completed referral. Pick from Amazon, Target, Visa, and more — your choice, delivered by email.`}
            />
            <WinCard
              n="2"
              title="They win"
              body={`Your friend gets a $${p.friend_amount} gift card too, their pick. A warm welcome, no coupon codes, no fine print.`}
            />
            <WinCard
              n="3"
              title="Your charity wins"
              body={`We donate $${p.charity_amount} to a cause you picked — on top of the gift cards, not taken from them.`}
            />
          </div>
        </div>
      </section>

      <section className="section-cream px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl text-center mb-4">
            The charities you can choose.
          </h2>
          <p className="text-center text-base md:text-lg opacity-80 max-w-2xl mx-auto mb-10 md:mb-12">
            Pick one at sign-up. Switch any time from your dashboard.
          </p>

          {charities.length === 0 ? (
            <p className="text-center opacity-60 italic">
              Charity list coming soon.
            </p>
          ) : (
            <div className="grid gap-4 md:gap-5 md:grid-cols-2">
              {charities.map((c) => (
                <div key={c.id} className="card">
                  <h3 className="text-2xl mb-2">{c.name}</h3>
                  <p className="opacity-80 text-sm leading-relaxed">
                    {c.description}
                  </p>
                  {c.website_url && (
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-sm font-semibold"
                    >
                      Learn more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-green px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl text-center mb-6 md:mb-8">
            The fine print, plain-spoken.
          </h2>
          <div className="space-y-4 md:space-y-5 text-base md:text-lg opacity-90">
            <p>
              <strong>You keep your full reward.</strong> The charity donation
              comes from us, not your thank-you. This is a <em>Triple</em> Win,
              not a swap.
            </p>
            <p>
              <strong>You pick the charity at sign-up — and it stays in your
              hands.</strong> Switch your choice any time from your dashboard.
              The charity attached to each referral is locked in when the
              referral is submitted, so changes don&apos;t disturb in-flight
              referrals.
            </p>
            <p>
              <strong>Every referral is a flat ${p.referrer_amount} /
              ${p.friend_amount} / ${p.charity_amount}.</strong> Service call,
              water heater install, furnace replacement — same three-way win
              every time. Simple.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 md:px-6 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl mb-4">Ready to join?</h2>
          <p className="text-lg opacity-80 mb-8">
            Sign up in two minutes. Pick your charity. Share your link.
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

function WinCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
        style={{
          background: "var(--ca-green)",
          color: "var(--ca-cream)",
          fontFamily: "var(--font-lobster)",
        }}
      >
        {n}
      </div>
      <h3 className="text-2xl mb-3">{title}</h3>
      <p className="opacity-80 leading-relaxed">{body}</p>
    </div>
  );
}
