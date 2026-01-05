"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Tool, Department } from "@/lib/supabase";

export default function ToolsPage() {
  const { isOwner } = usePermissions();
  const [tools, setTools] = useState<Tool[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch all tools (admin view - no permission filtering)
        const [toolsRes, deptsRes] = await Promise.all([
          fetch("/api/tools?admin=true"),
          fetch("/api/departments"),
        ]);
        if (toolsRes.ok) setTools(await toolsRes.json());
        if (deptsRes.ok) setDepartments(await deptsRes.json());
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredTools = tools.filter((t) => {
    if (filterSection !== "all" && t.section !== filterSection) return false;
    return true;
  });

  const sections = Array.from(new Set(tools.map((t) => t.section)));

  const handleToggleActive = async (tool: Tool) => {
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tool.is_active }),
      });
      if (res.ok) {
        setTools(tools.map((t) => (t.id === tool.id ? { ...t, is_active: !t.is_active } : t)));
      }
    } catch (error) {
      console.error("Failed to toggle tool:", error);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Only owners can manage tools.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
            Tools & Resources
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage the tools and resources available on the portal
          </p>
        </div>
        <Link
          href="/admin/tools/new"
          className="inline-flex items-center px-4 py-2 rounded-lg transition-colors"
          style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)" }}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Tool
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Section
          </label>
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <option value="all">All Sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tools Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        {loading ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
            Loading tools...
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
            No tools found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--bg-card-hover)" }}>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Section
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Category
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  URL
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.map((tool) => (
                <tr
                  key={tool.id}
                  className="border-t"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span style={{ color: "var(--christmas-cream)" }}>{tool.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: "var(--bg-card-hover)", color: "var(--text-secondary)" }}
                    >
                      {tool.section}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {tool.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm truncate max-w-[200px] inline-block"
                      style={{ color: "var(--christmas-green-light)" }}
                    >
                      {tool.url.replace(/^https?:\/\//, "").slice(0, 30)}
                      {tool.url.length > 30 ? "..." : ""}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(tool)}
                      className="px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                      style={{
                        background: tool.is_active ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: tool.is_active ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {tool.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tools/${tool.id}`}
                      className="text-sm px-3 py-1 rounded transition-colors"
                      style={{ color: "var(--christmas-green-light)" }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count */}
      <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
        Showing {filteredTools.length} of {tools.length} tools
      </p>
    </div>
  );
}
