'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRocks, usePortalUsers, useDepartments, Rock } from '@/lib/hooks/useL10Data';

const STATUS_COLORS: Record<string, string> = {
  on_track: 'var(--christmas-green)',
  off_track: '#EF4444',
  done: 'var(--christmas-gold)',
};

const STATUS_LABELS: Record<string, string> = {
  on_track: 'On Track',
  off_track: 'Off Track',
  done: 'Done',
};

const STATUS_BADGE: Record<string, string> = {
  on_track: 'badge-on-track',
  off_track: 'badge-off-track',
  done: 'badge-done',
};

const STATUS_ORDER: Record<string, number> = { off_track: 0, on_track: 1, done: 2 };

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()} Q${q}`;
}

// Column definitions
type SortKey = 'title' | 'owner' | 'department' | 'status';
type SortDir = 'asc' | 'desc';

const COLUMNS = [
  { id: 'dot', label: '', sortable: false, defaultWidth: 40, minWidth: 40 },
  { id: 'title', label: 'Rock', sortable: true, defaultWidth: 320, minWidth: 150 },
  { id: 'owner', label: 'Owner', sortable: true, defaultWidth: 160, minWidth: 100 },
  { id: 'department', label: 'Dept', sortable: true, defaultWidth: 120, minWidth: 80 },
  { id: 'status', label: 'Status', sortable: true, defaultWidth: 100, minWidth: 80 },
  { id: 'notes', label: 'Notes', sortable: false, defaultWidth: 280, minWidth: 100 },
  { id: 'actions', label: '', sortable: false, defaultWidth: 80, minWidth: 60 },
];

// Reusable multi-select dropdown
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const displayText = selected.length === 0
    ? label
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap"
        style={{
          backgroundColor: selected.length ? 'var(--christmas-green)' : 'var(--bg-card)',
          color: selected.length ? '#fff' : 'var(--christmas-cream)',
          border: `1px solid ${selected.length ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
        }}
      >
        {displayText}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-lg py-1 z-30 min-w-[200px] max-h-64 overflow-y-auto shadow-lg"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              Clear all
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/5"
              style={{ color: 'var(--christmas-cream)' }}
            >
              <span
                className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center"
                style={{
                  borderColor: selected.includes(opt.value) ? 'var(--christmas-green)' : 'var(--border-subtle)',
                  backgroundColor: selected.includes(opt.value) ? 'var(--christmas-green)' : 'transparent',
                  color: '#fff',
                  fontSize: '0.6rem',
                }}
              >
                {selected.includes(opt.value) && '✓'}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Notes tooltip on hover
function NotesTooltip({ notes }: { notes: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    timeoutRef.current = setTimeout(() => setShow(true), 300);
  };

  const handleLeave = () => {
    clearTimeout(timeoutRef.current);
    setShow(false);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="relative"
    >
      <span className="text-xs block truncate" style={{ color: 'var(--text-muted)', maxWidth: '100%' }}>
        {notes}
      </span>
      {show && pos && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-xs max-w-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--christmas-cream)',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {notes}
        </div>
      )}
    </div>
  );
}

interface RockModalProps {
  rock: Partial<Rock> | null;
  quarters: string[];
  users: { id: string; name: string; email: string }[];
  departments: string[];
  onSave: (rock: Partial<Rock>) => void;
  onClose: () => void;
}

function RockModal({ rock, quarters, users, departments, onSave, onClose }: RockModalProps) {
  const [title, setTitle] = useState(rock?.title || '');
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>(rock?.owner_ids || []);
  const [department, setDepartment] = useState(rock?.department || '');
  const [status, setStatus] = useState(rock?.status || 'on_track');
  const [targetQuarter, setTargetQuarter] = useState(rock?.target_quarter || getCurrentQuarter());
  const [notes, setNotes] = useState(rock?.notes || '');

  const toggleOwner = (userId: string) => {
    setSelectedOwnerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = () => {
    if (!title.trim() || !selectedOwnerIds.length) return;
    const ownerNames = selectedOwnerIds.map((id) => {
      const u = users.find((u) => u.id === id);
      return u?.name || u?.email || '';
    });
    onSave({
      id: rock?.id,
      title: title.trim(),
      owner_names: ownerNames,
      owner_ids: selectedOwnerIds,
      department: department || null,
      status: status as Rock['status'],
      target_quarter: targetQuarter,
      notes: notes || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          {rock?.id ? 'Edit Rock' : 'Add Rock'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Owners ({selectedOwnerIds.length} selected)
            </label>
            <div
              className="rounded-lg p-2 max-h-40 overflow-y-auto space-y-1"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleOwner(u.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors"
                  style={{
                    backgroundColor: selectedOwnerIds.includes(u.id) ? 'var(--christmas-green)' : 'transparent',
                    color: selectedOwnerIds.includes(u.id) ? '#fff' : 'var(--christmas-cream)',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs"
                    style={{
                      borderColor: selectedOwnerIds.includes(u.id) ? '#fff' : 'var(--border-subtle)',
                      backgroundColor: selectedOwnerIds.includes(u.id) ? '#fff' : 'transparent',
                      color: 'var(--christmas-green)',
                    }}
                  >
                    {selectedOwnerIds.includes(u.id) && '✓'}
                  </span>
                  {u.name || u.email}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Quarter</label>
              <select
                value={targetQuarter}
                onChange={(e) => setTargetQuarter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
              >
                {quarters.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
            <div className="flex gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatus(key as Rock['status'])}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: status === key ? STATUS_COLORS[key] : 'var(--bg-secondary)',
                    color: status === key ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${status === key ? STATUS_COLORS[key] : 'var(--border-subtle)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !selectedOwnerIds.length}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            {rock?.id ? 'Save' : 'Add Rock'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RocksTab() {
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('l10-rocks-col-widths');
      if (saved) return JSON.parse(saved);
    }
    return Object.fromEntries(COLUMNS.map((c) => [c.id, c.defaultWidth]));
  });
  const { rocks, quarters, isLoading, mutate } = useRocks(selectedQuarter || undefined);
  const { users } = usePortalUsers();
  const { departments: portalDepts } = useDepartments();
  const departmentNames = (portalDepts || []).map((d) => d.name);

  const [modalRock, setModalRock] = useState<Partial<Rock> | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const startEdit = (id: string, field: string, value: string) => {
    setEditingCell({ id, field });
    setEditValue(value);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveInline = async (id: string, field: string, value: string) => {
    cancelEdit();
    await fetch(`/api/l10/rocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    mutate();
  };

  // Persist column widths
  useEffect(() => {
    localStorage.setItem('l10-rocks-col-widths', JSON.stringify(colWidths));
  }, [colWidths]);

  // Column resize
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    resizingCol.current = colId;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[colId];
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizingCol.current) return;
      const col = COLUMNS.find((c) => c.id === resizingCol.current);
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(col?.minWidth || 60, resizeStartW.current + delta);
      setColWidths((prev) => ({ ...prev, [resizingCol.current!]: newWidth }));
    };
    const handleUp = () => {
      resizingCol.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleSave = async (rock: Partial<Rock>) => {
    if (rock.id) {
      await fetch(`/api/l10/rocks/${rock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rock),
      });
    } else {
      await fetch('/api/l10/rocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rock),
      });
    }
    setShowModal(false);
    setModalRock(null);
    mutate();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/l10/rocks/${id}`, { method: 'DELETE' });
    mutate();
  };

  const handleStatusToggle = async (rock: Rock) => {
    const nextStatus = rock.status === 'on_track' ? 'off_track' : rock.status === 'off_track' ? 'done' : 'on_track';
    await fetch(`/api/l10/rocks/${rock.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    mutate();
  };

  // Build filter options from rocks data
  const ownerOptions = (() => {
    const seen = new Map<string, string>();
    (rocks || []).forEach((r) => {
      r.owner_ids?.forEach((id, i) => {
        if (!seen.has(id)) seen.set(id, r.owner_names?.[i] || id);
      });
    });
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  const deptOptions = (() => {
    const depts = new Set<string>();
    (rocks || []).forEach((r) => { if (r.department) depts.add(r.department); });
    return Array.from(depts).sort().map((d) => ({ value: d, label: d }));
  })();

  // Filter
  let filteredRocks = rocks || [];
  if (statusFilter) {
    filteredRocks = filteredRocks.filter((r) => r.status === statusFilter);
  }
  if (deptFilter.length) {
    filteredRocks = filteredRocks.filter((r) => r.department && deptFilter.includes(r.department));
  }
  if (ownerFilter.length) {
    filteredRocks = filteredRocks.filter((r) =>
      r.owner_ids?.some((id) => ownerFilter.includes(id))
    );
  }

  // Sort
  if (sortKey) {
    filteredRocks = [...filteredRocks].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'owner':
          cmp = (a.owner_names?.[0] || '').localeCompare(b.owner_names?.[0] || '');
          break;
        case 'department':
          cmp = (a.department || '').localeCompare(b.department || '');
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  // Summary counts
  const allRocks = rocks || [];
  const onTrack = allRocks.filter((r) => r.status === 'on_track').length;
  const offTrack = allRocks.filter((r) => r.status === 'off_track').length;
  const doneCount = allRocks.filter((r) => r.status === 'done').length;

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  return (
    <div>
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: !statusFilter ? 'var(--christmas-green)' : 'var(--bg-card)',
            color: !statusFilter ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${!statusFilter ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
          }}
        >
          All ({allRocks.length})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'on_track' ? '' : 'on_track')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: statusFilter === 'on_track' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-card)',
            color: statusFilter === 'on_track' ? '#6B9B75' : 'var(--text-secondary)',
            border: `1px solid ${statusFilter === 'on_track' ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
          }}
        >
          On Track ({onTrack})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'off_track' ? '' : 'off_track')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: statusFilter === 'off_track' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
            color: statusFilter === 'off_track' ? '#f87171' : 'var(--text-secondary)',
            border: `1px solid ${statusFilter === 'off_track' ? '#EF4444' : 'var(--border-subtle)'}`,
          }}
        >
          Off Track ({offTrack})
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'done' ? '' : 'done')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: statusFilter === 'done' ? 'rgba(184, 149, 107, 0.15)' : 'var(--bg-card)',
            color: statusFilter === 'done' ? '#B8956B' : 'var(--text-secondary)',
            border: `1px solid ${statusFilter === 'done' ? 'var(--christmas-gold)' : 'var(--border-subtle)'}`,
          }}
        >
          Done ({doneCount})
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={selectedQuarter}
          onChange={(e) => setSelectedQuarter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
        >
          {(quarters || [getCurrentQuarter()]).map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>

        <MultiSelect label="Department" options={deptOptions} selected={deptFilter} onChange={setDeptFilter} />
        <MultiSelect label="Owner" options={ownerOptions} selected={ownerFilter} onChange={setOwnerFilter} />

        <div className="sm:ml-auto">
          <button
            onClick={() => { setModalRock({}); setShowModal(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            + Add Rock
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : !filteredRocks.length ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No rocks match the current filters.
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="dash-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="relative select-none"
                      style={{ width: colWidths[col.id], minWidth: col.minWidth }}
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => handleSort(col.id as SortKey)}
                          className="flex items-center gap-1 hover:text-white/80 transition-colors"
                          style={{ color: sortKey === col.id ? 'var(--christmas-cream)' : undefined }}
                        >
                          {col.label}
                          <span className="text-[10px] opacity-60">{sortIcon(col.id as SortKey)}</span>
                        </button>
                      ) : (
                        col.label
                      )}
                      {/* Resize handle */}
                      {col.id !== 'actions' && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group flex items-center justify-center"
                          onMouseDown={(e) => handleResizeStart(e, col.id)}
                        >
                          <div className="w-0.5 h-4 rounded bg-gray-600 group-hover:bg-blue-400 transition-colors" />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRocks.map((rock) => (
                  <tr key={rock.id}>
                    <td style={{ width: colWidths.dot }}>
                      <button
                        onClick={() => handleStatusToggle(rock)}
                        className="w-3 h-3 rounded-full transition-colors cursor-pointer"
                        style={{ backgroundColor: STATUS_COLORS[rock.status] }}
                        title={`${STATUS_LABELS[rock.status]} — click to cycle`}
                      />
                    </td>

                    <td style={{ width: colWidths.title }}>
                      {editingCell?.id === rock.id && editingCell.field === 'title' ? (
                        <input
                          ref={editRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInline(rock.id, 'title', editValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInline(rock.id, 'title', editValue);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-full px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--christmas-green)', outline: 'none' }}
                        />
                      ) : (
                        <span
                          className="text-xs font-medium cursor-pointer hover:underline"
                          style={{ color: 'var(--christmas-cream)' }}
                          onClick={() => startEdit(rock.id, 'title', rock.title)}
                          title="Click to edit"
                        >
                          {rock.title}
                        </span>
                      )}
                    </td>

                    <td
                      style={{ width: colWidths.owner }}
                      className="cursor-pointer"
                      onClick={() => { setModalRock(rock); setShowModal(true); }}
                      title="Click to edit owners"
                    >
                      {rock.owner_names?.map((name, j) => (
                        <div key={j} className="text-xs whitespace-nowrap hover:underline" style={{ color: 'var(--text-secondary)' }}>
                          {name}
                        </div>
                      ))}
                    </td>

                    <td style={{ width: colWidths.department }}>
                      {editingCell?.id === rock.id && editingCell.field === 'department' ? (
                        <select
                          ref={editRef as React.RefObject<HTMLSelectElement>}
                          value={editValue}
                          onChange={(e) => { saveInline(rock.id, 'department', e.target.value); }}
                          onBlur={() => cancelEdit()}
                          onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                          className="w-full px-1 py-0.5 rounded text-xs"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--christmas-green)', outline: 'none' }}
                        >
                          <option value="">None</option>
                          {departmentNames.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="text-xs whitespace-nowrap cursor-pointer hover:underline"
                          style={{ color: rock.department ? 'var(--text-muted)' : 'var(--text-muted)' }}
                          onClick={() => startEdit(rock.id, 'department', rock.department || '')}
                          title="Click to edit"
                        >
                          {rock.department || '—'}
                        </span>
                      )}
                    </td>

                    <td style={{ width: colWidths.status }}>
                      <button onClick={() => handleStatusToggle(rock)} title="Click to cycle status">
                        <span className={`badge ${STATUS_BADGE[rock.status]}`}>
                          {STATUS_LABELS[rock.status]}
                        </span>
                      </button>
                    </td>

                    <td style={{ width: colWidths.notes, maxWidth: colWidths.notes, overflow: 'hidden' }}>
                      {editingCell?.id === rock.id && editingCell.field === 'notes' ? (
                        <textarea
                          ref={editRef as React.RefObject<HTMLTextAreaElement>}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInline(rock.id, 'notes', editValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveInline(rock.id, 'notes', editValue); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          rows={2}
                          className="w-full px-1.5 py-0.5 rounded text-xs resize-none"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--christmas-green)', outline: 'none' }}
                        />
                      ) : (
                        <div
                          className="cursor-pointer"
                          onClick={() => startEdit(rock.id, 'notes', rock.notes || '')}
                          title="Click to edit"
                        >
                          {rock.notes ? <NotesTooltip notes={rock.notes} /> : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ width: colWidths.actions, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setModalRock(rock); setShowModal(true); }}
                          className="p-1.5 rounded transition-colors hover:bg-white/10"
                          style={{ color: 'var(--text-muted)' }}
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(rock.id)}
                          className="p-1.5 rounded transition-colors hover:bg-white/10"
                          style={{ color: 'var(--text-muted)' }}
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RockModal
          rock={modalRock}
          quarters={quarters || [getCurrentQuarter()]}
          users={users || []}
          departments={departmentNames}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setModalRock(null); }}
        />
      )}
    </div>
  );
}
