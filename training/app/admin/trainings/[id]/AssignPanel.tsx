"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface RosterPerson {
  id: string; name: string; phone: string | null;
  source: string; title: string | null; status: string | null;
}

export default function AssignPanel({ trainingId, roster }: { trainingId: string; roster: RosterPerson[] }) {
  const router = useRouter();
  const techs = roster.filter((p) => p.source === "servicetitan");
  const office = roster.filter((p) => p.source === "portal");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllTechs = () => setSelected(new Set(techs.filter((t) => t.phone).map((t) => t.id)));
  const clear = () => setSelected(new Set());

  async function assign() {
    if (!selected.size) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin/assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ training_id: trainingId, person_ids: [...selected], notify: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setResult(`Error: ${data.error || "failed"}`); }
      else {
        setResult(`✓ Assigned ${data.assigned}, texted ${data.texted}${data.skipped ? `, skipped ${data.skipped}` : ""}.${data.issues?.length ? " (" + data.issues.join("; ") + ")" : ""}`);
        setSelected(new Set());
        router.refresh();
      }
    } catch { setResult("Network error"); }
    finally { setBusy(false); }
  }

  const row = (p: RosterPerson) => {
    const already = p.status && p.status !== "revoked";
    return (
      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: "1px solid var(--border-subtle)", opacity: !p.phone && p.source === "servicetitan" ? 0.5 : 1 }}>
        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={!p.phone && p.source === "servicetitan"} style={{ width: 16, height: 16 }} />
        <span style={{ flex: 1 }}>{p.name} {p.title ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {p.title}</span> : null}</span>
        {!p.phone && p.source === "servicetitan" && <span style={{ color: "var(--status-warning)", fontSize: 12 }}>no #</span>}
        {already && <span style={{ color: p.status === "completed" ? "var(--status-success)" : "var(--text-secondary)", fontSize: 12 }}>{p.status === "completed" ? "✓ done" : p.status}</span>}
      </label>
    );
  };

  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: "var(--bg-secondary)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong>Assign & text</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={selectAllTechs} style={miniBtn}>All techs</button>
          <button onClick={clear} style={miniBtn}>Clear</button>
        </div>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Technicians</div>
        {techs.map(row)}
        <div style={{ padding: "12px 12px 4px", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>Office / staff</div>
        {office.map(row)}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={assign} disabled={busy || !selected.size} style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: "var(--christmas-green)", color: "var(--christmas-cream)", fontWeight: 700, cursor: busy || !selected.size ? "default" : "pointer", opacity: busy || !selected.size ? 0.5 : 1 }}>
          {busy ? "Sending…" : `Assign & text ${selected.size || ""}`}
        </button>
        {result && <span style={{ fontSize: 14, color: result.startsWith("Error") ? "var(--status-error)" : "var(--status-success)" }}>{result}</span>}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" };
