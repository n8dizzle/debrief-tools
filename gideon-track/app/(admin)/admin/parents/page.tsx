"use client";

import { useEffect, useState } from "react";
import type { GideonUser } from "@/lib/supabase";

export default function ParentsPage() {
  const [parents, setParents] = useState<GideonUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadParents(); }, []);

  async function loadParents() {
    setLoading(true);
    const res = await fetch("/api/users?role=parent");
    setParents(await res.json());
    setLoading(false);
  }

  async function addParent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        role: "parent",
        password: form.password,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create parent");
      setSaving(false);
      return;
    }

    setForm({ name: "", email: "", password: "" });
    setShowAdd(false);
    setSaving(false);
    loadParents();
  }

  async function toggleActive(parent: GideonUser) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parent.id, is_active: !parent.is_active }),
    });
    loadParents();
  }

  async function resetPassword(parent: GideonUser) {
    const newPassword = prompt(`Enter new password for ${parent.name}:`);
    if (!newPassword) return;
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parent.id, password: newPassword }),
    });
    alert("Password updated");
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif', fontWeight: 800 }}
          >
            Parents
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage parent accounts and access
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Parent"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addParent} className="card mb-6 animate-scale-in">
          <h2
            className="font-semibold mb-4"
            style={{ color: "var(--text-primary)", fontFamily: 'var(--font-display), sans-serif' }}
          >
            New Parent Account
          </h2>
          {error && (
            <p className="text-sm mb-3 p-2 rounded-lg" style={{ color: "var(--error)", background: "var(--error-light)" }}>{error}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Password *</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            After creating, link this parent to students from the student detail page.
          </p>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>{saving ? "Adding..." : "Add Parent"}</button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gideon-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : parents.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No parent accounts yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Create accounts for parents to track their children's progress</p>
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
              {parents.map((parent, i) => (
                <tr key={parent.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td className="table-cell font-semibold" style={{ color: "var(--text-primary)" }}>{parent.name}</td>
                  <td className="table-cell text-sm" style={{ color: "var(--text-secondary)" }}>{parent.email}</td>
                  <td className="table-cell">
                    <span className={`badge badge-${parent.is_active ? "success" : "error"}`}>
                      {parent.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => resetPassword(parent)} className="text-xs font-semibold" style={{ color: "var(--gideon-blue)" }}>
                        Reset Password
                      </button>
                      <button onClick={() => toggleActive(parent)} className="text-xs font-semibold" style={{ color: parent.is_active ? "var(--error)" : "var(--success)" }}>
                        {parent.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
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
