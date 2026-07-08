"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  width?: number;                       // default width (px)
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode; // custom cell
  sortValue?: (row: T) => string | number;
  filterValue?: (row: T) => string;     // text used for quick-filter matching
}

// Reusable table modeled on ar.christmasair.com: quick-filter search, click-to-sort
// headers (asc → desc → off), and drag-to-resize columns persisted to localStorage.
export default function DataTable<T>({
  columns, rows, storageKey, searchable = true, initialSort, emptyText = "Nothing here.",
}: {
  columns: Column<T>[]; rows: T[]; storageKey: string; searchable?: boolean;
  initialSort?: { key: string; dir: "asc" | "desc" }; emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort || null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setWidths(JSON.parse(s)); } catch {}
  }, [storageKey]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(60, r.startW + (e.clientX - r.startX));
      setWidths((prev) => ({ ...prev, [r.key]: w }));
    };
    const up = () => {
      if (resizing.current) {
        resizing.current = null;
        setWidths((prev) => { try { localStorage.setItem(storageKey, JSON.stringify(prev)); } catch {} return prev; });
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [storageKey]);

  const field = (r: T, key: string) => (r as Record<string, unknown>)[key];
  const cellText = (c: Column<T>, r: T) =>
    c.filterValue ? c.filterValue(r) : c.sortValue ? String(c.sortValue(r)) : String(field(r, c.key) ?? "");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => columns.some((c) => cellText(c, r).toLowerCase().includes(q)));
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const val = (r: T) => (col.sortValue ? col.sortValue(r) : (field(r, col.key) as string | number));
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <div>
      {searchable && (
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <input className="input" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: 12 }}>
        <table className="ar-table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} style={{ width: widths[c.key] || c.width || 160, position: "relative", userSelect: "none", textAlign: c.align || "left" }}>
                    <span onClick={() => toggleSort(c.key)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {c.label}
                      <span style={{ opacity: active ? 1 : 0.25, fontSize: 10 }}>{active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </span>
                    <span
                      onMouseDown={(e) => { resizing.current = { key: c.key, startX: e.clientX, startW: widths[c.key] || c.width || 160 }; e.preventDefault(); }}
                      style={{ position: "absolute", right: 0, top: 0, height: "100%", width: 8, cursor: "col-resize" }}
                      title="Drag to resize"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length} style={{ color: "var(--text-muted)" }}>{query ? "No matches." : emptyText}</td></tr>
            )}
            {sorted.map((r, i) => (
              <tr key={(field(r, "id") as string) || i}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align || "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.render ? c.render(r) : String(field(r, c.key) ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{sorted.length} of {rows.length}</div>
    </div>
  );
}
