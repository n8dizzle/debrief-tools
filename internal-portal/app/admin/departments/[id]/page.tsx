"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { APP_PERMISSIONS, type UserPermissions } from "@/lib/permissions";

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_permissions: UserPermissions;
  created_at: string;
}

export default function EditDepartmentPage() {
  const router = useRouter();
  const params = useParams();
  const deptId = params.id as string;
  const { isOwner } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_permissions: {} as UserPermissions,
  });

  useEffect(() => {
    async function fetchDepartment() {
      try {
        const res = await fetch(`/api/departments/${deptId}`);
        if (res.ok) {
          const dept: Department = await res.json();
          setFormData({
            name: dept.name,
            description: dept.description || "",
            default_permissions: dept.default_permissions || {},
          });
        } else {
          setError("Department not found");
        }
      } catch (error) {
        console.error("Failed to fetch department:", error);
        setError("Failed to load department");
      }
      setLoading(false);
    }
    fetchDepartment();
  }, [deptId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/departments");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update department");
      }
    } catch (err) {
      setError("Failed to update department");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/departments/${deptId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/departments");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete department");
      }
    } catch (err) {
      setError("Failed to delete department");
    }
    setSaving(false);
    setShowDeleteConfirm(false);
  };

  const handlePermissionToggle = (app: string, permission: string) => {
    setFormData((prev) => {
      const newPermissions = { ...prev.default_permissions };
      const appPerms = { ...(newPermissions[app as keyof UserPermissions] || {}) } as Record<string, boolean>;

      if (appPerms[permission]) {
        delete appPerms[permission];
      } else {
        appPerms[permission] = true;
      }

      if (Object.keys(appPerms).length === 0) {
        delete newPermissions[app as keyof UserPermissions];
      } else {
        (newPermissions as Record<string, Record<string, boolean>>)[app] = appPerms;
      }

      return { ...prev, default_permissions: newPermissions };
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading department...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/departments"
          className="inline-flex items-center text-sm mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Departments
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Edit Department
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Update department details and default permissions
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg text-sm resize-none"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {/* Default Permissions */}
          <div className="pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--christmas-cream)" }}>
              Default Permissions
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              These permissions will be automatically applied when creating new users in this department.
              Users can still have permissions adjusted individually after creation.
            </p>

            <div className="space-y-6">
              {APP_PERMISSIONS.map((group) => (
                <div key={group.app}>
                  <div
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.permissions.map((perm) => {
                      const isChecked =
                        (formData.default_permissions[group.app as keyof UserPermissions] as Record<string, boolean>)?.[
                          perm.key
                        ] === true;

                      return (
                        <label
                          key={perm.key}
                          className="flex items-start gap-3 cursor-pointer p-2 rounded-lg transition-colors hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handlePermissionToggle(group.app, perm.key)}
                            className="w-4 h-4 rounded mt-0.5"
                            style={{ accentColor: "var(--christmas-green)" }}
                          />
                          <div>
                            <div className="text-sm" style={{ color: "var(--christmas-cream)" }}>
                              {perm.label}
                            </div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {perm.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
              Delete Department
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <Link
              href="/admin/departments"
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
              Delete Department?
            </h2>
            <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{formData.name}</strong>?
              This cannot be undone. Users in this department will need to be reassigned first.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "#ef4444", color: "white" }}
              >
                {saving ? "Deleting..." : "Delete Department"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
