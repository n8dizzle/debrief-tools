import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const fmt = (t: string | null) => (t ? new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: person } = await supabase
    .from("train_people").select("id, name, phone, email, title, source, active").eq("id", id).single();
  if (!person) return <main style={{ padding: 24 }}><p>Person not found. <Link href="/admin/roster">Back</Link></p></main>;

  const { data: assignments } = await supabase
    .from("train_assignments")
    .select("id, status, assigned_at, due_at, completed_at, training:train_trainings(id, title)")
    .eq("person_id", id).neq("status", "revoked").order("assigned_at", { ascending: false });

  type A = { id: string; status: string; assigned_at: string | null; due_at: string | null; completed_at: string | null; training: { id: string; title: string } | null };
  const asg = (assignments || []) as unknown as A[];
  const trainingIds = [...new Set(asg.map((a) => a.training?.id).filter(Boolean))] as string[];
  const asgIds = asg.map((a) => a.id);

  const { data: steps } = trainingIds.length
    ? await supabase.from("train_steps").select("id, training_id, type, order_index").in("training_id", trainingIds).order("order_index")
    : { data: [] };
  const { data: comps } = asgIds.length
    ? await supabase.from("train_step_completions").select("assignment_id, step_id, quiz_score, watch_pct, verified_via, signature_typed_name, signature_image_url, completed_at, from_phone, ip").in("assignment_id", asgIds)
    : { data: [] };

  type Step = { id: string; training_id: string; type: string; order_index: number };
  type Comp = { assignment_id: string; step_id: string; quiz_score: number | null; watch_pct: number | null; verified_via: string; signature_typed_name: string | null; signature_image_url: string | null; completed_at: string; from_phone: string | null; ip: string | null };
  const stepsByTraining = new Map<string, Step[]>();
  for (const s of (steps || []) as Step[]) { const a = stepsByTraining.get(s.training_id) || []; a.push(s); stepsByTraining.set(s.training_id, a); }
  const compByKey = new Map<string, Comp>();
  for (const c of (comps || []) as Comp[]) compByKey.set(`${c.assignment_id}:${c.step_id}`, c);

  const statusBadge = (s: string) => {
    const cls = s === "completed" ? "badge-current" : s === "in_progress" ? "badge-info" : "badge-muted";
    return <span className={`badge ${cls}`}>{s.replace("_", " ")}</span>;
  };

  return (
    <main style={{ maxWidth: 820, margin: "0 auto" }}>
      <Link href="/admin/roster" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>← Roster</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 2px" }}>{person.name}</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        {person.title || (person.source === "servicetitan" ? "Technician" : "Staff")} · {person.phone || person.email || "no contact"} · {person.active ? "active" : "inactive"}
      </p>

      {asg.length === 0 && <p style={{ color: "var(--text-muted)" }}>No trainings assigned yet.</p>}

      {asg.map((a) => {
        const tSteps = a.training ? stepsByTraining.get(a.training.id) || [] : [];
        return (
          <div key={a.id} className="card" style={{ marginBottom: 16, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <strong style={{ fontSize: 16 }}>{a.training?.title || "Training"}</strong>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {statusBadge(a.status)}
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>assigned {fmt(a.assigned_at)}{a.due_at ? ` · due ${fmt(a.due_at)}` : ""}</span>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tSteps.map((s) => {
                const c = compByKey.get(`${a.id}:${s.id}`);
                return (
                  <div key={s.id} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ textTransform: "capitalize" }}>{s.order_index + 1}. {s.type}</span>
                      <span style={{ color: c ? "var(--status-success)" : "var(--text-muted)" }}>{c ? `✓ ${fmt(c.completed_at)}` : "not done"}</span>
                    </div>
                    {c && s.type === "quiz" && <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Score: {c.quiz_score}%</div>}
                    {c && s.type === "signature" && (
                      <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                        <div>Signed by <strong style={{ color: "var(--text-primary)" }}>{c.signature_typed_name}</strong> · verified: {c.verified_via} · from {c.from_phone || "?"}{c.ip ? ` · IP ${c.ip}` : ""}</div>
                        {c.signature_image_url && <img src={c.signature_image_url} alt="signature" style={{ marginTop: 6, background: "#1C231E", border: "1px solid var(--border-default)", borderRadius: 8, maxWidth: 260, height: "auto" }} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
