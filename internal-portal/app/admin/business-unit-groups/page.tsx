"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface BU {
  business_unit_id: number;
  business_unit_name: string | null;
}

interface Group {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  members: BU[];
}

export default function BusinessUnitGroupsPage() {
  const { isOwner, isLoading: permsLoading } = usePermissions();

  const [groups, setGroups] = useState<Group[]>([]);
  const [availableBUs, setAvailableBUs] = useState<BU[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [buPickerSelection, setBuPickerSelection] = useState<string>("");

  useEffect(() => {
    if (!permsLoading && isOwner) {
      fetchAll();
    }
  }, [permsLoading, isOwner]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [gRes, bRes] = await Promise.all([
        fetch("/api/business-unit-groups", { credentials: "include" }),
        fetch("/api/business-unit-groups/available-bus", { credentials: "include" }),
      ]);
      if (gRes.ok) {
        const data = await gRes.json();
        setGroups(data.groups || []);
      }
      if (bRes.ok) {
        const data = await bRes.json();
        setAvailableBUs(data.businessUnits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function createGroup() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/business-unit-groups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) => [...prev, { ...data.group, members: [] }]);
        setNewLabel("");
        flash("success", "Group created");
      } else {
        flash("error", data.error || "Failed to create group");
      }
    } catch (err) {
      flash("error", "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  async function updateGroup(id: string, updates: { label?: string; members?: BU[] }) {
    try {
      const res = await fetch(`/api/business-unit-groups/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...data.group } : g)));
        flash("success", "Saved");
      } else {
        flash("error", data.error || "Failed to save");
      }
    } catch (err) {
      flash("error", "Failed to save");
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm("Delete this group? Business units in it will become unassigned.")) return;
    try {
      const res = await fetch(`/api/business-unit-groups/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id));
        flash("success", "Group deleted");
      } else {
        const data = await res.json();
        flash("error", data.error || "Failed to delete");
      }
    } catch (err) {
      flash("error", "Failed to delete");
    }
  }

  async function moveGroup(id: string, direction: "up" | "down") {
    const idx = groups.findIndex((g) => g.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groups.length) return;

    const reordered = [...groups];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setGroups(reordered);

    // Persist sort_order for both affected groups.
    for (let i = 0; i < reordered.length; i++) {
      const g = reordered[i];
      const newOrder = i + 1;
      if (g.sort_order !== newOrder) {
        fetch(`/api/business-unit-groups/${g.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: newOrder }),
        }).catch((err) => console.error(err));
      }
    }
  }

  function removeBU(group: Group, buId: number) {
    const nextMembers = group.members.filter((m) => m.business_unit_id !== buId);
    updateGroup(group.id, { members: nextMembers });
  }

  function addBU(group: Group, buId: number) {
    const bu = availableBUs.find((b) => b.business_unit_id === buId);
    if (!bu) return;
    // 1 BU → 1 group is enforced by the DB (business_unit_id is PK in the members
    // table). Upserting via the API will move it out of any other group.
    const nextMembers = [...group.members.filter((m) => m.business_unit_id !== buId), bu];
    updateGroup(group.id, { members: nextMembers });
    setAddingToGroupId(null);
    setBuPickerSelection("");
  }

  const assignedBUIds = useMemo(() => {
    const s = new Set<number>();
    for (const g of groups) for (const m of g.members) s.add(m.business_unit_id);
    return s;
  }, [groups]);

  const unassignedBUs = useMemo(
    () => availableBUs.filter((b) => !assignedBUIds.has(b.business_unit_id)),
    [availableBUs, assignedBUIds],
  );

  if (permsLoading) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--status-error)" }}>Owner access required.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Business Unit Groups
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Group ServiceTitan business units into categories leadership uses
          (e.g. HVAC&nbsp;-&nbsp;Install, HVAC&nbsp;-&nbsp;Ser/Maint, Plumbing). Other apps can
          consume these groups to power quick filters and reports.
        </p>
      </div>

      {message && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            backgroundColor:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color:
              message.type === "success"
                ? "var(--status-success)"
                : "var(--status-error)",
          }}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="card">
          <p style={{ color: "var(--text-muted)" }}>Loading groups…</p>
        </div>
      ) : (
        <>
          {/* Groups */}
          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="card">
                <p style={{ color: "var(--text-muted)" }}>
                  No groups yet. Create one below to start grouping business units.
                </p>
              </div>
            ) : (
              groups.map((group, index) => (
                <div key={group.id} className="card">
                  {/* Row 1: label + actions */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveGroup(group.id, "up")}
                        disabled={index === 0}
                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveGroup(group.id, "down")}
                        disabled={index === groups.length - 1}
                        className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1">
                      {editingId === group.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded text-sm"
                            style={{
                              backgroundColor: "var(--bg-tertiary)",
                              color: "var(--christmas-cream)",
                              border: "1px solid var(--christmas-green)",
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingLabel.trim()) {
                                updateGroup(group.id, { label: editingLabel.trim() });
                                setEditingId(null);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => {
                              if (editingLabel.trim()) updateGroup(group.id, { label: editingLabel.trim() });
                              setEditingId(null);
                            }}
                            className="btn btn-primary"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="btn btn-secondary">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold" style={{ color: "var(--christmas-cream)" }}>
                            {group.label}
                          </h3>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {group.members.length} business unit{group.members.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      )}
                    </div>

                    {editingId !== group.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingId(group.id);
                            setEditingLabel(group.label);
                          }}
                          className="p-1.5 rounded hover:bg-white/10"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="p-1.5 rounded hover:bg-red-500/20"
                          title="Delete group"
                        >
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22m-5 0V4a1 1 0 00-1-1H9a1 1 0 00-1 1v3" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Members chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {group.members.length === 0 ? (
                      <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                        No business units assigned yet.
                      </span>
                    ) : (
                      group.members
                        .slice()
                        .sort((a, b) =>
                          (a.business_unit_name || "").localeCompare(b.business_unit_name || ""),
                        )
                        .map((m) => (
                          <span
                            key={m.business_unit_id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: "var(--bg-secondary)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            {m.business_unit_name || `BU #${m.business_unit_id}`}
                            <button
                              onClick={() => removeBU(group, m.business_unit_id)}
                              className="hover:text-red-400"
                              title="Remove from group"
                              aria-label="Remove"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))
                    )}
                  </div>

                  {/* Add BU */}
                  {addingToGroupId === group.id ? (
                    <div className="flex gap-2">
                      <select
                        value={buPickerSelection}
                        onChange={(e) => setBuPickerSelection(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded text-sm"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          color: "var(--christmas-cream)",
                          border: "1px solid var(--border-subtle)",
                        }}
                        autoFocus
                      >
                        <option value="">Select a business unit…</option>
                        {availableBUs.map((b) => {
                          const otherGroup = groups.find(
                            (g) =>
                              g.id !== group.id &&
                              g.members.some((m) => m.business_unit_id === b.business_unit_id),
                          );
                          return (
                            <option key={b.business_unit_id} value={b.business_unit_id}>
                              {b.business_unit_name || `BU #${b.business_unit_id}`}
                              {otherGroup ? ` (currently in ${otherGroup.label})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => {
                          const id = Number(buPickerSelection);
                          if (id) addBU(group, id);
                        }}
                        disabled={!buPickerSelection}
                        className="btn btn-primary"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingToGroupId(null);
                          setBuPickerSelection("");
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingToGroupId(group.id)}
                      className="text-xs"
                      style={{ color: "var(--christmas-green)" }}
                    >
                      + Add business unit
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add new group */}
          <div className="card">
            <h3 className="font-semibold mb-3" style={{ color: "var(--christmas-cream)" }}>
              Add New Group
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group name (e.g. HVAC - Install)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLabel.trim()) createGroup();
                }}
                className="flex-1 px-3 py-2 rounded text-sm"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--christmas-cream)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
              <button
                onClick={createGroup}
                disabled={creating || !newLabel.trim()}
                className="btn btn-primary"
              >
                {creating ? "Creating…" : "Create Group"}
              </button>
            </div>
          </div>

          {/* Unassigned BUs */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ color: "var(--christmas-cream)" }}>
                Unassigned Business Units
              </h3>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {unassignedBUs.length} of {availableBUs.length}
              </span>
            </div>
            {unassignedBUs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                All business units are assigned to groups.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unassignedBUs.map((b) => (
                  <span
                    key={b.business_unit_id}
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-muted)",
                      border: "1px dashed var(--border-subtle)",
                    }}
                  >
                    {b.business_unit_name || `BU #${b.business_unit_id}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
