"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";

export interface AdminColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Default column width in px. Falls back to DEFAULT_WIDTH. */
  width?: number;
  /** Minimum width in px when resizing. Falls back to MIN_WIDTH. */
  minWidth?: number;
  /** Clip overflow with an ellipsis instead of letting the cell grow. Use for free text (names, emails, charity). */
  truncate?: boolean;
  /** Tooltip shown on hover for truncated cells. Defaults to searchValue(row). */
  title?: (row: T) => string;
}

interface Props<T> {
  /** Stable id used to persist column widths in localStorage (one per table). */
  tableId: string;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

const DEFAULT_WIDTH = 160;
const MIN_WIDTH = 60;

/** Parse persisted widths defensively: only keep finite, positive numbers. */
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

export default function AdminTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  searchPlaceholder = "Search…",
  emptyMessage,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ---- Column widths (persisted per table) ----
  const storageKey = `referrals-admintable-${tableId}-widths`;
  const [widths, setWidths] = useState<Record<string, number>>({});
  const widthsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const clean = sanitizeWidths(localStorage.getItem(storageKey));
    widthsRef.current = clean;
    setWidths(clean);
  }, [storageKey]);

  const colWidth = useCallback(
    (col: AdminColumn<T>) => widths[col.key] ?? col.width ?? DEFAULT_WIDTH,
    [widths]
  );

  // ---- Resize via drag handle (mouse events, no library) ----
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
      try {
        localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
      } catch {
        /* ignore */
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizingKey, columns, storageKey]);

  function resetWidths() {
    widthsRef.current = {};
    setWidths({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  const hasCustomWidths = Object.keys(widths).length > 0;

  // ---- Search + sort ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some(
        (col) => col.searchValue && col.searchValue(row).toLowerCase().includes(q)
      )
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
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: string) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="search"
          className="input w-full max-w-sm"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hasCustomWidths && (
          <button
            type="button"
            onClick={resetWidths}
            className="text-xs underline whitespace-nowrap"
            style={{ color: "var(--text-muted)" }}
          >
            Reset columns
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxWidth: "100%", maxHeight: "calc(100vh - 320px)" }}
        >
          <table
            className="text-sm"
            style={{ minWidth: "max-content", borderCollapse: "collapse" }}
          >
            <thead
              className="sticky top-0 z-10"
              style={{ background: "var(--bg-muted)" }}
            >
              <tr>
                {columns.map((col) => {
                  const w = colWidth(col);
                  return (
                    <th
                      key={col.key}
                      className={`relative text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide ${col.className ?? ""}`}
                      style={{
                        color: "var(--text-muted)",
                        cursor: col.sortable ? "pointer" : undefined,
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        width: w,
                        minWidth: col.minWidth ?? MIN_WIDTH,
                      }}
                      onClick={
                        col.sortable && !resizingKey
                          ? () => handleSort(col.key)
                          : undefined
                      }
                    >
                      <span
                        className="truncate inline-block align-middle"
                        style={{ maxWidth: "calc(100% - 14px)" }}
                      >
                        {col.label}
                      </span>
                      {col.sortable && (
                        <span style={{ opacity: sortKey === col.key ? 1 : 0.4 }}>
                          {sortIndicator(col.key)}
                        </span>
                      )}
                      {/* Resize handle: faint divider always visible, brand green while active */}
                      <span
                        aria-hidden="true"
                        onMouseDown={(e) => handleResizeStart(e, col)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-0 right-0 h-full flex justify-end"
                        style={{ width: 9, cursor: "col-resize" }}
                      >
                        <span
                          className="h-full"
                          style={{
                            width: 2,
                            background:
                              resizingKey === col.key
                                ? "var(--ca-dark-green)"
                                : "var(--border-subtle)",
                          }}
                        />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  {columns.map((col) => {
                    const w = colWidth(col);
                    if (col.truncate) {
                      const tip =
                        col.title?.(row) ?? col.searchValue?.(row) ?? undefined;
                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 overflow-hidden ${col.className ?? ""}`}
                          style={{ width: w, maxWidth: w }}
                        >
                          {/* Explicit maxWidth on the inner div makes ellipsis work
                              regardless of table layout algorithm. */}
                          <div className="truncate" style={{ maxWidth: w - 24 }} title={tip}>
                            {col.render(row)}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${col.className ?? ""}`}
                        style={{ width: w }}
                      >
                        {col.render(row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="p-8 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {search.trim()
                      ? `No results for "${search.trim()}"`
                      : (emptyMessage ?? "No rows.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {search.trim() && sorted.length > 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {sorted.length} of {rows.length} shown
        </p>
      )}
    </div>
  );
}
