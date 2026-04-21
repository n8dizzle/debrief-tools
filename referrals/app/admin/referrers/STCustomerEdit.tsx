"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stCustomerUrl } from "@/lib/servicetitan-links";

interface Props {
  referrerId: string;
  initialId: string | null;
}

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; name: string; active: boolean }
  | { state: "not_found" }
  | { state: "error"; message: string };

/**
 * Inline editor for a referrer's ServiceTitan customer linkage.
 *  - Resting state: green pill (linked) or muted "Link" button (not linked).
 *  - Editing state: numeric input + debounced name preview from ST + Save/Cancel.
 * Admin can clear the linkage by saving an empty value.
 */
export default function STCustomerEdit({ referrerId, initialId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialId || "");
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced preview lookup. Fires ~400ms after the admin stops typing so
  // we don't hammer ST on every keystroke. The lookup is cheap but pointless
  // mid-type.
  useEffect(() => {
    if (!editing) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setPreview({ state: "idle" });
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setPreview({ state: "error", message: "Numbers only" });
      return;
    }
    setPreview({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/servicetitan/customer/${encodeURIComponent(trimmed)}`
        );
        if (res.status === 404) {
          setPreview({ state: "not_found" });
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setPreview({ state: "error", message: data.error || "Lookup failed" });
          return;
        }
        setPreview({
          state: "found",
          name: data.name,
          active: !!data.active,
        });
      } catch {
        setPreview({ state: "error", message: "Network error" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editing, value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setValue(initialId || "");
    setPreview({ state: "idle" });
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setValue(initialId || "");
    setPreview({ state: "idle" });
    setError(null);
  }

  async function save() {
    const trimmed = value.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setError("Must be numeric");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/referrers/${referrerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_titan_id: trimmed === "" ? null : trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setSaving(false);
        return;
      }
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {initialId ? (
          <a
            href={stCustomerUrl(initialId) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(97,139,96,0.12)",
              color: "var(--ca-dark-green)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            title={`Open in ServiceTitan (${initialId})`}
          >
            <span>{initialId}</span>
            <span aria-hidden="true" style={{ fontSize: "0.85em", opacity: 0.7 }}>
              ↗
            </span>
          </a>
        ) : (
          <span
            className="text-xs opacity-60"
            title="Not linked to a ServiceTitan customer yet"
          >
            —
          </span>
        )}
        <button
          type="button"
          onClick={startEdit}
          className="text-xs opacity-60 hover:opacity-100 underline"
          style={{ color: "var(--ca-dark-green)" }}
        >
          {initialId ? "edit" : "link"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          className="input"
          style={{ padding: "4px 8px", fontSize: "0.8rem", width: "110px" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancelEdit();
          }}
          placeholder="ST ID"
          disabled={saving}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-xs font-semibold px-2 py-1 rounded"
          style={{
            background: "var(--ca-green)",
            color: "var(--ca-cream)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={saving}
          className="text-xs opacity-70 hover:opacity-100 underline"
        >
          cancel
        </button>
      </div>

      {preview.state === "found" && (
        <p className="text-xs" style={{ color: "var(--ca-dark-green)" }}>
          → <strong>{preview.name}</strong>
          {!preview.active && (
            <span className="opacity-60"> (inactive)</span>
          )}
        </p>
      )}
      {preview.state === "loading" && (
        <p className="text-xs opacity-60">→ looking up…</p>
      )}
      {preview.state === "not_found" && (
        <p className="text-xs" style={{ color: "var(--ca-red)" }}>
          → not found in ServiceTitan
        </p>
      )}
      {preview.state === "error" && (
        <p className="text-xs" style={{ color: "var(--ca-red)" }}>
          {preview.message}
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--ca-red)" }}>
          {error}
        </p>
      )}

      <p className="text-[10px] opacity-50">
        Paste numeric ID from{" "}
        <code>go.servicetitan.com/#/customer/<strong>N</strong></code>. Leave
        blank to unlink.
      </p>
    </div>
  );
}
