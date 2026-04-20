import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
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
  const { data: referrer } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("referral_code", code)
    .eq("is_active", true)
    .single();

  if (!referrer) return null;

  let charity: Charity | null = null;
  if (referrer.triple_win_enabled && referrer.selected_charity_id) {
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
        className="px-6 py-4"
        style={{
          background: "var(--ca-cream)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-4xl mx-auto">
          <p
            className="text-xl"
            style={{
              fontFamily: "var(--font-lobster)",
              color: "var(--ca-dark-green)",
            }}
          >
            Christmas Air
          </p>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-12 pb-6 md:pt-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-2 mb-5">
            <span className="badge-trust">Veteran-Owned</span>
            <span className="badge-trust">Locally-Owned</span>
          </div>
          <h1 className="text-4xl md:text-6xl mb-6 leading-tight">
            {referrer.first_name}{" "}says we&apos;re worth a call.
          </h1>
          <p className="text-lg md:text-xl opacity-80 max-w-xl mx-auto">
            {referrer.first_name} {referrer.last_name.slice(0, 1)}. trusts
            Christmas Air for their HVAC and plumbing. Let&apos;s make sure you do
            too.
          </p>
        </div>
      </section>

      {/* Triple Win banner — only if active */}
      {charity && (
        <section className="px-6 py-8">
          <div
            className="max-w-3xl mx-auto p-6 rounded-2xl"
            style={{
              background: "rgba(97,139,96,0.08)",
              border: "1px solid var(--ca-green)",
            }}
          >
            <p className="text-sm uppercase tracking-wide font-semibold opacity-70 mb-2">
              Triple Win
            </p>
            <p className="text-lg">
              When we complete your service, we&apos;re also making a donation to{" "}
              <strong>{charity.name}</strong> in {referrer.first_name}&apos;s
              honor.
            </p>
            <p className="text-sm opacity-80 mt-2">
              You save. {referrer.first_name}{" "}gets thanked. A cause they care
              about gets help. That&apos;s Triple Win.
            </p>
          </div>
        </section>
      )}

      {/* Form */}
      <section className="px-6 py-10">
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
