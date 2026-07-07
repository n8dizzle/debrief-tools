import { getServerSupabase, type SpikeTap } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// SSO-gated (middleware). Manager view of the Phase 0 spike funnel: how many texts
// were accepted, tapped, and completed. Reads Supabase directly.
export default async function SpikeResultsPage() {
  let rows: SpikeTap[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("spike_taps")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) loadError = error.message;
    else rows = (data ?? []) as SpikeTap[];
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  const accepted = rows.filter((r) => r.send_status === "accepted").length;
  const failed = rows.filter((r) => r.send_status === "failed").length;
  const tapped = rows.filter((r) => r.tapped_at).length;
  const completed = rows.filter((r) => r.completed_at).length;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  const stat = (label: string, value: string) => (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: 16,
        minWidth: 130,
        flex: "1 1 130px",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "—";

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Phase 0 Spike Results</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Deliverability + tap-through test. Rates are of accepted sends. All times Central.
      </p>

      {loadError && (
        <p style={{ color: "var(--status-error)", marginBottom: 16 }}>
          Couldn&apos;t load results: {loadError} (is the migration applied + Supabase env set?)
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {stat("Sent (accepted)", String(accepted))}
        {stat("Send failed", String(failed))}
        {stat("Tapped", `${tapped} (${pct(tapped, accepted)}%)`)}
        {stat("Completed", `${completed} (${pct(completed, accepted)}%)`)}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>Tech</th>
              <th style={{ padding: "10px 12px" }}>Phone</th>
              <th style={{ padding: "10px 12px" }}>Send</th>
              <th style={{ padding: "10px 12px" }}>Tapped</th>
              <th style={{ padding: "10px 12px" }}>Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: "var(--text-muted)" }}>
                  No sends yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "10px 12px" }}>{r.tech_name || "—"}</td>
                <td style={{ padding: "10px 12px" }}>{r.phone || "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ color: r.send_status === "failed" ? "var(--status-error)" : "var(--text-secondary)" }}>
                    {r.send_status || "—"}
                    {r.send_error ? ` (${r.send_error})` : ""}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>{fmt(r.tapped_at)}</td>
                <td style={{ padding: "10px 12px" }}>{fmt(r.completed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
