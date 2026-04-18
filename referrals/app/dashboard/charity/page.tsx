import { redirect } from "next/navigation";
import { getCurrentReferrer } from "@/lib/customer-auth";
import { getServerSupabase } from "@/lib/supabase";
import type { Charity } from "@/lib/supabase";
import CharityForm from "./CharityForm";

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

export default async function CharityPage() {
  const referrer = await getCurrentReferrer();
  if (!referrer) redirect("/sign-in");

  const charities = await getActiveCharities();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl mb-2">Triple Win</h1>
      <p className="opacity-80 mb-8">
        When this is on, every successful referral also triggers a donation
        from Christmas Air to your chosen charity. You keep your full reward.
      </p>

      <div className="card mb-6" style={{ background: "rgba(97,139,96,0.06)" }}>
        <p className="text-sm uppercase tracking-wide opacity-60 mb-2">
          Your impact so far
        </p>
        <p
          className="text-4xl"
          style={{
            fontFamily: "var(--font-lobster)",
            color: "var(--ca-dark-green)",
          }}
        >
          ${Number(referrer.total_donated_on_their_behalf).toFixed(0)}
        </p>
        <p className="text-sm opacity-80 mt-1">donated on your behalf</p>
      </div>

      <CharityForm
        initialEnabled={referrer.triple_win_enabled}
        initialCharityId={referrer.selected_charity_id}
        charities={charities}
      />
    </div>
  );
}
