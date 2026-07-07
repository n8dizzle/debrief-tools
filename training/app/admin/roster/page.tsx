import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Person {
  id: string; source: string; name: string; phone: string | null;
  email: string | null; title: string | null; active: boolean;
}

// Roster view — the people synced from ServiceTitan (technicians) + portal_users
// (office/staff). This is who you can assign training to.
export default async function RosterPage() {
  let people: Person[] = [];
  let loadErr: string | null = null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("train_people")
      .select("id, source, name, phone, email, title, active")
      .order("active", { ascending: false })
      .order("source", { ascending: true })
      .order("name", { ascending: true });
    if (error) loadErr = error.message;
    else people = (data ?? []) as Person[];
  } catch (e) {
    loadErr = e instanceof Error ? e.message : "load failed";
  }

  const techs = people.filter((p) => p.source === "servicetitan");
  const office = people.filter((p) => p.source === "portal");
  const noPhone = techs.filter((p) => p.active && !p.phone).length;

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 14, borderTop: "1px solid var(--border-subtle)" };

  const table = (title: string, rows: Person[], showPhone: boolean) => (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{title} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({rows.length})</span></h2>
      <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead><tr style={{ background: "var(--bg-secondary)" }}>
            <th style={th}>Name</th>
            {showPhone ? <th style={th}>Cell</th> : <th style={th}>Email</th>}
            <th style={th}>{showPhone ? "Role/BU" : "Role"}</th>
            <th style={th}>Status</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td style={td} colSpan={4}>None.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.name}</td>
                <td style={{ ...td, color: showPhone && !p.phone ? "var(--status-warning)" : undefined }}>
                  {showPhone ? (p.phone || "⚠ no number") : (p.email || "—")}
                </td>
                <td style={td}>{p.title || "—"}</td>
                <td style={{ ...td, color: p.active ? "var(--status-success)" : "var(--text-muted)" }}>{p.active ? "active" : "inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Roster</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 8 }}>
        Synced daily from ServiceTitan + the portal. {noPhone > 0 ? `${noPhone} tech(s) missing a cell number.` : "Every active tech has a cell number."}
      </p>
      {loadErr && <p style={{ color: "var(--status-error)", marginBottom: 16 }}>Couldn&apos;t load roster: {loadErr}</p>}
      {table("Technicians", techs, true)}
      {table("Office / staff", office, false)}
    </main>
  );
}
