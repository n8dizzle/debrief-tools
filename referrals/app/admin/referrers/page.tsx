import { getServerSupabase } from "@/lib/supabase";
import type { Charity, Referrer } from "@/lib/supabase";
import SyncTechsButton from "./SyncTechsButton";
import ReferrersTable, { type ReferrerRow } from "./ReferrersTable";

export const dynamic = "force-dynamic";

async function getReferrers(): Promise<ReferrerRow[]> {
  const supabase = getServerSupabase();
  const [{ data: referrers }, { data: charities }] = await Promise.all([
    supabase
      .from("ref_referrers")
      .select("*")
      .order("enrolled_at", { ascending: false })
      .limit(200),
    supabase.from("ref_charities").select("id, name"),
  ]);

  const charityById = new Map<string, Pick<Charity, "id" | "name">>();
  for (const c of (charities as Charity[]) || []) {
    charityById.set(c.id, { id: c.id, name: c.name });
  }

  return ((referrers as Referrer[]) || []).map((r) => ({
    ...r,
    charity: r.selected_charity_id
      ? charityById.get(r.selected_charity_id) ?? null
      : null,
  }));
}

export default async function ReferrersPage() {
  const referrers = await getReferrers();

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl mb-2">Referrers</h1>
          <p className="opacity-70">
            {referrers.length} enrolled (showing most recent 200)
          </p>
        </div>
        <SyncTechsButton />
      </div>

      <ReferrersTable rows={referrers} />
    </div>
  );
}
