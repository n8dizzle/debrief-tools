"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Student } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", date_of_birth: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [filter]);

  async function loadStudents() {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    const res = await fetch(`/api/students${params}`);
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        date_of_birth: form.date_of_birth || null,
        notes: form.notes || null,
      }),
    });
    setForm({ name: "", date_of_birth: "", notes: "" });
    setShowAdd(false);
    setSaving(false);
    loadStudents();
  }

  const filterLabels: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    graduated: "Graduated",
    "": "All",
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{
              color: "var(--text-primary)",
              fontFamily: 'var(--font-display), sans-serif',
              fontWeight: 800,
            }}
          >
            Students
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {students.length} student{students.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Student"}
        </button>
      </div>

      {/* Add Student Form */}
      {showAdd && (
        <form onSubmit={addStudent} className="card mb-6 animate-scale-in">
          <h2
            className="font-semibold mb-4"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif' }}
          >
            New Student
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Date of Birth</label>
              <input type="date" className="input" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Adding..." : "Add Student"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {["active", "inactive", "graduated", ""].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn text-xs"
            style={{
              background: filter === f ? "var(--gideon-blue)" : "var(--bg-card)",
              color: filter === f ? "white" : "var(--text-secondary)",
              border: `1.5px solid ${filter === f ? "var(--gideon-blue)" : "var(--border-default)"}`,
              boxShadow: filter === f ? '0 2px 6px rgba(41, 182, 214, 0.25)' : 'var(--shadow-sm)',
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No students found</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Try a different filter or add a new student</p>
        </div>
      ) : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Status</th>
                <th className="table-header">Enrolled</th>
                <th className="table-header">Notes</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr
                  key={student.id}
                  className="transition-colors"
                  style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}
                >
                  <td className="table-cell">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="font-semibold hover:underline"
                      style={{ color: "var(--gideon-blue-dark)" }}
                    >
                      {student.name}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <span className={`badge badge-${student.status === "active" ? "success" : student.status === "graduated" ? "warning" : "error"}`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="table-cell text-sm" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(student.enrollment_date)}
                  </td>
                  <td className="table-cell text-sm" style={{ color: "var(--text-muted)" }}>
                    {student.notes || "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
