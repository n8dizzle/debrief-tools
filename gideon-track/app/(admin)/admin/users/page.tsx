"use client";

import { useEffect, useRef, useState } from "react";
import type { GideonUser, UserRole, Student } from "@/lib/supabase";

type RoleFilter = "all" | "admin" | "tutor" | "parent";

interface LinkedStudent {
  id: string;
  relationship: string;
  student: { id: string; name: string; status: string };
}

function SearchableStudentPicker({
  students,
  excludeIds,
  onSelect,
  placeholder = "Search students...",
}: {
  students: Student[];
  excludeIds: Set<string>;
  onSelect: (studentId: string) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const available = students.filter(
    (s) => s.status === "active" && !excludeIds.has(s.id)
  );
  const filtered = search
    ? available.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  if (available.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <input
        className="input text-xs"
        style={{ padding: "3px 8px", width: "160px" }}
        placeholder={placeholder}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 50,
            width: "200px",
            maxHeight: "180px",
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            marginTop: "2px",
          }}
        >
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSelect(s.id); setSearch(""); setOpen(false); }}
              className="w-full text-left text-xs px-3 py-2 hover:opacity-80"
              style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<GideonUser[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roles: { admin: false, tutor: false, parent: false },
    selectedStudents: [] as { studentId: string; relationship: string }[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", roles: { admin: false, tutor: false, parent: false } });

  // Linked students per parent (keyed by user id)
  const [parentStudentsMap, setParentStudentsMap] = useState<Record<string, LinkedStudent[]>>({});
  const [addingLinkFor, setAddingLinkFor] = useState<string | null>(null);
  const [linkRelationship, setLinkRelationship] = useState("Parent");

  useEffect(() => {
    loadUsers();
    loadStudents();
  }, []);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data: GideonUser[] = await res.json();
    const allUsers = Array.isArray(data) ? data : [];
    setUsers(allUsers);
    const parents = allUsers.filter((u) => u.roles.includes("parent"));
    const map: Record<string, LinkedStudent[]> = {};
    await Promise.all(
      parents.map(async (p) => {
        const r = await fetch(`/api/users/${p.id}/students`);
        const d = await r.json();
        map[p.id] = Array.isArray(d) ? d : [];
      })
    );
    setParentStudentsMap(map);
    setLoading(false);
  }

  async function loadStudents() {
    const res = await fetch("/api/students");
    const data = await res.json();
    if (Array.isArray(data)) setStudents(data);
  }

  async function refreshParentStudents(parentId: string) {
    const res = await fetch(`/api/users/${parentId}/students`);
    const data = await res.json();
    setParentStudentsMap((prev) => ({ ...prev, [parentId]: Array.isArray(data) ? data : [] }));
  }

  async function addLink(parentId: string, studentId: string) {
    await fetch(`/api/students/${studentId}/parents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: parentId, relationship: linkRelationship || "Parent" }),
    });
    setAddingLinkFor(null);
    setLinkRelationship("Parent");
    refreshParentStudents(parentId);
  }

  async function removeLink(parentId: string, studentId: string) {
    await fetch(`/api/students/${studentId}/parents?parentId=${parentId}`, { method: "DELETE" });
    refreshParentStudents(parentId);
  }

  const filtered = filter === "all" ? users : users.filter((u) => u.roles.includes(filter));
  const selectedStudentIds = new Set(form.selectedStudents.map((s) => s.studentId));

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const roles: UserRole[] = [];
    if (form.roles.admin) roles.push("admin");
    if (form.roles.tutor) roles.push("tutor");
    if (form.roles.parent) roles.push("parent");

    if (roles.length === 0) {
      setError("Select at least one role");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      roles,
    };
    if (roles.includes("parent") && form.password) {
      payload.password = form.password;
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create user");
      setSaving(false);
      return;
    }

    if (roles.includes("parent") && form.selectedStudents.length > 0) {
      const newUser = await res.json();
      await Promise.all(
        form.selectedStudents.map((s) =>
          fetch(`/api/students/${s.studentId}/parents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parent_id: newUser.id, relationship: s.relationship || "Parent" }),
          })
        )
      );
    }

    setForm({ name: "", email: "", password: "", roles: { admin: false, tutor: false, parent: false }, selectedStudents: [] });
    setShowAdd(false);
    setSaving(false);
    loadUsers();
  }

  async function toggleActive(user: GideonUser) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    });
    loadUsers();
  }

  async function resetPassword(user: GideonUser) {
    const newPassword = prompt(`Enter new password for ${user.name}:`);
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, password: newPassword }),
    });
    alert("Password updated");
  }

  function startEdit(user: GideonUser) {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      roles: { admin: user.roles.includes("admin"), tutor: user.roles.includes("tutor"), parent: user.roles.includes("parent") },
    });
  }

  async function saveEdit(user: GideonUser) {
    const roles: UserRole[] = [];
    if (editForm.roles.admin) roles.push("admin");
    if (editForm.roles.tutor) roles.push("tutor");
    if (editForm.roles.parent) roles.push("parent");

    if (roles.length === 0) {
      alert("Select at least one role");
      return;
    }

    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        roles,
        active_role: roles[0],
      }),
    });
    setEditingId(null);
    loadUsers();
  }

  function addStudentToForm(studentId: string) {
    setForm({
      ...form,
      selectedStudents: [...form.selectedStudents, { studentId, relationship: "Parent" }],
    });
  }

  function removeStudentFromForm(index: number) {
    setForm({
      ...form,
      selectedStudents: form.selectedStudents.filter((_, i) => i !== index),
    });
  }

  function updateFormStudentRelationship(index: number, value: string) {
    const updated = [...form.selectedStudents];
    updated[index] = { ...updated[index], relationship: value };
    setForm({ ...form, selectedStudents: updated });
  }

  const filterButtons: { label: string; value: RoleFilter }[] = [
    { label: "All", value: "all" },
    { label: "Admins", value: "admin" },
    { label: "Tutors", value: "tutor" },
    { label: "Parents", value: "parent" },
  ];

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1
            className="text-2xl"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif", fontWeight: 800 }}
          >
            Users
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage admin, tutor, and parent accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addUser} className="card mb-6 animate-scale-in">
          <h2
            className="font-semibold mb-4"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif" }}
          >
            New User
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
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Roles *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.admin}
                  onChange={(e) => setForm({ ...form, roles: { ...form.roles, admin: e.target.checked } })}
                  className="accent-[var(--gideon-red)]"
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>Admin</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.tutor}
                  onChange={(e) => setForm({ ...form, roles: { ...form.roles, tutor: e.target.checked } })}
                  className="accent-[var(--gideon-blue)]"
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>Tutor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.roles.parent}
                  onChange={(e) => setForm({ ...form, roles: { ...form.roles, parent: e.target.checked } })}
                  className="accent-[var(--gideon-blue)]"
                />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>Parent</span>
              </label>
            </div>
          </div>

          {form.roles.parent && (
            <>
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Password *</label>
                <input
                  type="password"
                  className="input"
                  style={{ maxWidth: "300px" }}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Required for parent portal login</p>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                  Link Students
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {form.selectedStudents.map((sel, i) => {
                    const student = students.find((s) => s.id === sel.studentId);
                    return (
                      <span
                        key={sel.studentId}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(41, 182, 214, 0.1)", color: "var(--gideon-blue)" }}
                      >
                        {student?.name || "Unknown"}
                        <input
                          className="text-[10px] font-normal bg-transparent border-none outline-none"
                          style={{ width: "60px", color: "var(--text-muted)" }}
                          value={sel.relationship}
                          onChange={(e) => updateFormStudentRelationship(i, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={() => removeStudentFromForm(i)}
                          className="hover:opacity-70"
                          style={{ color: "var(--text-muted)" }}
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
                <SearchableStudentPicker
                  students={students}
                  excludeIds={selectedStudentIds}
                  onSelect={addStudentToForm}
                  placeholder="Search students to link..."
                />
                {students.filter((s) => s.status === "active").length === 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>No active students to link</p>
                )}
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>{saving ? "Adding..." : "Add User"}</button>
        </form>
      )}

      {/* Role filter */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--bg-secondary)", width: "fit-content" }}>
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={{
              background: filter === btn.value ? "var(--gideon-blue)" : "transparent",
              color: filter === btn.value ? "white" : "var(--text-secondary)",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--gideon-blue)", borderTopColor: "transparent" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No users found</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filter !== "all" ? `No ${filter}s yet. ` : ""}Add your first user above.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Roles</th>
                <th className="table-header">Students</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => {
                const isParent = user.roles.includes("parent");
                const links = parentStudentsMap[user.id] || [];
                const linkedIds = new Set(links.map((l) => l.student.id));
                return (
                  <tr key={user.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                    {editingId === user.id ? (
                      <>
                        <td className="table-cell">
                          <input
                            className="input text-sm"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            style={{ padding: "4px 8px" }}
                          />
                        </td>
                        <td className="table-cell">
                          <input
                            type="email"
                            className="input text-sm"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            style={{ padding: "4px 8px" }}
                          />
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.roles.admin}
                                onChange={(e) => setEditForm({ ...editForm, roles: { ...editForm.roles, admin: e.target.checked } })}
                                className="accent-[var(--gideon-red)]"
                              />
                              <span className="text-xs" style={{ color: "var(--text-primary)" }}>Admin</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.roles.tutor}
                                onChange={(e) => setEditForm({ ...editForm, roles: { ...editForm.roles, tutor: e.target.checked } })}
                                className="accent-[var(--gideon-blue)]"
                              />
                              <span className="text-xs" style={{ color: "var(--text-primary)" }}>Tutor</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.roles.parent}
                                onChange={(e) => setEditForm({ ...editForm, roles: { ...editForm.roles, parent: e.target.checked } })}
                                className="accent-[var(--gideon-blue)]"
                              />
                              <span className="text-xs" style={{ color: "var(--text-primary)" }}>Parent</span>
                            </label>
                          </div>
                        </td>
                        <td className="table-cell" />
                        <td className="table-cell">
                          <span className={`badge badge-${user.is_active ? "success" : "error"}`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => saveEdit(user)} className="text-xs font-semibold" style={{ color: "var(--success)" }}>Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="table-cell font-semibold" style={{ color: "var(--text-primary)" }}>{user.name}</td>
                        <td className="table-cell text-sm" style={{ color: "var(--text-secondary)" }}>{user.email}</td>
                        <td className="table-cell">
                          <div className="flex gap-1.5">
                            {user.roles.includes("admin") && (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(217, 48, 37, 0.15)", color: "var(--gideon-red)" }}
                              >
                                Admin
                              </span>
                            )}
                            {user.roles.includes("tutor") && (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(41, 182, 214, 0.15)", color: "var(--gideon-blue)" }}
                              >
                                Tutor
                              </span>
                            )}
                            {user.roles.includes("parent") && (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(243, 156, 18, 0.15)", color: "var(--gideon-orange)" }}
                              >
                                Parent
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell" style={{ verticalAlign: "middle" }}>
                          {isParent ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {links.map((link) => (
                                <span
                                  key={link.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(41, 182, 214, 0.1)", color: "var(--gideon-blue)" }}
                                >
                                  {link.student.name}
                                  <button
                                    onClick={() => removeLink(user.id, link.student.id)}
                                    className="hover:opacity-70 ml-0.5"
                                    style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1 }}
                                    title="Remove link"
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))}
                              {addingLinkFor === user.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <SearchableStudentPicker
                                    students={students}
                                    excludeIds={linkedIds}
                                    onSelect={(studentId) => addLink(user.id, studentId)}
                                    placeholder="Search..."
                                  />
                                  <input
                                    className="input text-[11px]"
                                    style={{ padding: "3px 6px", width: "80px" }}
                                    placeholder="Relation"
                                    value={linkRelationship}
                                    onChange={(e) => setLinkRelationship(e.target.value)}
                                  />
                                  <button
                                    onClick={() => { setAddingLinkFor(null); setLinkRelationship("Parent"); }}
                                    className="text-[11px] font-semibold"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddingLinkFor(user.id)}
                                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ color: "var(--gideon-blue)", border: "1px dashed var(--gideon-blue)", opacity: 0.7 }}
                                >
                                  + Link
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>&mdash;</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className={`badge badge-${user.is_active ? "success" : "error"}`}>
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => startEdit(user)} className="text-xs font-semibold" style={{ color: "var(--gideon-blue)" }}>
                              Edit
                            </button>
                            {isParent && (
                              <button onClick={() => resetPassword(user)} className="text-xs font-semibold" style={{ color: "var(--gideon-blue)" }}>
                                Reset Password
                              </button>
                            )}
                            <button
                              onClick={() => toggleActive(user)}
                              className="text-xs font-semibold"
                              style={{ color: user.is_active ? "var(--error)" : "var(--success)" }}
                            >
                              {user.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
