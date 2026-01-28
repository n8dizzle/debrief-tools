"use client";

import { useEffect, useState } from "react";
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold" style={{ color: "var(--christmas-cream)" }}>
                  App Permissions
                </h3>
                {permissionCount > 0 && (
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "rgba(93, 138, 102, 0.2)", color: "var(--christmas-green-light)" }}
                  >
                    {permissionCount} selected
                  </span>
                )}
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                {formData.department_id
                  ? "Permissions auto-filled from department defaults. Adjust as needed."
                  : "Select a department to auto-fill default permissions, or set them manually."}
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
                          (formData.permissions[group.app as keyof UserPermissions] as Record<string, boolean>)?.[
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
