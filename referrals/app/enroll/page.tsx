import { getServerSupabase } from "@/lib/supabase";
import type { Charity } from "@/lib/supabase";
import { getBooleanSetting } from "@/lib/settings";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import EnrollForm from "./EnrollForm";

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

export default async function EnrollPage() {
  const [charities, tripleWinEnabled] = await Promise.all([
    getActiveCharities(),
    getBooleanSetting("triple_win_enabled", true),
  ]);

  return (
    <>
      <SiteHeader />
      <section className="px-4 md:px-6 pt-10 md:pt-16 pb-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl mb-4 leading-tight">Join the program.</h1>
          <p className="text-base md:text-lg opacity-80">
            Two minutes. No obligations. Free to leave any time.
          </p>
        </div>
      </section>
      <section className="px-4 md:px-6 pb-20 md:pb-24">
        <EnrollForm charities={charities} tripleWinEnabled={tripleWinEnabled} />
      </section>
      <SiteFooter />
    </>
  );
}
