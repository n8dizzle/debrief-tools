"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/DataTable";

export interface Assignment {
  id: string; person_name: string; phone: string | null; training_title: string;
  status: string; assigned_at: string | null; due_at: string | null; completed_at: string | null;
}

const fmt = (t: string | null) => (t ? new Date(t).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" }) : "—");

function statusBadge(s: string) {
  const cls = s === "completed" ? "badge-current" : s === "overdue" ? "badge-error" : s === "in_progress" ? "badge-info" : s === "undeliverable" ? "badge-warning" : "badge-muted";
  return <span className={`badge ${cls}`}>{s.replace("_", " ")}</span>;
}

export default function ComplianceView({ rows }: { rows: Assignment[] }) {
  const [remindMsg, setRemindMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const completed = rows.filter((r) => r.status === "completed").length;
  const overdue = rows.filter((r) => r.status === "overdue").length;
  const pending = rows.filter((r) => r.status !== "completed").length;
  const pct = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  async function remindAll() {
    setBusy(true); setRemindMsg(null);
    try {
      const res = await fetch("/api/admin/remind", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "overdue" }) });
      const data = await res.json();
      setRemindMsg(res.ok && data.ok ? `Texted ${data.texted} straggler(s).${data.skipped ? ` Skipped ${data.skipped}.` : ""}` : `Error: ${data.error || "failed"}`);
    } catch { setRemindMsg("Network error"); }
    finally { setBusy(false); }
  }

  const cols: Column<Assignment>[] = [
    { key: "person_name", label: "Person", width: 200 },
    { key: "training_title", label: "Training", width: 240 },
    { key: "status", label: "Status", width: 130, render: (r) => statusBadge(r.status) },
    { key: "assigned_at", label: "Assigned", width: 120, sortValue: (r) => r.assigned_at || "", render: (r) => fmt(r.assigned_at) },
    { key: "due_at", label: "Due", width: 110, sortValue: (r) => r.due_at || "", render: (r) => fmt(r.due_at) },
    { key: "completed_at", label: "Completed", width: 120, sortValue: (r) => r.completed_at || "", render: (r) => fmt(r.completed_at) },
  ];

  const stat = (label: string, value: string, color?: string) => (
    <div className="card" style={{ padding: 16, minWidth: 150, flex: "1 1 150px" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, color }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {stat("Completion", `${pct}%`)}
        {stat("Completed", String(completed), "var(--status-success)")}
        {stat("Outstanding", String(pending))}
        {stat("Overdue", String(overdue), overdue ? "var(--status-error)" : undefined)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={remindAll} disabled={busy || overdue === 0} style={{ opacity: busy || overdue === 0 ? 0.5 : 1 }}>
          {busy ? "Texting…" : `Remind overdue (${overdue})`}
        </button>
        {remindMsg && <span style={{ fontSize: 14, color: remindMsg.startsWith("Error") ? "var(--status-error)" : "var(--status-success)" }}>{remindMsg}</span>}
      </div>
      <DataTable columns={cols} rows={rows} storageKey="train-compliance" initialSort={{ key: "status", dir: "asc" }} emptyText="No assignments yet — assign a training." />
    </div>
  );
}
