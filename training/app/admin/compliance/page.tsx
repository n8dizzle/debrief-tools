import { getServerSupabase } from "@/lib/supabase";
import ComplianceView, { type Assignment } from "./ComplianceView";

export const dynamic = "force-dynamic";

interface Raw {
  id: string; status: string; assigned_at: string | null; due_at: string | null; completed_at: string | null;
  person: { name: string; phone: string | null } | null;
  training: { title: string } | null;
}

export default async function CompliancePage() {
  let rows: Assignment[] = [];
  let loadErr: string | null = null;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("train_assignments")
      .select("id, status, assigned_at, due_at, completed_at, person:train_people(name, phone), training:train_trainings(title)")
      .neq("status", "revoked")
      .order("assigned_at", { ascending: false });
    if (error) loadErr = error.message;
    else {
      const now = Date.now();
      rows = ((data ?? []) as unknown as Raw[]).map((r) => {
        const overdue = r.status !== "completed" && r.due_at != null && new Date(r.due_at).getTime() < now;
        return {
          id: r.id,
          person_name: r.person?.name || "—",
          phone: r.person?.phone || null,
          training_title: r.training?.title || "—",
          status: r.status === "completed" ? "completed" : overdue ? "overdue" : r.status,
          assigned_at: r.assigned_at,
          due_at: r.due_at,
          completed_at: r.completed_at,
        };
      });
    }
  } catch (e) {
    loadErr = e instanceof Error ? e.message : "load failed";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Compliance</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Every assignment and where it stands. Completion is self-attested (techs tap their link) until signature steps ship.
      </p>
      {loadErr && <p style={{ color: "var(--status-error)", marginBottom: 16 }}>Couldn&apos;t load: {loadErr}</p>}
      <ComplianceView rows={rows} />
    </main>
  );
}
