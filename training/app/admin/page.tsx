import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Admin home — live counts so managers see the system is real and populated.
export default async function AdminHome() {
  let techs = 0, office = 0, textable = 0, trainings = 0, loadErr: string | null = null;
  try {
    const supabase = getServerSupabase();
    const [t, o, ph, tr] = await Promise.all([
      supabase.from("train_people").select("id", { count: "exact", head: true }).eq("source", "servicetitan").eq("active", true),
      supabase.from("train_people").select("id", { count: "exact", head: true }).eq("source", "portal").eq("active", true),
      supabase.from("train_people").select("id", { count: "exact", head: true }).eq("active", true).not("phone", "is", null),
      supabase.from("train_trainings").select("id", { count: "exact", head: true }),
    ]);
    techs = t.count || 0; office = o.count || 0; textable = ph.count || 0; trainings = tr.count || 0;
  } catch (e) {
    loadErr = e instanceof Error ? e.message : "load failed";
  }

  const card = (label: string, value: string, href?: string, sub?: string) => {
    const inner = (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 20, minWidth: 160, flex: "1 1 160px" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>}
      </div>
    );
    return href ? <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "contents" }}>{inner}</Link> : inner;
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Training Admin</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Assign training by text. Techs do it on their phone — no login.
      </p>
      {loadErr && <p style={{ color: "var(--status-error)", marginBottom: 16 }}>Couldn&apos;t load counts: {loadErr}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {card("Technicians", String(techs), "/admin/roster", `${textable} textable`)}
        {card("Office / staff", String(office), "/admin/roster")}
        {card("Trainings", String(trainings), "/admin/trainings")}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/admin/roster" style={btn}>View roster</Link>
        <Link href="/admin/trainings" style={btnOutline}>Trainings</Link>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = { padding: "12px 20px", borderRadius: 10, background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 600, fontSize: 15, textDecoration: "none" };
const btnOutline: React.CSSProperties = { padding: "12px 20px", borderRadius: 10, border: "1px solid var(--border-default)", color: "var(--text-primary)", fontWeight: 600, fontSize: 15, textDecoration: "none" };
