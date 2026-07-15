'use client';
import { useEffect, useRef, useState } from 'react';

interface Opt { value: string; label: string }

/**
 * Dropdown of checkboxes with Select all / Clear, matching the app's `.filter`
 * control styling. An empty selection means "no filter" (show everything), so
 * Clear and Select-all both surface all rows.
 */
export default function MultiSelectFilter({
  label, options, selected, onChange,
}: {
  label: string;
  options: Opt[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allSel = selected.size === 0 || selected.size === options.length;
  const summary = allSel ? `All ${label}` : options.filter(o => selected.has(o.value)).map(o => o.label).join(', ');
  const toggle = (v: string) => { const n = new Set(selected); if (n.has(v)) n.delete(v); else n.add(v); onChange(n); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="filter" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150, textAlign: 'left', cursor: 'pointer' }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, boxShadow: 'var(--shadow-md)', minWidth: 190, padding: 6 }}>
          <div style={{ display: 'flex', gap: 6, padding: '2px 4px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px', flex: 1 }} onClick={() => onChange(new Set(options.map(o => o.value)))}>Select all</button>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px', flex: 1 }} onClick={() => onChange(new Set())}>Clear</button>
          </div>
          {options.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
