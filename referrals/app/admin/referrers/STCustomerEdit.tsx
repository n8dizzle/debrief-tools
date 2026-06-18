"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stCustomerUrl } from "@/lib/servicetitan-links";

interface Props {
  referrerId: string;
  initialId: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
}

type Mode = "id" | "search";

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; name: string; active: boolean }
  | { state: "not_found" }
  | { state: "error"; message: string };

/**
 * Inline editor for a referrer's ServiceTitan customer linkage.
 *
 * Two modes:
 *  - "Search" (default when linking) — type a name, email, or phone to find
 *    the right ST customer record and click to select it.
 *  - "ID" — paste the numeric ID directly (original behaviour, accessible via
 *    "enter ID" toggle for power users).
 *
 * Resting state: green pill (linked) or muted "link" button (not linked).
 */
export default function STCustomerEdit({ referrerId, initialId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>("search");

  // --- ID mode state ---
  const [idValue, setIdValue] = useState(initialId || "");
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const idInputRef = useRef<HTMLInputElement>(null);

  // --- Search mode state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced ST customer name preview (ID mode)
  useEffect(() => {
    if (!editing || mode !== "id") return;
    const trimmed = idValue.trim();
    if (!trimmed) { setPreview({ state: "idle" }); return; }
    if (!/^\d+$/.test(trimmed)) { setPreview({ state: "error", message: "Numbers only" }); return; }

    setPreview({ state: "loading" });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/servicetitan/customer/${encodeURIComponent(trimmed)}`);
        if (res.status === 404) { setPreview({ state: "not_found" }); return; }
        const data = await res.json();
        if (!res.ok) { setPreview({ state: "error", message: data.error || "Lookup failed" }); return; }
        setPreview({ state: "found", name: data.name, active: !!data.active });
      } catch {
        setPreview({ state: "error", message: "Network error" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editing, mode, idValue]);

  // Debounced ST customer search (search mode)
  useEffect(() => {
    if (!editing || mode !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/servicetitan/customers?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [editing, mode, searchQuery]);

  // Auto-focus on mode switch
  useEffect(() => {
    if (!editing) return;
    if (mode === "search") searchInputRef.current?.focus();
    else idInputRef.current?.focus();
  }, [editing, mode]);

  function startEdit() {
    setIdValue(initialId || "");
    setPreview({ state: "idle" });
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResult(null);
    setError(null);
    setMode("search");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setIdValue(initialId || "");
    setPreview({ state: "idle" });
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResult(null);
    setError(null);
  }

  async function save(overrideId?: string | null) {
    const stId = overrideId !== undefined
      ? overrideId
      : (mode === "id" ? idValue.trim() : (selectedResult?.id ?? ""));

    if (stId && !/^\d+$/.test(stId)) { setError("Must be numeric"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/referrers/${referrerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_titan_id: stId === "" ? null : stId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); setSaving(false); return; }
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  // ── Resting state ──────────────────────────────────────────────────────────
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
            <span aria-hidden="true" style={{ fontSize: "0.85em", opacity: 0.7 }}>↗</span>
          </a>
        ) : (
          <span className="text-xs opacity-60" title="Not linked to a ServiceTitan customer yet">—</span>
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

  // ── Editing state ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5" style={{ minWidth: 260 }}>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
        <button
          type="button"
          onClick={() => { setMode("search"); setSelectedResult(null); }}
          className="font-medium"
          style={{
            opacity: mode === "search" ? 1 : 0.45,
            textDecoration: mode === "search" ? "underline" : "none",
          }}
        >
          Search ST
        </button>
        <span style={{ opacity: 0.3 }}>|</span>
        <button
          type="button"
          onClick={() => setMode("id")}
          className="font-medium"
          style={{
            opacity: mode === "id" ? 1 : 0.45,
            textDecoration: mode === "id" ? "underline" : "none",
          }}
        >
          Enter ID
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="ml-auto opacity-50 hover:opacity-100"
          style={{ fontSize: "0.9em" }}
        >
          ✕
        </button>
      </div>

      {/* ── Search mode ── */}
      {mode === "search" && (
        <>
          <input
            ref={searchInputRef}
            className="input"
            style={{ padding: "5px 8px", fontSize: "0.8rem" }}
            placeholder="Name, email, or phone…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSelectedResult(null); }}
            disabled={saving}
          />

          {/* Results list */}
          {searchLoading && (
            <p className="text-xs opacity-50">Searching…</p>
          )}
          {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-xs opacity-50">No matches in ServiceTitan</p>
          )}
          {searchResults.length > 0 && !selectedResult && (
            <div
              className="rounded-md overflow-hidden"
              style={{ border: "1px solid var(--border-subtle)", maxHeight: 220, overflowY: "auto" }}
            >
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelectedResult(r); setSearchQuery(r.name); setSearchResults([]); }}
                  className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
                  style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
                >
                  <span className="font-medium">{r.name}</span>
                  {!r.active && <span className="opacity-50"> (inactive)</span>}
                  <span className="block opacity-50 mt-0.5">
                    {[r.email, r.phone].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected result confirmation */}
          {selectedResult && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{ background: "rgba(97,139,96,0.1)", border: "1px solid var(--ca-green)" }}
            >
              <p className="font-semibold" style={{ color: "var(--ca-dark-green)" }}>
                ✓ {selectedResult.name}
                {!selectedResult.active && <span className="opacity-60"> (inactive)</span>}
              </p>
              <p className="opacity-60 mt-0.5">
                ID {selectedResult.id}
                {selectedResult.email ? ` · ${selectedResult.email}` : ""}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => save(selectedResult?.id ?? "")}
              disabled={saving || !selectedResult}
              className="text-xs font-semibold px-3 py-1 rounded"
              style={{
                background: "var(--ca-green)",
                color: "var(--ca-cream)",
                opacity: saving || !selectedResult ? 0.45 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {initialId && (
              <button
                type="button"
                onClick={() => save(null)}
                disabled={saving}
                className="text-xs opacity-50 hover:opacity-100 underline"
              >
                unlink
              </button>
            )}
          </div>
        </>
      )}

      {/* ── ID mode ── */}
      {mode === "id" && (
        <>
          <div className="flex items-center gap-1.5">
            <input
              ref={idInputRef}
              className="input"
              style={{ padding: "4px 8px", fontSize: "0.8rem", width: "110px" }}
              value={idValue}
              onChange={(e) => setIdValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                else if (e.key === "Escape") cancelEdit();
              }}
              placeholder="ST customer ID"
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{ background: "var(--ca-green)", color: "var(--ca-cream)", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "…" : "Save"}
            </button>
          </div>

          {preview.state === "found" && (
            <p className="text-xs" style={{ color: "var(--ca-dark-green)" }}>
              → <strong>{preview.name}</strong>
              {!preview.active && <span className="opacity-60"> (inactive)</span>}
            </p>
          )}
          {preview.state === "loading" && <p className="text-xs opacity-60">→ looking up…</p>}
          {preview.state === "not_found" && (
            <p className="text-xs" style={{ color: "var(--ca-red)" }}>→ not found in ServiceTitan</p>
          )}
          {preview.state === "error" && (
            <p className="text-xs" style={{ color: "var(--ca-red)" }}>{preview.message}</p>
          )}

          <p className="text-[10px] opacity-50">
            From <code>go.servicetitan.com/#/customer/<strong>N</strong></code>. Leave blank to unlink.
          </p>
        </>
      )}

      {error && <p className="text-xs" style={{ color: "var(--ca-red)" }}>{error}</p>}
    </div>
  );
}
