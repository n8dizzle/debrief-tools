"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_permissions: Record<string, Record<string, boolean>>;
  created_at: string;
}

export default function DepartmentsPage() {
  const { isOwner } = usePermissions();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        setDepartments(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newDept.name.trim()) {
      setError("Name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDept),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewDept({ name: "", description: "" });
        fetchDepartments();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create department");
      }
    } catch (err) {
      setError("Failed to create department");
    }
    setCreating(false);
  }

  // Count permissions in a department
  const countPermissions = (perms: Record<string, Record<string, boolean>> | null) => {
    if (!perms) return 0;
    return Object.values(perms).reduce(
      (total, appPerms) => total + Object.values(appPerms).filter(Boolean).length,
      0
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading departments...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
            Departments
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage departments and their default permission templates
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Department
          </button>
        )}
      </div>

      {/* Departments Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <Link
            key={dept.id}
            href={`/admin/departments/${dept.id}`}
            className="rounded-xl p-5 transition-all hover:scale-[1.02]"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "var(--christmas-green)" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--christmas-cream)" }}>
              {dept.name}
            </h3>
            {dept.description && (
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                {dept.description}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: countPermissions(dept.default_permissions) > 0
                    ? "rgba(93, 138, 102, 0.2)"
                    : "var(--bg-card-hover)",
                  color: countPermissions(dept.default_permissions) > 0
                    ? "var(--christmas-green-light)"
                    : "var(--text-muted)",
                }}
              >
                {countPermissions(dept.default_permissions)} default permissions
              </span>
            </div>
          </Link>
        ))}
      </div>

      {departments.length === 0 && (
        <div
          className="text-center py-12 rounded-xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          <p style={{ color: "var(--text-muted)" }}>No departments yet</p>
          {isOwner && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)" }}
            >
              Create First Department
            </button>
          )}
        </div>
      )}

      {/* New Department Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl p-6 max-w-md w-full mx-4"
            style={{ background: "var(--bg-secondary)" }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--christmas-cream)" }}>
              New Department
            </h2>

            {error && (
              <div
                className="p-3 rounded-lg text-sm mb-4"
                style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
              >
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  placeholder="e.g., Sales"
                  className="w-full px-4 py-2.5 rounded-lg text-sm"
                  style={{
                    background: "var(--bg-primary)",
                    color: "var(--christmas-cream)",
                    border: "1px solid var(--border-subtle)",
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
                  Description
                </label>
                <textarea
                  value={newDept.description}
                  onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                  placeholder="What does this department do?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg text-sm resize-none"
                  style={{
                    background: "var(--bg-primary)",
                    color: "var(--christmas-cream)",
                    border: "1px solid var(--border-subtle)",
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewModal(false);
                  setError(null);
                  setNewDept({ name: "", description: "" });
                }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--christmas-green)",
                  color: "var(--christmas-cream)",
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Department"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
