import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";
import AssignPanel, { type RosterPerson } from "./AssignPanel";

export const dynamic = "force-dynamic";

export default async function TrainingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServerSupabase();

  const [{ data: training }, { data: steps }, { data: people }, { data: assignments }] = await Promise.all([
    supabase.from("train_trainings").select("id, title, description, status").eq("id", id).single(),
    supabase.from("train_steps").select("id, type, order_index").eq("training_id", id).order("order_index"),
    supabase.from("train_people").select("id, name, phone, source, title").eq("active", true).order("source").order("name"),
    supabase.from("train_assignments").select("person_id, status").eq("training_id", id),
  ]);

  if (!training) return <main style={{ padding: 24 }}><p>Training not found. <Link href="/admin/trainings" style={{ color: "var(--christmas-green-light)" }}>Back</Link></p></main>;

  const assignedMap = new Map((assignments || []).map((a) => [a.person_id, a.status]));
  const roster: RosterPerson[] = (people || []).map((p) => ({
    id: p.id, name: p.name, phone: p.phone, source: p.source, title: p.title,
    status: assignedMap.get(p.id) || null,
  }));
  const completed = (assignments || []).filter((a) => a.status === "completed").length;
  const total = (assignments || []).length;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <Link href="/admin/trainings" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>← Trainings</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 4px" }}>{training.title}</h1>
      {training.description && <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>{training.description}</p>}
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        {(steps || []).length} step(s): {(steps || []).map((s) => s.type).join(" → ") || "none"} · status: {training.status}
        {total > 0 && <> · {completed}/{total} completed</>}
      </div>

      <AssignPanel trainingId={id} roster={roster} />
    </main>
  );
}
