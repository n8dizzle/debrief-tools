"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Charity, CharityFulfillment } from "@/lib/supabase";

const FULFILLMENT_OPTIONS: { value: CharityFulfillment; label: string }[] = [
  { value: "TREMENDOUS", label: "Tremendous (auto-fulfilled)" },
  { value: "POOLED_QUARTERLY", label: "Pooled quarterly batch" },
  { value: "DIRECT_PAYMENT", label: "Direct payment (manual)" },
];

type Editing = Partial<Charity> & { _isNew?: boolean };

export default function CharitiesEditor({ initial }: { initial: Charity[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setEditing({
      _isNew: true,
      name: "",
      description: "",
      fulfillment_method: "TREMENDOUS",
      display_order: initial.length + 1,
      is_active: true,
    });
    setError(null);
  }

  function startEdit(c: Charity) {
    setEditing({ ...c });
    setError(null);
  }

  async function save() {
    if (!editing) return;
    if (!editing.name?.trim() || !editing.description?.trim()) {
      setError("Name and description are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const isNew = editing._isNew;
      const { _isNew, id, created_at, ...payload } = editing;
      void _isNew;
      void created_at;

      const url = isNew ? "/api/admin/charities" : `/api/admin/charities/${id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setBusy(false);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this charity? Existing referrals are unaffected; new ones won't be able to choose it.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/charities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Deactivate failed");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={startNew} className="btn btn-primary">
          + Add charity
        </button>
      </div>

      <div className="grid gap-4">
        {initial.map((c) => (
          <div
            key={c.id}
            className="card"
            style={{
              opacity: c.is_active ? 1 : 0.5,
              borderLeftWidth: "4px",
              borderLeftColor: c.is_active ? "var(--ca-green)" : "var(--border-default)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl mb-1">
                  {c.name}{" "}
                  {!c.is_active && (
                    <span className="text-xs opacity-60">(inactive)</span>
                  )}
                </h3>
                <p className="opacity-80 text-sm mb-2">{c.description}</p>
                <div className="flex flex-wrap gap-3 text-xs opacity-70">
                  <span>
                    Fulfillment:{" "}
                    <strong>{c.fulfillment_method.toLowerCase().replace(/_/g, " ")}</strong>
                  </span>
                  <span>Order: {c.display_order}</span>
                  {c.website_url && (
                    <a href={c.website_url} target="_blank" rel="noopener">
                      Website ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="btn btn-secondary text-sm py-1 px-3"
                  onClick={() => startEdit(c)}
                >
                  Edit
                </button>
                {c.is_active && (
                  <button
                    className="text-xs opacity-70 hover:opacity-100"
                    style={{ color: "var(--ca-red)" }}
                    onClick={() => deactivate(c.id)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setEditing(null)}
        >
          <div
            className="card max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-4">
              {editing._isNew ? "New charity" : "Edit charity"}
            </h2>

            <Field label="Name">
              <input
                className="input"
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>

            <Field label="Description">
              <textarea
                className="input"
                rows={3}
                value={editing.description || ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </Field>

            <Field label="Website URL (optional)">
              <input
                className="input"
                type="url"
                value={editing.website_url || ""}
                onChange={(e) =>
                  setEditing({ ...editing, website_url: e.target.value || null })
                }
              />
            </Field>

            <Field label="Fulfillment method">
              <select
                className="input"
                value={editing.fulfillment_method || "TREMENDOUS"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    fulfillment_method: e.target.value as CharityFulfillment,
                  })
                }
              >
                {FULFILLMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            {editing.fulfillment_method === "TREMENDOUS" && (
              <Field label="Tremendous charity product ID (optional — falls back to generic charity product)">
                <input
                  className="input"
                  value={editing.tremendous_charity_id || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      tremendous_charity_id: e.target.value || null,
                    })
                  }
                />
              </Field>
            )}

            <Field label="EIN (optional, for direct payments)">
              <input
                className="input"
                value={editing.ein || ""}
                onChange={(e) =>
                  setEditing({ ...editing, ein: e.target.value || null })
                }
              />
            </Field>

            <Field label="Display order">
              <input
                className="input"
                type="number"
                min={0}
                value={editing.display_order || 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
              />
            </Field>

            {error && (
              <p
                className="mb-4 p-3 rounded-lg text-sm"
                style={{
                  background: "rgba(135,76,59,0.1)",
                  color: "var(--ca-red)",
                  border: "1px solid var(--ca-red)",
                }}
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold mb-2">{label}</span>
      {children}
    </label>
  );
}
