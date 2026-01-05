"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Department, Tool } from "@/lib/supabase";
import IconPicker from "@/components/IconPicker";

const SECTIONS = ["Tools", "Resources", "Marketing", "Quick Links"];

export default function EditToolPage() {
  const router = useRouter();
  const params = useParams();
  const toolId = params.id as string;
  const { isOwner } = usePermissions();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    icon: "wrench",
    section: "Tools",
    category: "",
    is_active: true,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [toolRes, deptsRes] = await Promise.all([
          fetch(`/api/tools/${toolId}`),
          fetch("/api/departments"),
        ]);

        if (toolRes.ok) {
          const toolData: Tool & { permissions?: { department_id: string }[] } = await toolRes.json();
          setFormData({
            name: toolData.name,
            description: toolData.description || "",
            url: toolData.url,
            icon: toolData.icon,
            section: toolData.section,
            category: toolData.category || "",
            is_active: toolData.is_active,
          });
          if (toolData.permissions) {
            setSelectedDepartments(toolData.permissions.map((p) => p.department_id));
          }
        } else {
          setError("Tool not found");
        }

        if (deptsRes.ok) {
          setDepartments(await deptsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError("Failed to load tool");
      }
      setLoading(false);
    }
    fetchData();
  }, [toolId]);

  const handleDepartmentToggle = (deptId: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSelectAllDepartments = () => {
    setSelectedDepartments(departments.map((d) => d.id));
  };

  const handleClearAllDepartments = () => {
    setSelectedDepartments([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/tools/${toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          department_ids: selectedDepartments,
        }),
      });

      if (res.ok) {
        router.push("/admin/tools");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update tool");
      }
    } catch (err) {
      setError("Failed to update tool");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tools/${toolId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/tools");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete tool");
      }
    } catch (err) {
      setError("Failed to delete tool");
    }
    setSaving(false);
    setShowDeleteConfirm(false);
  };

  if (!isOwner) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Only owners can manage tools.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading tool...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/tools"
          className="inline-flex items-center text-sm mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tools
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Edit Tool
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Update tool details and permissions
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

          {/* URL */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              URL *
            </label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Use # for "coming soon" tools that aren't ready yet
            </p>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Icon
            </label>
            <IconPicker
              value={formData.icon}
              onChange={(icon) => setFormData({ ...formData, icon })}
            />
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Section *
            </label>
            <select
              required
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--christmas-cream)" }}>
              Category Tag
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-primary)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            />
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
              <span style={{ color: "var(--christmas-cream)" }}>Active</span>
            </label>
            <p className="mt-1 text-xs ml-7" style={{ color: "var(--text-muted)" }}>
              Inactive tools are hidden from the portal
            </p>
          </div>

          {/* Department Permissions */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium" style={{ color: "var(--christmas-cream)" }}>
                Visible to Departments
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllDepartments}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--christmas-green-light)" }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDepartments}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--text-muted)" }}
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {departments.map((dept) => (
                <label
                  key={dept.id}
                  className="flex items-center p-3 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: selectedDepartments.includes(dept.id)
                      ? "rgba(34, 197, 94, 0.1)"
                      : "var(--bg-primary)",
                    border: `1px solid ${
                      selectedDepartments.includes(dept.id)
                        ? "var(--christmas-green)"
                        : "var(--border-subtle)"
                    }`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={() => handleDepartmentToggle(dept.id)}
                    className="w-4 h-4 rounded mr-3"
                    style={{ accentColor: "var(--christmas-green)" }}
                  />
                  <span style={{ color: "var(--christmas-cream)" }}>{dept.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "#ef4444" }}
          >
            Delete Tool
          </button>
          <div className="flex gap-3">
            <Link
              href="/admin/tools"
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
              Delete Tool?
            </h2>
            <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{formData.name}</strong>?
              This will also remove all associated usage data and permissions.
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
                {saving ? "Deleting..." : "Delete Tool"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
