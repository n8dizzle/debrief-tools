"use client";

import Link from "next/link";
import DataTable, { type Column } from "@/components/DataTable";

export interface Person {
  id: string; source: string; name: string; phone: string | null;
  email: string | null; title: string | null; active: boolean;
}

export default function RosterTables({ techs, office }: { techs: Person[]; office: Person[] }) {
  const statusCell = (p: Person) => (
    <span className={`badge ${p.active ? "badge-current" : "badge-muted"}`}>{p.active ? "active" : "inactive"}</span>
  );

  const nameLink = (p: Person) => <Link href={`/admin/people/${p.id}`} style={{ color: "var(--christmas-green-light)", textDecoration: "none" }}>{p.name}</Link>;

  const techCols: Column<Person>[] = [
    { key: "name", label: "Name", width: 220, render: nameLink },
    { key: "phone", label: "Cell", width: 160, render: (p) => p.phone ? p.phone : <span style={{ color: "var(--status-warning)" }}>⚠ no number</span>, filterValue: (p) => p.phone || "" },
    { key: "email", label: "Email", width: 240, render: (p) => p.email || "—" },
    { key: "active", label: "Status", width: 120, sortValue: (p) => (p.active ? 1 : 0), render: statusCell },
  ];

  const officeCols: Column<Person>[] = [
    { key: "name", label: "Name", width: 220, render: nameLink },
    { key: "email", label: "Email", width: 260, render: (p) => p.email || "—" },
    { key: "title", label: "Role", width: 140, render: (p) => p.title || "—" },
    { key: "active", label: "Status", width: 120, sortValue: (p) => (p.active ? 1 : 0), render: statusCell },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Technicians <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({techs.length})</span></h2>
        <DataTable columns={techCols} rows={techs} storageKey="train-roster-techs" initialSort={{ key: "name", dir: "asc" }} />
      </section>
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Office / staff <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({office.length})</span></h2>
        <DataTable columns={officeCols} rows={office} storageKey="train-roster-office" initialSort={{ key: "name", dir: "asc" }} />
      </section>
    </div>
  );
}
