import { getServerSupabase } from "@/lib/supabase";
import type { Charity } from "@/lib/supabase";
import CharitiesEditor from "./CharitiesEditor";

export const dynamic = "force-dynamic";

async function getAllCharities(): Promise<Charity[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_charities")
    .select("*")
    .order("is_active", { ascending: false })
    .order("display_order", { ascending: true });
  return (data as Charity[]) || [];
}

export default async function CharitiesPage() {
  const charities = await getAllCharities();
  return (
    <div>
      <h1 className="text-4xl mb-2">Charities</h1>
      <p className="opacity-70 mb-6">
        Triple Win partners. Add, edit, deactivate, reorder.
      </p>
      <CharitiesEditor initial={charities} />
    </div>
  );
}
