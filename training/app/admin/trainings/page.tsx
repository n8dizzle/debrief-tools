import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Training { id: string; title: string; status: string; created_at: string; }

// Trainings list. The create/edit builder + assign flow is the next slice; for now
// this shows what exists (empty until you create one).
export default async function TrainingsPage() {
  let trainings: Training[] = [];
  let loadErr: string | null = null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("train_trainings")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false });
    if (error) loadErr = error.message;
    else trainings = (data ?? []) as Training[];
  } catch (e) {
    loadErr = e instanceof Error ? e.message : "load failed";
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Trainings</h1>
        <Link href="/admin/trainings/new" style={{ padding: "10px 18px", borderRadius: 10, background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 700, textDecoration: "none" }}>+ New training</Link>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        A training is an ordered set of steps (video, document, quiz) you text to techs.
      </p>
      {loadErr && <p style={{ color: "var(--status-error)", marginBottom: 16 }}>Couldn&apos;t load: {loadErr}</p>}
      {trainings.length === 0 ? (
        <div style={{ border: "1px dashed var(--border-default)", borderRadius: 12, padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: 40 }}>📋</div>
          <p style={{ marginTop: 8 }}>No trainings yet.</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            The training builder (create steps + assign + text) is being built next.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--bg-secondary)" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>Title</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>Status</th>
            </tr></thead>
            <tbody>
              {trainings.map((t) => (
                <tr key={t.id}>
                  <td style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle)" }}>
                    <Link href={`/admin/trainings/${t.id}`} style={{ color: "var(--christmas-green-light)", textDecoration: "none", fontWeight: 600 }}>{t.title}</Link>
                  </td>
                  <td style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
