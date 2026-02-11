"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Department, PortalUser } from "@/lib/supabase";
import {
  APP_PERMISSIONS,
  type UserPermissions,
} from "@/lib/permissions";

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
    permissions: {} as UserPermissions,
  });
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const toggleAppExpanded = useCallback((app: string) => {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });
  }, []);

  const getAppPermissionCount = useCallback(
    (app: string, total: number) => {
      const appPerms = formData.permissions[app as keyof UserPermissions] as Record<string, boolean> | undefined;
      if (!appPerms) return 0;
      return Object.values(appPerms).filter(Boolean).length;
    },
    [formData.permissions]
  );

  const handleToggleAllApp = useCallback(
    (app: string, permKeys: string[]) => {
      setFormData((prev) => {
        const newPermissions = { ...prev.permissions };
        const appPerms = { ...(newPermissions[app as keyof UserPermissions] || {}) } as Record<string, boolean>;
        const enabledCount = permKeys.filter((k) => appPerms[k] === true).length;
        const allEnabled = enabledCount === permKeys.length;

        if (allEnabled) {
          // Revoke all
          delete newPermissions[app as keyof UserPermissions];
        } else {
          // Grant all
          for (const key of permKeys) {
            appPerms[key] = true;
          }
          (newPermissions as Record<string, Record<string, boolean>>)[app] = appPerms;
        }

        return { ...prev, permissions: newPermissions };
      });
    },
    []
  );

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
            permissions: userData.permissions || {},
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

  const handlePermissionToggle = (app: string, permission: string) => {
    setFormData((prev) => {
      const newPermissions = { ...prev.permissions };
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

      return { ...prev, permissions: newPermissions };
    });
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

          {/* Permissions */}
          {formData.role !== "owner" && isOwner && (
            <div className="pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: "var(--christmas-cream)" }}>
                  App Permissions
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedApps(new Set(APP_PERMISSIONS.map((g) => g.app)))}
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedApps(new Set())}
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {APP_PERMISSIONS.map((group) => {
                  const total = group.permissions.length;
                  const enabled = getAppPermissionCount(group.app, total);
                  const isExpanded = expandedApps.has(group.app);
                  const allEnabled = enabled === total;
                  const permKeys = group.permissions.map((p) => p.key);

                  return (
                    <div
                      key={group.app}
                      className="rounded-lg overflow-hidden"
                      style={{ border: "1px solid var(--border-subtle)" }}
                    >
                      {/* App header row */}
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors hover:bg-white/5"
                        style={{ background: isExpanded ? "var(--bg-card-hover)" : "transparent" }}
                        onClick={() => toggleAppExpanded(group.app)}
                      >
                        <svg
                          className="w-3.5 h-3.5 shrink-0 transition-transform"
                          style={{
                            color: "var(--text-muted)",
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium flex-1" style={{ color: "var(--christmas-cream)" }}>
                          {group.label}
                        </span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: enabled > 0 ? "rgba(34, 139, 34, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            color: enabled > 0 ? "var(--christmas-green)" : "var(--text-muted)",
                          }}
                        >
                          {enabled}/{total}
                        </span>
                        {/* Select all checkbox */}
                        <input
                          type="checkbox"
                          checked={allEnabled}
                          ref={(el) => {
                            if (el) el.indeterminate = enabled > 0 && !allEnabled;
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleAllApp(group.app, permKeys);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded shrink-0"
                          style={{ accentColor: "var(--christmas-green)" }}
                          title={allEnabled ? "Revoke all" : "Grant all"}
                        />
                      </div>

                      {/* Expanded permission list */}
                      {isExpanded && (
                        <div
                          className="px-3 pb-2 pt-1 space-y-0.5"
                          style={{ borderTop: "1px solid var(--border-subtle)" }}
                        >
                          {group.permissions.map((perm) => {
                            const isChecked =
                              (formData.permissions[group.app as keyof UserPermissions] as Record<string, boolean>)?.[
                                perm.key
                              ] === true;

                            return (
                              <label
                                key={perm.key}
                                className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded transition-colors hover:bg-white/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePermissionToggle(group.app, perm.key)}
                                  className="w-3.5 h-3.5 rounded shrink-0"
                                  style={{ accentColor: "var(--christmas-green)" }}
                                />
                                <span className="text-sm" style={{ color: "var(--christmas-cream)" }}>
                                  {perm.label}
                                </span>
                                <span className="text-xs ml-auto hidden sm:block" style={{ color: "var(--text-muted)" }}>
                                  {perm.description}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {formData.role === "owner" && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(184, 149, 107, 0.1)",
                border: "1px solid rgba(184, 149, 107, 0.3)",
                color: "var(--christmas-gold)",
              }}
            >
              Owners have full access to all features and settings across all apps.
            </div>
          )}
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
