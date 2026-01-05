"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Department, PortalUser } from "@/lib/supabase";

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { isOwner, user: currentUser } = usePermissions();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    department_id: "",
    role: "employee",
    is_active: true,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, deptsRes] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch("/api/departments"),
        ]);

        if (userRes.ok) {
          const userData: PortalUser = await userRes.json();
          setFormData({
            email: userData.email,
            name: userData.name || "",
            department_id: userData.department_id || "",
            role: userData.role,
            is_active: userData.is_active,
          });
        } else {
          setError("User not found");
        }

        if (deptsRes.ok) {
          setDepartments(await deptsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError("Failed to load user");
      }
      setLoading(false);
    }
    fetchData();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/users");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update user");
      }
    } catch (err) {
      setError("Failed to update user");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/users");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete user");
      }
    } catch (err) {
      setError("Failed to delete user");
    }
    setSaving(false);
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading user...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center text-sm mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Edit User
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Update user details and permissions
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          className="rounded-xl p-6 space-y-6"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
        >
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
            >
              {error}
            </div>
          )}

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-4 py-2.5 rounded-lg text-sm cursor-not-allowed"
              style={{
                background: "var(--bg-card-hover)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Email cannot be changed after creation
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Smith"
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Department
            </label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              disabled={!isOwner}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
                opacity: !isOwner ? 0.7 : 1,
              }}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              {isOwner && <option value="owner">Owner</option>}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded mr-3"
                style={{ accentColor: "var(--christmas-green)" }}
              />
              <span style={{ color: "var(--christmas-cream)" }}>Active Account</span>
            </label>
            <p className="mt-1 text-xs ml-7" style={{ color: "var(--text-muted)" }}>
              Inactive users cannot log in to the portal
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ color: "#ef4444" }}
            >
              Delete User
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--christmas-green)",
                color: "var(--christmas-cream)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl p-6 max-w-md w-full mx-4"
            style={{ background: "var(--bg-secondary)" }}
          >
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--christmas-cream)" }}>
              Delete User?
            </h2>
            <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{formData.name || formData.email}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "#ef4444", color: "white" }}
              >
                {saving ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
