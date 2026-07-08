import Link from "next/link";
import { getCurrentTech } from "@/lib/tech-auth";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Row {
  id: string; status: string;
  training: { title: string; description: string | null } | null;
}

// Tech training inbox — everything they owe. Self-guarded by the session cookie set
// when they tapped their texted link. No account, no password.
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  const tech = await getCurrentTech();

  const wrap: React.CSSProperties = { minHeight: "100dvh", padding: 16, maxWidth: 520, margin: "0 auto" };

  if (!tech) {
    return (
      <main style={{ ...wrap, display: "grid", placeItems: "center" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>📱</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "10px 0 8px" }}>
            {expired ? "That link expired" : "Open your training link"}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            Tap the training link we texted you to get started. If it&apos;s old, ask your manager to resend.
          </p>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("train_assignments")
    .select("id, status, training:train_trainings(title, description)")
    .eq("person_id", tech.id)
    .neq("status", "revoked")
    .order("status", { ascending: true });
  const rows = ((data ?? []) as unknown as Row[]);

  const pending = rows.filter((r) => r.status !== "completed");
  const done = rows.filter((r) => r.status === "completed");

  return (
    <main style={wrap}>
      <div style={{ fontSize: 13, color: "var(--christmas-green-light)", fontWeight: 700, letterSpacing: 0.4 }}>CHRISTMAS AIR TRAINING</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 4px" }}>Hi {tech.name.split(" ")[0]} 👋</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        {pending.length ? `You have ${pending.length} training${pending.length > 1 ? "s" : ""} to do.` : "You're all caught up. 🎉"}
      </p>

      {pending.map((r) => (
        <Link key={r.id} href={`/inbox/${r.id}`} style={cardLink}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.training?.title || "Training"}</div>
            {r.training?.description && <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{r.training.description}</div>}
          </div>
          <span style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)", padding: "8px 14px", borderRadius: 8, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
            {r.status === "in_progress" ? "Continue" : "Start"}
          </span>
        </Link>
      ))}

      {done.length > 0 && (
        <>
          <div style={{ marginTop: 24, marginBottom: 8, fontSize: 13, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Completed</div>
          {done.map((r) => (
            <div key={r.id} style={{ ...cardLink, cursor: "default", opacity: 0.7 }}>
              <div style={{ fontWeight: 600 }}>{r.training?.title || "Training"}</div>
              <span style={{ color: "var(--status-success)", fontWeight: 700 }}>✓ Done</span>
            </div>
          ))}
        </>
      )}
    </main>
  );
}

const cardLink: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12,
  padding: 16, marginBottom: 10, textDecoration: "none", color: "inherit",
};
