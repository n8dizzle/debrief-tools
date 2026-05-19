"use client";

import { useState, useMemo } from "react";

export interface AdminColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

export default function AdminTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = "Search…",
  emptyMessage,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some(
        (col) =>
          col.searchValue &&
          col.searchValue(row).toLowerCase().includes(q)
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
      <div className="mb-4">
        <input
          type="search"
          className="input w-full max-w-sm"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--bg-muted)" }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left p-3 text-xs font-semibold uppercase tracking-wide ${col.className ?? ""}`}
                  style={{
                    color: "var(--text-muted)",
                    cursor: col.sortable ? "pointer" : undefined,
                    userSelect: col.sortable ? "none" : undefined,
                    whiteSpace: "nowrap",
                  }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && (
                    <span style={{ opacity: sortKey === col.key ? 1 : 0.4 }}>
                      {sortIndicator(col.key)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-3 ${col.className ?? ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
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

      {search.trim() && sorted.length > 0 && (
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {sorted.length} of {rows.length} shown
        </p>
      )}
    </div>
  );
}
