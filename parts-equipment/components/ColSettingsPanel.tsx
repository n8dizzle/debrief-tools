'use client';
import { useState, useEffect, useRef } from 'react';

interface ColDef {
  key: string;
  label: string;
  visible: boolean;
}

interface Props {
  tableType: 'service' | 'install' | 'warranty';
  onClose: () => void;
}

const SVC_COLS: ColDef[] = [
  { key: 'edit', label: 'Edit', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'date', label: 'Date', visible: true },
  { key: 'job', label: 'Job #', visible: true },
  { key: 'tech', label: 'Sold By', visible: true },
  { key: 'estcost', label: 'Est. Subtotal', visible: true },
  { key: 'customer', label: 'Customer', visible: true },
  { key: 'owner', label: 'Owner', visible: true },
  { key: 'subtype', label: 'Type', visible: true },
  { key: 'warranty', label: 'Warranty?', visible: true },
  { key: 'warranty_type', label: 'W.Type', visible: true },
  { key: 'part', label: 'Part/Description', visible: true },
  { key: 'parts_ordered', label: 'Parts Ord.', visible: true },
  { key: 'part_bo', label: 'Part B/O?', visible: true },
  { key: 'eta', label: 'ETA', visible: true },
  { key: 'bo_informed', label: 'Cust. Inf. B/O', visible: true },
  { key: 'supplier', label: 'Supplier', visible: true },
  { key: 'order_num', label: 'Order #', visible: true },
  { key: 'cost', label: 'Cost', visible: true },
  { key: 'location', label: 'Location', visible: true },
  { key: 'parts_at_shop', label: 'Parts at Shop', visible: true },
  { key: 'two_techs', label: '2 Techs?', visible: true },
  { key: 'note_wh', label: 'WH Notes', visible: true },
  { key: 'note_cxr', label: 'CXR Notes', visible: true },
  { key: 'closeout', label: 'Close ✕', visible: true },
];

const INST_COLS: ColDef[] = [
  { key: 'edit', label: 'Edit', visible: true },
  { key: 'date', label: 'Date', visible: true },
  { key: 'job', label: 'Job #', visible: true },
  { key: 'customer', label: 'Customer', visible: true },
  { key: 'tech', label: 'Sold By', visible: true },
  { key: 'job_cost', label: 'Job Cost', visible: true },
  { key: 'owner', label: 'Owner', visible: true },
  { key: 'warranty', label: 'Warranty?', visible: true },
  { key: 'part', label: 'Equipment', visible: true },
  { key: 'equip_avail', label: 'Avail?', visible: true },
  { key: 'bo_status', label: 'B/O?', visible: true },
  { key: 'eta', label: 'ETA', visible: true },
  { key: 'bo_informed', label: 'Cust. Inf. B/O', visible: true },
  { key: 'bo_ordered', label: 'Parts Ordered', visible: true },
  { key: 'supplier', label: 'Ordered From', visible: true },
  { key: 'order_num', label: 'Order #', visible: true },
  { key: 'equip_cost', label: 'Equip. Cost', visible: true },
  { key: 'location', label: 'Location', visible: true },
  { key: 'install_team', label: 'Install Team', visible: true },
  { key: 'sched_date', label: 'Date Sched.', visible: true },
  { key: 'call_booked', label: 'Call Booked?', visible: true },
  { key: 'qc_scheduled', label: 'QC Scheduled?', visible: true },
  { key: 'qc_date', label: 'QC Date', visible: true },
  { key: 'notes', label: 'Notes', visible: true },
  { key: 'closeout', label: 'Close ✕', visible: true },
];

function storageKey(t: string) { return `pe_col_settings_${t}`; }

function loadCols(tableType: string, defaults: ColDef[]): ColDef[] {
  try {
    const stored = localStorage.getItem(storageKey(tableType));
    if (!stored) return defaults;
    const parsed: { key: string; visible: boolean }[] = JSON.parse(stored);
    return defaults.map(def => {
      const override = parsed.find(p => p.key === def.key);
      return override ? { ...def, visible: override.visible } : def;
    });
  } catch {
    return defaults;
  }
}

export default function ColSettingsPanel({ tableType, onClose }: Props) {
  const defaults = tableType === 'service' ? SVC_COLS : INST_COLS;
  const [cols, setCols] = useState<ColDef[]>(() => loadCols(tableType, defaults));
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function toggle(key: string) {
    // Don't allow hiding edit or closeout
    if (key === 'edit' || key === 'closeout') return;
    setCols(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...cols];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setCols(next);
    setDragIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  function resetToDefault() {
    setCols(defaults);
  }

  function save() {
    const toStore = cols.map(c => ({ key: c.key, visible: c.visible }));
    localStorage.setItem(storageKey(tableType), JSON.stringify(toStore));
    onClose();
  }

  const visibleCount = cols.filter(c => c.visible).length;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div ref={panelRef} className="panel col-settings-panel">

        {/* Header */}
        <div className="panel-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Column Settings</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, textTransform: 'capitalize' }}>{tableType} table</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Instructions */}
        <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>
          Drag to reorder. Toggle checkboxes to show/hide. {visibleCount}/{cols.length} visible.
        </div>

        {/* Col List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {cols.map((col, idx) => {
            const locked = col.key === 'edit' || col.key === 'closeout';
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx;
            return (
              <div
                key={col.key}
                draggable={!locked}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', cursor: locked ? 'default' : 'grab',
                  borderBottom: isDragOver && !isDragging ? '2px solid var(--accent)' : '1px solid var(--border)',
                  opacity: isDragging ? 0.4 : 1,
                  background: isDragOver && !isDragging ? 'var(--surface2)' : 'transparent',
                  userSelect: 'none',
                }}
              >
                {/* Drag handle */}
                <span style={{ color: locked ? 'transparent' : 'var(--muted)', fontSize: 13, cursor: locked ? 'default' : 'grab', width: 14 }}>⠿</span>

                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={col.visible}
                  disabled={locked}
                  onChange={() => toggle(col.key)}
                  style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: locked ? 'default' : 'pointer' }}
                />

                {/* Label */}
                <span style={{ fontSize: 13, color: col.visible ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{col.label}</span>

                {locked && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>locked</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={resetToDefault}>Reset to Default</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </>
  );
}
