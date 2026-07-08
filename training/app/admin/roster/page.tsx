import { getServerSupabase } from "@/lib/supabase";
import RosterTables, { type Person } from "./RosterTables";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  let people: Person[] = [];
  let loadErr: string | null = null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("train_people")
      .select("id, source, name, phone, email, title, active")
      .order("name", { ascending: true });
    if (error) loadErr = error.message;
    else people = (data ?? []) as Person[];
  } catch (e) {
    loadErr = e instanceof Error ? e.message : "load failed";
  }

  const techs = people.filter((p) => p.source === "servicetitan");
  const office = people.filter((p) => p.source === "portal");
  const noPhone = techs.filter((p) => p.active && !p.phone).length;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Roster</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Synced daily from ServiceTitan + the portal. {noPhone > 0 ? `${noPhone} tech(s) missing a cell number.` : "Every active tech has a cell number."}
      </p>
      {loadErr && <p style={{ color: "var(--status-error)", marginBottom: 16 }}>Couldn&apos;t load roster: {loadErr}</p>}
      <RosterTables techs={techs} office={office} />
    </main>
  );
}
