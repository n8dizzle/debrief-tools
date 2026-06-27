"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";

export interface AdminColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  render: (row: T) => React.ReactNode;
  /** Optional totals-row cell, given the currently-displayed rows. */
  footer?: (rows: T[]) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
  /** Default column width in px. Falls back to DEFAULT_WIDTH. */
  width?: number;
  /** Minimum width in px when resizing. Falls back to MIN_WIDTH. */
  minWidth?: number;
}

interface Props<T> {
  /** Stable id used to persist column widths + order in localStorage (one per table). */
  tableId: string;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Show the built-in search box. Off when the page supplies its own filters. */
  showSearch?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 60;

function sanitizeWidths(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function sanitizeOrder(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is string => typeof k === "string");
  } catch {
    return [];
  }
}

export default function AdminTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  onRowClick,
  showSearch = true,
  searchPlaceholder = "Search…",
  emptyMessage,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ---- Persisted layout (widths + order) ----
  const widthsKey = `ap-payments-admintable-${tableId}-widths`;
  const orderKey = `ap-payments-admintable-${tableId}-order`;
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>([]);
  const widthsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const w = sanitizeWidths(localStorage.getItem(widthsKey));
    widthsRef.current = w;
    setWidths(w);
    setOrder(sanitizeOrder(localStorage.getItem(orderKey)));
  }, [widthsKey, orderKey]);

  // Apply saved order; append any columns not in the saved order (e.g. newly added).
  const orderedColumns = useMemo(() => {
    if (!order.length) return columns;
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const result: AdminColumn<T>[] = [];
    for (const k of order) {
      const c = byKey.get(k);
      if (c) { result.push(c); byKey.delete(k); }
    }
    for (const c of columns) if (byKey.has(c.key)) result.push(c);
    return result;
  }, [columns, order]);

  const colWidth = useCallback(
    (col: AdminColumn<T>) => widths[col.key] ?? col.width ?? DEFAULT_WIDTH,
    [widths]
  );

  // ---- Resize via drag handle ----
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, col: AdminColumn<T>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = { key: col.key, startX: e.clientX, startW: colWidth(col) };
      setResizingKey(col.key);
    },
    [colWidth]
  );

  useEffect(() => {
    if (!resizingKey) return;
    const onMove = (e: MouseEvent) => {
      const ctx = resizeRef.current;
      if (!ctx) return;
      const col = columns.find((c) => c.key === ctx.key);
      const min = col?.minWidth ?? MIN_WIDTH;
      const next = Math.max(min, ctx.startW + (e.clientX - ctx.startX));
      widthsRef.current = { ...widthsRef.current, [ctx.key]: next };
      setWidths(widthsRef.current);
    };
    const onUp = () => {
      setResizingKey(null);
      resizeRef.current = null;
      try { localStorage.setItem(widthsKey, JSON.stringify(widthsRef.current)); } catch { /* ignore */ }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizingKey, columns, widthsKey]);

  // ---- Drag to reorder columns ----
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function persistOrder(next: string[]) {
    setOrder(next);
    try { localStorage.setItem(orderKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function handleDrop(targetKey: string) {
    if (!draggedKey || draggedKey === targetKey) { setDraggedKey(null); setDragOverKey(null); return; }
    const keys = orderedColumns.map((c) => c.key);
    const from = keys.indexOf(draggedKey);
    const to = keys.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    persistOrder(keys);
    setDraggedKey(null);
    setDragOverKey(null);
  }

  function resetLayout() {
    widthsRef.current = {};
    setWidths({});
    setOrder([]);
    try { localStorage.removeItem(widthsKey); localStorage.removeItem(orderKey); } catch { /* ignore */ }
  }

  const hasCustomLayout = Object.keys(widths).length > 0 || order.length > 0;

  // ---- Search + sort ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => col.searchValue && col.searchValue(row).toLowerCase().includes(q))
    );
  }, [rows, columns, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortIndicator(key: string) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div>
      {(showSearch || hasCustomLayout) && (
        <div className="mb-3 flex items-center gap-3">
          {showSearch && (
            <input type="search" className="rounded-lg px-3 py-2 text-sm w-full max-w-sm"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
          {hasCustomLayout && (
            <button type="button" onClick={resetLayout} className="text-xs underline whitespace-nowrap"
              style={{ color: "var(--text-muted)" }}>Reset columns</button>
          )}
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="overflow-x-auto overflow-y-auto" style={{ maxWidth: "100%", maxHeight: "calc(100vh - 300px)" }}>
          <table className="text-sm" style={{ minWidth: "max-content", borderCollapse: "collapse" }}>
            <thead className="sticky top-0 z-10" style={{ background: "var(--bg-secondary)" }}>
              <tr>
                {orderedColumns.map((col) => {
                  const w = colWidth(col);
                  return (
                    <th key={col.key}
                      draggable={!resizingKey}
                      onDragStart={() => setDraggedKey(col.key)}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverKey !== col.key) setDragOverKey(col.key); }}
                      onDragEnd={() => { setDraggedKey(null); setDragOverKey(null); }}
                      onDrop={() => handleDrop(col.key)}
                      className={`relative px-3 py-2.5 text-xs font-semibold uppercase tracking-wide ${col.className ?? ""}`}
                      style={{
                        color: "var(--text-muted)",
                        textAlign: col.align ?? "left",
                        cursor: col.sortable ? "pointer" : "grab",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        width: w,
                        minWidth: col.minWidth ?? MIN_WIDTH,
                        opacity: draggedKey === col.key ? 0.4 : 1,
                        boxShadow: dragOverKey === col.key && draggedKey !== col.key ? "inset 2px 0 0 0 var(--christmas-green)" : undefined,
                      }}
                      onClick={col.sortable && !resizingKey ? () => handleSort(col.key) : undefined}
                    >
                      <span className="truncate inline-block align-middle" style={{ maxWidth: "calc(100% - 14px)" }}>{col.label}</span>
                      {col.sortable && <span style={{ opacity: sortKey === col.key ? 1 : 0.4 }}>{sortIndicator(col.key)}</span>}
                      <span aria-hidden="true" draggable={false}
                        onMouseDown={(e) => handleResizeStart(e, col)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-0 right-0 h-full flex justify-end"
                        style={{ width: 9, cursor: "col-resize" }}>
                        <span className="h-full" style={{ width: 2, background: resizingKey === col.key ? "var(--christmas-green)" : "var(--border-subtle)" }} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer hover:bg-white/5" : undefined}
                  style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  {orderedColumns.map((col) => {
                    const w = colWidth(col);
                    return (
                      <td key={col.key}
                        className={`px-3 py-2.5 ${col.className ?? ""}`}
                        style={{ width: w, maxWidth: w, textAlign: col.align ?? "left", overflow: "hidden" }}>
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={orderedColumns.length} className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
                    {search.trim() ? `No results for "${search.trim()}"` : (emptyMessage ?? "No rows.")}
                  </td>
                </tr>
              )}
            </tbody>
            {columns.some((c) => c.footer) && sorted.length > 0 && (
              <tfoot className="sticky bottom-0 z-10" style={{ background: "var(--bg-secondary)" }}>
                <tr>
                  {orderedColumns.map((col) => {
                    const w = colWidth(col);
                    return (
                      <td key={col.key}
                        className="px-3 py-2.5 font-semibold tabular-nums"
                        style={{ width: w, maxWidth: w, textAlign: col.align ?? "left", whiteSpace: "nowrap", borderTop: "2px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                        {col.footer ? col.footer(sorted) : null}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
