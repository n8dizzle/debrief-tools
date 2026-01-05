"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { PortalUser, Department } from "@/lib/supabase";

export default function UsersPage() {
  const { isOwner, user: currentUser } = usePermissions();
  const [users, setUsers] = useState<(PortalUser & { department?: Department })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, deptsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/departments"),
        ]);
        if (usersRes.ok) setUsers(await usersRes.json());
        if (deptsRes.ok) setDepartments(await deptsRes.json());
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (filterDept !== "all" && u.department_id !== filterDept) return false;
    if (filterRole !== "all" && u.role !== filterRole) return false;
    return true;
  });

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "owner":
        return { background: "var(--christmas-gold)", color: "var(--dark-bg)" };
      case "manager":
        return { background: "var(--christmas-green)", color: "var(--christmas-cream)" };
      default:
        return { background: "var(--bg-card-hover)", color: "var(--text-secondary)" };
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
            Users
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            {isOwner ? "Manage all users" : "Manage users in your department"}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center px-4 py-2 rounded-lg transition-colors"
          style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)" }}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add User
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Department
          </label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Role
          </label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <option value="all">All Roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            {isOwner && <option value="owner">Owner</option>}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        {loading ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
            No users found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--bg-card-hover)" }}>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Email
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Department
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Role
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Last Login
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td className="px-4 py-3" style={{ color: "var(--christmas-cream)" }}>
                    {user.name || "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {user.email}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {user.department?.name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                      style={getRoleBadgeStyle(user.role)}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: user.is_active ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: user.is_active ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
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
        Showing {filteredUsers.length} of {users.length} users
      </p>
    </div>
  );
}
