'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ColumnPrefs {
  order: string[];              // column keys in display order
  widths: Record<string, number>;
  hidden: string[];             // hidden column keys
  frozen: number;               // # of leading (visible) columns pinned left
}

const storageKey = (board: string) => `pe_colprefs_${board}`;

function sanitize(raw: Partial<ColumnPrefs> | null, allKeys: string[], defFrozen: number): ColumnPrefs {
  const known = new Set(allKeys);
  // Keep saved order (known keys only), then append any new keys not yet saved.
  const savedOrder = (raw?.order || []).filter(k => known.has(k));
  const order = [...savedOrder, ...allKeys.filter(k => !savedOrder.includes(k))];
  const widths: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw?.widths || {})) {
    if (known.has(k) && typeof v === 'number' && v > 0) widths[k] = v;
  }
  const hidden = (raw?.hidden || []).filter(k => known.has(k));
  const frozen = Math.max(0, Math.min(raw?.frozen ?? defFrozen, allKeys.length));
  return { order, widths, hidden, frozen };
}

function load(board: string, allKeys: string[], defFrozen: number): ColumnPrefs {
  if (typeof window === 'undefined') return sanitize(null, allKeys, defFrozen);
  try {
    const raw = localStorage.getItem(storageKey(board));
    return sanitize(raw ? JSON.parse(raw) : null, allKeys, defFrozen);
  } catch {
    return sanitize(null, allKeys, defFrozen);
  }
}

/**
 * Per-board column preferences: order, widths, hidden set, and how many leading
 * columns are frozen (pinned left).
 *
 * Durable, per-user storage: the source of truth is the DB (pe_user_column_prefs,
 * keyed on user_id+board) via /api/column-prefs, so a person's layout follows them
 * across devices. localStorage is kept as an instant seed (no first-paint flash)
 * and an offline fallback — the server copy wins once it loads.
 */
export function useColumnPrefs(board: string, allKeys: string[], defaultFrozen = 1) {
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => load(board, allKeys, defaultFrozen));
  const loaded = useRef(false);

  // Load the durable per-user copy from the server (localStorage was the instant seed).
  useEffect(() => {
    loaded.current = false;
    let cancelled = false;
    fetch(`/api/column-prefs?board=${encodeURIComponent(board)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && data.prefs) setPrefs(sanitize(data.prefs, allKeys, defaultFrozen));
      })
      .catch(() => { /* offline → keep the localStorage copy */ })
      .finally(() => { if (!cancelled) loaded.current = true; });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  // Re-sync if the column set itself changes (e.g. a new column was added in code).
  useEffect(() => {
    setPrefs(p => sanitize(p, allKeys, defaultFrozen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKeys.join('|')]);

  // Persist: localStorage immediately (cache/offline), server debounced (durable).
  useEffect(() => {
    try { localStorage.setItem(storageKey(board), JSON.stringify(prefs)); } catch { /* ignore quota */ }
    if (!loaded.current) return;  // don't echo the server copy back during hydration
    const t = setTimeout(() => {
      fetch('/api/column-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, prefs }),
      }).catch(() => { /* offline → localStorage still holds it */ });
    }, 600);
    return () => clearTimeout(t);
  }, [board, prefs]);

  const isHidden = useCallback((key: string) => prefs.hidden.includes(key), [prefs.hidden]);

  const toggleHidden = useCallback((key: string) => {
    setPrefs(p => ({
      ...p,
      hidden: p.hidden.includes(key) ? p.hidden.filter(k => k !== key) : [...p.hidden, key],
    }));
  }, []);

  const setWidth = useCallback((key: string, width: number) => {
    setPrefs(p => ({ ...p, widths: { ...p.widths, [key]: width } }));
  }, []);

  const setFrozen = useCallback((n: number) => {
    setPrefs(p => ({ ...p, frozen: Math.max(0, n) }));
  }, []);

  // Move column `fromKey` so it lands just before `beforeKey` (or to the end if null).
  const moveColumn = useCallback((fromKey: string, beforeKey: string | null) => {
    setPrefs(p => {
      if (fromKey === beforeKey) return p;
      const order = p.order.filter(k => k !== fromKey);
      const idx = beforeKey ? order.indexOf(beforeKey) : order.length;
      order.splice(idx < 0 ? order.length : idx, 0, fromKey);
      return { ...p, order };
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(sanitize(null, allKeys, defaultFrozen));
  }, [allKeys, defaultFrozen]);

  return { prefs, isHidden, toggleHidden, setWidth, setFrozen, moveColumn, reset };
}
