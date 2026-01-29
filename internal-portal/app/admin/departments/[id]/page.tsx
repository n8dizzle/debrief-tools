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
  tool_ids?: string[];
  created_at: string;
}

interface Tool {
  id: string;
  name: string;
  section: string;
  is_active: boolean;
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
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_permissions: {} as UserPermissions,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch department and tools in parallel
        const [deptRes, toolsRes] = await Promise.all([
          fetch(`/api/departments/${deptId}`),
          fetch("/api/tools?admin=true"),
        ]);

        if (deptRes.ok) {
          const dept: Department = await deptRes.json();
          setFormData({
            name: dept.name,
            description: dept.description || "",
            default_permissions: dept.default_permissions || {},
          });
          setSelectedTools(dept.tool_ids || []);
        } else {
          setError("Department not found");
        }

        if (toolsRes.ok) {
          const toolsData = await toolsRes.json();
          // Only show active tools
          setTools(toolsData.filter((t: Tool) => t.is_active));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError("Failed to load department");
      }
      setLoading(false);
    }
    fetchData();
  }, [deptId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/departments/${deptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tool_ids: selectedTools,
        }),
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

  const handleToolToggle = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleSelectAllTools = () => {
    setSelectedTools(tools.map((t) => t.id));
  };

  const handleClearAllTools = () => {
    setSelectedTools([]);
  };

  // Group tools by section
  const toolsBySection = tools.reduce((acc: Record<string, Tool[]>, tool) => {
    if (!acc[tool.section]) acc[tool.section] = [];
    acc[tool.section].push(tool);
    return acc;
  }, {});

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

          {/* Visible Tools */}
          <div className="pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold" style={{ color: "var(--christmas-cream)" }}>
                Visible Tools
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllTools}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--christmas-green-light)" }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllTools}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--text-muted)" }}
                >
                  Clear All
                </button>
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Users in this department will see these tools on the portal home page.
              {selectedTools.length > 0 && (
                <span
                  className="ml-2 px-2 py-0.5 rounded"
                  style={{ background: "rgba(93, 138, 102, 0.2)", color: "var(--christmas-green-light)" }}
                >
                  {selectedTools.length} selected
                </span>
              )}
            </p>

            <div className="space-y-4">
              {Object.entries(toolsBySection).map(([section, sectionTools]) => (
                <div key={section}>
                  <div
                    className="text-xs font-medium uppercase tracking-wider mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {section}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {sectionTools.map((tool) => (
                      <label
                        key={tool.id}
                        className="flex items-center p-3 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: selectedTools.includes(tool.id)
                            ? "rgba(34, 197, 94, 0.1)"
                            : "var(--bg-primary)",
                          border: `1px solid ${
                            selectedTools.includes(tool.id)
                              ? "var(--christmas-green)"
                              : "var(--border-subtle)"
                          }`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(tool.id)}
                          onChange={() => handleToolToggle(tool.id)}
                          className="w-4 h-4 rounded mr-3"
                          style={{ accentColor: "var(--christmas-green)" }}
                        />
                        <span style={{ color: "var(--christmas-cream)" }}>{tool.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
