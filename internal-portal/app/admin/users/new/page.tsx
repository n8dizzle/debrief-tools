"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { APP_PERMISSIONS, type UserPermissions } from "@/lib/permissions";

interface Department {
  id: string;
  name: string;
  default_permissions: UserPermissions;
}

export default function NewUserPage() {
  const router = useRouter();
  const { isOwner, user: currentUser } = usePermissions();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    department_id: "",
    role: "employee",
    permissions: {} as UserPermissions,
  });

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch("/api/departments");
        if (res.ok) {
          const data = await res.json();
          setDepartments(data);
          // Default to current user's department for managers
          if (!isOwner && currentUser?.departmentId) {
            const dept = data.find((d: Department) => d.id === currentUser.departmentId);
            setFormData((prev) => ({
              ...prev,
              department_id: currentUser.departmentId!,
              permissions: dept?.default_permissions || {},
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    }
    fetchDepartments();
  }, [isOwner, currentUser]);

  // When department changes, apply default permissions
  const handleDepartmentChange = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    setFormData((prev) => ({
      ...prev,
      department_id: deptId,
      permissions: dept?.default_permissions || {},
    }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/users");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create user");
      }
    } catch (err) {
      setError("Failed to create user");
    }
    setLoading(false);
  };

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
          delete newPermissions[app as keyof UserPermissions];
        } else {
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

  // Count total selected permissions
  const permissionCount = Object.values(formData.permissions).reduce(
    (total, appPerms) => total + Object.values(appPerms as Record<string, boolean>).filter(Boolean).length,
    0
  );

  return (
    <div className="p-8 max-w-3xl">
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
          Add New User
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Create a new user account for the internal portal
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@christmasair.com"
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Must be a @christmasair.com or @bartshvac.com email
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
              Department *
            </label>
            <select
              required
              value={formData.department_id}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              disabled={!isOwner}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
                opacity: !isOwner ? 0.7 : 1,
              }}
            >
              <option value="">Select department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {!isOwner && (
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Managers can only add users to their own department
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Role *
            </label>
            <select
              required
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
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {isOwner
                ? "Owners have all permissions automatically."
                : "Only owners can assign the Owner role."}
            </p>
          </div>

          {/* Permissions Section */}
          {formData.role !== "owner" && (
            <div className="pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--christmas-cream)" }}>
                    App Permissions
                  </h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {formData.department_id
                      ? "Permissions auto-filled from department defaults. Adjust as needed."
                      : "Select a department to auto-fill default permissions, or set them manually."}
                  </p>
                </div>
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
        <div className="flex justify-end gap-3 mt-6">
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
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: "var(--christmas-green)",
              color: "var(--christmas-cream)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
