import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import { getBooleanSetting } from "@/lib/settings";
import type { Charity, Referrer } from "@/lib/supabase";
import SiteFooter from "@/components/SiteFooter";
import ReferralForm from "./ReferralForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

async function getReferrerData(code: string): Promise<{
  referrer: Referrer;
  charity: Charity | null;
} | null> {
  const supabase = getServerSupabase();
  const [referrerResult, globalTripleWin] = await Promise.all([
    supabase
      .from("ref_referrers")
      .select("*")
      .eq("referral_code", code)
      .eq("is_active", true)
      .single(),
    getBooleanSetting("triple_win_enabled", true),
  ]);

  const referrer = referrerResult.data;
  if (!referrer) return null;

  let charity: Charity | null = null;
  if (globalTripleWin && referrer.selected_charity_id) {
    const { data } = await supabase
      .from("ref_charities")
      .select("*")
      .eq("id", referrer.selected_charity_id)
      .single();
    charity = (data as Charity) || null;
  }

  return { referrer: referrer as Referrer, charity };
}

export default async function ReferPage({ params }: PageProps) {
  const { code } = await params;
  const data = await getReferrerData(code);
  if (!data) notFound();

  const { referrer, charity } = data;

  return (
    <>
      {/* Minimal, focused header — no top nav, we want conversion focus */}
      <header
        className="px-4 md:px-6 py-3"
        style={{
          background: "var(--ca-cream)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <Image
            src="/logo.png"
            alt="Christmas Air Conditioning & Plumbing"
            width={300}
            height={200}
            priority
            className="h-16 md:h-20"
            style={{ width: "auto" }}
          />
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 md:px-6 pt-8 md:pt-16 pb-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            <span className="badge-trust">Veteran-Owned</span>
            <span className="badge-trust">Locally-Owned</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl mb-5 md:mb-6 leading-tight">
            {referrer.first_name}{" "}says we&apos;re worth a call.
          </h1>
          <p className="text-base md:text-xl opacity-80 max-w-xl mx-auto">
            No pressure, no hard sell &mdash; just a neighbor&apos;s
            introduction.
          </p>
        </div>
      </section>

      {/* Referral voice card — gives the personal referral moment its own
          beat before the form. Falls back to generic copy today; if/when
          the referrer dashboard supports a custom note, it can replace the
          body copy here. */}
      <section className="px-4 md:px-6 pt-2 pb-2">
        <div
          className="max-w-3xl mx-auto p-5 md:p-6 rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="text-xs uppercase tracking-wide font-semibold opacity-60 mb-2">
            Why {referrer.first_name} sent you here
          </p>
          <p className="text-base leading-relaxed">
            {referrer.first_name} {referrer.last_name.slice(0, 1)}. trusts
            Christmas Air for their HVAC and plumbing &mdash; and thought you
            might want someone local you can trust too. We&apos;d love to earn
            that same trust with you, whenever you&apos;re ready.
          </p>
        </div>
      </section>

      {/* Triple Win banner — only if active */}
      {charity && (
        <section className="px-4 md:px-6 py-6 md:py-8">
          <div
            className="max-w-3xl mx-auto p-5 md:p-6 rounded-2xl"
            style={{
              background: "rgba(97,139,96,0.08)",
              border: "1px solid var(--ca-green)",
            }}
          >
            <p className="text-sm uppercase tracking-wide font-semibold opacity-70 mb-2">
              The Triple Win
            </p>
            <p className="text-base md:text-lg">
              When you hire us, we make a donation to{" "}
              <strong>{charity.name}</strong> in {referrer.first_name}&apos;s
              honor &mdash; on top of their thank-you, not instead of it.
            </p>
            <p className="text-sm opacity-80 mt-2">
              You save. {referrer.first_name}{" "}gets thanked. A cause they care
              about gets help.
            </p>
          </div>
        </section>
      )}

      {/* Form */}
      <section className="px-4 md:px-6 py-8 md:py-10">
        <ReferralForm
          referralCode={referrer.referral_code}
          referrerFirstName={referrer.first_name}
          tripleWinCharityName={charity?.name || null}
        />
      </section>

      <SiteFooter />
    </>
  );
}
