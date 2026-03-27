"use client";

import { useEffect, useState } from "react";
import type { GideonUser } from "@/lib/supabase";

export default function TutorsPage() {
  const [tutors, setTutors] = useState<GideonUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadTutors(); }, []);

  async function loadTutors() {
    setLoading(true);
    const res = await fetch("/api/users?role=tutor");
    setTutors(await res.json());
    setLoading(false);
  }

  async function addTutor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), role: "tutor" }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create tutor");
      setSaving(false);
      return;
    }

    setForm({ name: "", email: "" });
    setShowAdd(false);
    setSaving(false);
    loadTutors();
  }

  async function toggleActive(tutor: GideonUser) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tutor.id, is_active: !tutor.is_active }),
    });
    loadTutors();
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
          >
            Tutors
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage tutor accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Tutor"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addTutor} className="card mb-6 animate-scale-in">
          <h2
            className="font-semibold mb-4"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif' }}
          >
            New Tutor
          </h2>
          {error && (
            <p className="text-sm mb-3 p-2 rounded-lg" style={{ color: "var(--error)", background: "var(--error-light)" }}>{error}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Google Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>{saving ? "Adding..." : "Add Tutor"}</button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : tutors.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No tutors yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Add your first tutor above</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tutors.map((tutor, i) => (
                <tr key={tutor.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td className="table-cell font-semibold" style={{ color: "var(--text-primary)" }}>{tutor.name}</td>
                  <td className="table-cell text-sm" style={{ color: "var(--text-secondary)" }}>{tutor.email}</td>
                  <td className="table-cell">
                    <span className={`badge badge-${tutor.is_active ? "success" : "error"}`}>
                      {tutor.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button onClick={() => toggleActive(tutor)} className="text-xs font-semibold" style={{ color: "var(--gideon-blue)" }}>
                      {tutor.is_active ? "Deactivate" : "Activate"}
                    </button>
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
