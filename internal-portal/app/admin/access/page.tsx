"use client";

import { useEffect, useState, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { APP_PERMISSIONS } from "@/lib/permissions";

interface UserAccess {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, Record<string, boolean>> | null;
}

export default function AccessPage() {
  const { isOwner } = usePermissions();
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string>(APP_PERMISSIONS[0]?.app || "");
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) setUsers(await res.json());
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const appGroup = APP_PERMISSIONS.find((g) => g.app === selectedApp);
  const permKeys = appGroup?.permissions || [];

  // Non-owner users only (owners have full access automatically)
  const eligibleUsers = users
    .filter((u) => u.is_active && u.role !== "owner")
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

  const getUserPerm = useCallback(
    (userId: string, permKey: string): boolean => {
      // Check local changes first
      if (changes[userId]?.[permKey] !== undefined) {
        return changes[userId][permKey];
      }
      // Fall back to stored permissions
      const user = users.find((u) => u.id === userId);
      return user?.permissions?.[selectedApp]?.[permKey] === true;
    },
    [changes, users, selectedApp]
  );

  const togglePerm = useCallback(
    (userId: string, permKey: string) => {
      const current = getUserPerm(userId, permKey);
      setChanges((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          [permKey]: !current,
        },
      }));
    },
    [getUserPerm]
  );

  const toggleAllUsersForPerm = useCallback(
    (permKey: string) => {
      const allEnabled = eligibleUsers.every((u) => getUserPerm(u.id, permKey));
      setChanges((prev) => {
        const next = { ...prev };
        for (const user of eligibleUsers) {
          next[user.id] = {
            ...(next[user.id] || {}),
            [permKey]: !allEnabled,
          };
        }
        return next;
      });
    },
    [eligibleUsers, getUserPerm]
  );

  const toggleAllPermsForUser = useCallback(
    (userId: string) => {
      const allEnabled = permKeys.every((p) => getUserPerm(userId, p.key));
      setChanges((prev) => {
        const next = { ...prev };
        const perms: Record<string, boolean> = {};
        for (const p of permKeys) {
          perms[p.key] = !allEnabled;
        }
        next[userId] = perms;
        return next;
      });
    },
    [permKeys, getUserPerm]
  );

  const grantAccessToAll = useCallback(() => {
    setChanges((prev) => {
      const next = { ...prev };
      for (const user of eligibleUsers) {
        next[user.id] = {
          ...(next[user.id] || {}),
          can_access: true,
        };
      }
      return next;
    });
  }, [eligibleUsers]);

  const revokeAccessFromAll = useCallback(() => {
    setChanges((prev) => {
      const next = { ...prev };
      for (const user of eligibleUsers) {
        const perms: Record<string, boolean> = {};
        for (const p of permKeys) {
          perms[p.key] = false;
        }
        next[user.id] = perms;
      }
      return next;
    });
  }, [eligibleUsers, permKeys]);

  const hasChanges = Object.keys(changes).length > 0;

  const changedCount = Object.keys(changes).filter((userId) => {
    const user = users.find((u) => u.id === userId);
    const stored = user?.permissions?.[selectedApp] || {};
    const local = changes[userId];
    return Object.keys(local).some((key) => {
      const storedVal = stored[key] === true;
      return local[key] !== storedVal;
    });
  }).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build updates: for each changed user, merge stored + changes
      const updates = Object.entries(changes)
        .map(([userId, localPerms]) => {
          const user = users.find((u) => u.id === userId);
          const stored = user?.permissions?.[selectedApp] || {};
          const merged = { ...stored, ...localPerms };
          // Only include if something actually changed
          const storedCheck = user?.permissions?.[selectedApp] || {};
          const changed = Object.keys(merged).some(
            (key) => (merged[key] === true) !== (storedCheck[key] === true)
          );
          if (!changed) return null;
          return { userId, permissions: merged };
        })
        .filter(Boolean);

      if (updates.length === 0) {
        setChanges({});
        setSaving(false);
        return;
      }

      const res = await fetch("/api/users/bulk-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: selectedApp, updates }),
      });

      if (res.ok) {
        // Refresh users
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) setUsers(await usersRes.json());
        setChanges({});
      }
    } catch (error) {
      console.error("Failed to save:", error);
    }
    setSaving(false);
  };

  const handleDiscard = () => setChanges({});

  if (!isOwner) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Only owners can manage app access.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          App Access
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Manage who can access each app — toggle permissions for multiple users at once.
        </p>
      </div>

      {/* App selector + search */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            App
          </label>
          <select
            value={selectedApp}
            onChange={(e) => {
              setSelectedApp(e.target.value);
              setChanges({});
            }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {APP_PERMISSIONS.map((g) => (
              <option key={g.app} value={g.app}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Search Users
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or email..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          />
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={grantAccessToAll}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            color: "var(--christmas-green)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          Grant Access to All
        </button>
        <button
          onClick={revokeAccessFromAll}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.3)",
          }}
        >
          Revoke All Access
        </button>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
          {eligibleUsers.length} user{eligibleUsers.length !== 1 ? "s" : ""} (owners auto-granted)
        </span>
      </div>

      {/* Permission matrix */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        {loading ? (
          <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--bg-card-hover)" }}>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium sticky left-0 z-10"
                    style={{ color: "var(--text-secondary)", background: "var(--bg-card-hover)", minWidth: 200 }}
                  >
                    User
                  </th>
                  {permKeys.map((perm) => (
                    <th
                      key={perm.key}
                      className="px-3 py-3 text-center text-xs font-medium"
                      style={{ color: "var(--text-secondary)", minWidth: 90 }}
                    >
                      <button
                        onClick={() => toggleAllUsersForPerm(perm.key)}
                        className="hover:underline cursor-pointer"
                        title={`Toggle "${perm.label}" for all users`}
                      >
                        {perm.label}
                      </button>
                    </th>
                  ))}
                  <th
                    className="px-3 py-3 text-center text-xs font-medium"
                    style={{ color: "var(--text-secondary)", minWidth: 70 }}
                  >
                    All
                  </th>
                </tr>
              </thead>
              <tbody>
                {eligibleUsers.map((user) => {
                  const allEnabled = permKeys.every((p) => getUserPerm(user.id, p.key));
                  const anyChanged = changes[user.id] && Object.keys(changes[user.id]).some((key) => {
                    const stored = user.permissions?.[selectedApp]?.[key] === true;
                    return changes[user.id][key] !== stored;
                  });

                  return (
                    <tr
                      key={user.id}
                      className="border-t"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: anyChanged ? "rgba(34, 197, 94, 0.03)" : undefined,
                      }}
                    >
                      <td
                        className="px-4 py-2.5 sticky left-0 z-10"
                        style={{ background: anyChanged ? "rgba(34, 197, 94, 0.03)" : "var(--bg-card)" }}
                      >
                        <div className="text-sm font-medium" style={{ color: "var(--christmas-cream)" }}>
                          {user.name || "—"}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {user.email}
                        </div>
                      </td>
                      {permKeys.map((perm) => {
                        const isOn = getUserPerm(user.id, perm.key);
                        const stored = user.permissions?.[selectedApp]?.[perm.key] === true;
                        const isChanged = changes[user.id]?.[perm.key] !== undefined && changes[user.id][perm.key] !== stored;

                        return (
                          <td key={perm.key} className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => togglePerm(user.id, perm.key)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                              style={{
                                background: isOn ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                border: isChanged
                                  ? "2px solid var(--christmas-gold)"
                                  : "1px solid var(--border-subtle)",
                              }}
                              title={`${isOn ? "Revoke" : "Grant"} ${perm.label}`}
                            >
                              {isOn ? (
                                <svg className="w-4 h-4" style={{ color: "var(--christmas-green)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleAllPermsForUser(user.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
                          style={{
                            border: "1px solid var(--border-subtle)",
                            background: allEnabled ? "rgba(34, 197, 94, 0.1)" : "transparent",
                          }}
                          title={allEnabled ? "Revoke all permissions" : "Grant all permissions"}
                        >
                          {allEnabled ? (
                            <svg className="w-3.5 h-3.5" style={{ color: "var(--christmas-green)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div
          className="fixed bottom-0 left-64 right-0 px-8 py-4 flex items-center justify-between z-20"
          style={{
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {changedCount} user{changedCount !== 1 ? "s" : ""} modified
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleDiscard}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
      )}
    </div>
  );
}
