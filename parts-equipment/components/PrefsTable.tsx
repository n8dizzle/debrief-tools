'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from 'react';
import { useColumnPrefs } from '@/hooks/useColumnPrefs';

export interface PrefsColumn<Row> {
  key: string;
  label: string;
  minWidth?: number;
  defaultWidth?: number;
  align?: 'left' | 'center';
  locked?: boolean;               // can't hide / drag (e.g. row actions)
  sortKey?: string;               // header sort control → sort by this key
  render: (row: Row) => ReactNode;
}

interface Props<Row> {
  board: string;
  columns: PrefsColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  rowId?: (row: Row) => string | undefined;
  rowClassName?: (row: Row) => string | undefined;
  rowStyle?: (row: Row) => CSSProperties | undefined;
  onRowFocus?: (row: Row) => void;
  onRowBlur?: (row: Row) => void;
  tableClassName?: string;
  containerClassName?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  sort?: { col: string | null; dir: 1 | -1; onToggle: (key: string) => void };
  managerOpen?: boolean;
  onManagerClose?: () => void;
  defaultFrozen?: number;
}

export default function PrefsTable<Row>(props: Props<Row>) {
  const {
    board, columns, rows, rowKey, rowId, rowClassName, rowStyle,
    onRowFocus, onRowBlur, tableClassName, containerClassName, scrollRef,
    sort, managerOpen, onManagerClose, defaultFrozen = 1,
  } = props;

  const allKeys = columns.map(c => c.key);
  const { prefs, isHidden, toggleHidden, setWidth, setFrozen, moveColumn, reset } =
    useColumnPrefs(board, allKeys, defaultFrozen);

  const byKey = new Map(columns.map(c => [c.key, c]));
  const widthOf = (c: PrefsColumn<Row>) =>
    prefs.widths[c.key] ?? c.defaultWidth ?? c.minWidth ?? 120;

  const orderedCols = prefs.order.map(k => byKey.get(k)).filter(Boolean) as PrefsColumn<Row>[];
  const visibleCols = orderedCols.filter(c => !isHidden(c.key));

  // Cumulative left offsets for the frozen (pinned-left) columns.
  const frozenCount = Math.min(prefs.frozen, visibleCols.length);
  const leftOffset: number[] = [];
  let acc = 0;
  for (let i = 0; i < visibleCols.length; i++) {
    leftOffset[i] = acc;
    if (i < frozenCount) acc += widthOf(visibleCols[i]);
  }

  // ── Drag to reorder ──────────────────────────────────────────────
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // ── Resize ───────────────────────────────────────────────────────
  const resizing = useRef<{ key: string; startX: number; startW: number; min: number } | null>(null);
  const [resizeKey, setResizeKey] = useState<string | null>(null);

  useEffect(() => {
    if (!resizeKey) return;
    const onMove = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r) return;
      const w = Math.max(r.min, r.startW + (e.clientX - r.startX));
      setWidth(r.key, w);
    };
    const onUp = () => { resizing.current = null; setResizeKey(null); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizeKey, setWidth]);

  function startResize(e: React.MouseEvent, c: PrefsColumn<Row>) {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { key: c.key, startX: e.clientX, startW: widthOf(c), min: c.minWidth ?? 40 };
    setResizeKey(c.key);
  }

  const cellBase = (i: number, c: PrefsColumn<Row>, isHeader: boolean): CSSProperties => {
    const w = widthOf(c);
    const frozen = i < frozenCount;
    const isLastFrozen = frozen && i === frozenCount - 1;
    const s: CSSProperties = { width: w, minWidth: w, maxWidth: w };
    if (isHeader) {
      s.position = 'sticky';
      s.top = 0;
      s.zIndex = frozen ? 4 : 2;
    } else if (frozen) {
      s.position = 'sticky';
      s.zIndex = 1;
    }
    if (frozen) s.left = leftOffset[i];
    if (isLastFrozen) s.boxShadow = '2px 0 5px rgba(0,0,0,0.14)';
    return s;
  };

  return (
    <>
      <div className={containerClassName} ref={scrollRef as Ref<HTMLDivElement>}>
        <table className={tableClassName}>
          <thead>
            <tr>
              {visibleCols.map((c, i) => {
                // Every non-locked column is sortable; default the sort key to the
                // column key unless the column overrides it.
                const sk = c.sortKey ?? (c.locked ? undefined : c.key);
                const active = !!(sort && sk && sort.col === sk);
                const arrow = sk && sort
                  ? (active ? (sort.dir === 1 ? '▲' : '▼') : '⇅')
                  : '';
                return (
                  <th
                    key={c.key}
                    className="pref-th"
                    draggable={!c.locked && !resizeKey}
                    onDragStart={() => !c.locked && setDragKey(c.key)}
                    onDragOver={e => { if (dragKey && !c.locked) { e.preventDefault(); setOverKey(c.key); } }}
                    onDragLeave={() => setOverKey(k => (k === c.key ? null : k))}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragKey && !c.locked && dragKey !== c.key) moveColumn(dragKey, c.key);
                      setDragKey(null); setOverKey(null);
                    }}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    title={c.locked ? c.label : `Drag to reorder · ${c.label}`}
                    style={{
                      ...cellBase(i, c, true),
                      cursor: c.locked ? 'default' : 'grab',
                      userSelect: 'none',
                      opacity: dragKey === c.key ? 0.4 : 1,
                      borderLeft: overKey === c.key ? '2px solid var(--on-accent)' : undefined,
                    }}
                  >
                    <div className="pref-th-inner">
                      <div className="pref-th-strip">
                        {!c.locked
                          ? <span className="pref-grip" aria-hidden>⠿</span>
                          : <span />}
                        {sk && sort && (
                          <span
                            className={`pref-sort${active ? ' active' : ''}`}
                            title={`Sort by ${c.label}`}
                            onClick={e => { e.stopPropagation(); sort.onToggle(sk); }}
                            onMouseDown={e => e.stopPropagation()}
                          >{arrow}</span>
                        )}
                      </div>
                      <div className="pref-th-label" style={{ textAlign: c.align === 'left' ? 'left' : 'center' }}>
                        {c.label}
                      </div>
                    </div>
                    {/* resize handle */}
                    <span
                      className="pref-resize"
                      onMouseDown={e => startResize(e, c)}
                      onClick={e => e.stopPropagation()}
                      onDragStart={e => e.preventDefault()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                id={rowId?.(row)}
                className={rowClassName?.(row)}
                onFocus={() => onRowFocus?.(row)}
                onBlur={() => onRowBlur?.(row)}
                style={rowStyle?.(row)}
              >
                {visibleCols.map((c, i) => (
                  <td key={c.key} style={{ ...cellBase(i, c, false), textAlign: c.align === 'left' ? 'left' : 'center' }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {managerOpen && (
        <ColumnManager
          columns={orderedCols}
          isHidden={isHidden}
          toggleHidden={toggleHidden}
          frozen={frozenCount}
          maxFrozen={visibleCols.length}
          setFrozen={setFrozen}
          reset={reset}
          onClose={() => onManagerClose?.()}
        />
      )}
    </>
  );
}

// ── Column manager (show/hide, freeze depth, reset) ──────────────────
// Reordering lives on the board headers themselves (drag the ⠿ grip), so this
// panel is intentionally just visibility + freeze + reset — no redundant reorder.
interface ManagerProps<Row> {
  columns: PrefsColumn<Row>[];
  isHidden: (k: string) => boolean;
  toggleHidden: (k: string) => void;
  frozen: number;
  maxFrozen: number;
  setFrozen: (n: number) => void;
  reset: () => void;
  onClose: () => void;
}

function ColumnManager<Row>(p: ManagerProps<Row>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [p]);

  return (
    <div
      onClick={p.onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,16,.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 340, maxWidth: '92vw', height: '100vh', background: 'var(--surface)', boxShadow: '-4px 0 24px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Columns</div>
          <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={p.onClose}>Done</button>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            Freeze first {p.frozen} column{p.frozen !== 1 ? 's' : ''} (stay visible when scrolling sideways)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn" style={{ padding: '2px 10px', fontSize: 14 }} onClick={() => p.setFrozen(Math.max(0, p.frozen - 1))}>−</button>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', minWidth: 20, textAlign: 'center' }}>{p.frozen}</span>
            <button className="btn" style={{ padding: '2px 10px', fontSize: 14 }} onClick={() => p.setFrozen(Math.min(p.maxFrozen, p.frozen + 1))}>+</button>
          </div>
        </div>

        <div style={{ padding: '10px 18px 4px', fontSize: 11, color: 'var(--muted2)' }}>
          Check to show a column. Drag a column header on the board to reorder.
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 8px' }}>
          {p.columns.map(c => {
            const hidden = p.isHidden(c.key);
            return (
              <label
                key={c.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 6,
                  cursor: c.locked ? 'not-allowed' : 'pointer',
                  background: hidden ? 'transparent' : 'var(--surface2)',
                }}
              >
                <input
                  type="checkbox"
                  checked={!hidden}
                  disabled={c.locked}
                  onChange={() => !c.locked && p.toggleHidden(c.key)}
                  style={{ width: 15, height: 15, cursor: c.locked ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: 13, color: hidden ? 'var(--muted)' : 'var(--text)', flex: 1 }}>{c.label || '(actions)'}</span>
                {c.locked && <span style={{ fontSize: 10, color: 'var(--muted2)' }}>locked</span>}
              </label>
            );
          })}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={p.reset}>
            Reset to default
          </button>
        </div>
      </div>
    </div>
  );
}
