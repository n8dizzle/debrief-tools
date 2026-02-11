'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useIssues, usePortalUsers, Issue } from '@/lib/hooks/useL10Data';

// Column definitions
type SortKey = 'title' | 'priority' | 'owner' | 'status';
type SortDir = 'asc' | 'desc';

const COLUMNS = [
  { id: 'resolved', label: '', sortable: false, defaultWidth: 44, minWidth: 44 },
  { id: 'title', label: 'Issue', sortable: true, defaultWidth: 320, minWidth: 150 },
  { id: 'priority', label: 'Priority', sortable: true, defaultWidth: 100, minWidth: 80 },
  { id: 'owner', label: 'Owner', sortable: true, defaultWidth: 150, minWidth: 100 },
  { id: 'notes', label: 'Notes', sortable: false, defaultWidth: 300, minWidth: 100 },
  { id: 'actions', label: '', sortable: false, defaultWidth: 80, minWidth: 60 },
];

const PRIORITY_ORDER: Record<string, number> = { High: 0, Mid: 1, Low: 2 };

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

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;

  const colors: Record<string, { bg: string; text: string }> = {
    High: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
    Mid: { bg: 'rgba(184, 149, 107, 0.15)', text: '#B8956B' },
    Low: { bg: 'rgba(100, 100, 100, 0.15)', text: 'var(--text-muted)' },
  };

  const c = colors[priority] || colors.Low;

  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {priority}
    </span>
  );
}

interface IssueModalProps {
  issue: Partial<Issue> | null;
  users: { id: string; name: string; email: string }[];
  onSave: (issue: Partial<Issue>) => void;
  onClose: () => void;
}

function IssueModal({ issue, users, onSave, onClose }: IssueModalProps) {
  const [title, setTitle] = useState(issue?.title || '');
  const [priority, setPriority] = useState(issue?.priority || '');
  const [ownerId, setOwnerId] = useState(issue?.owner_id || '');
  const [notes, setNotes] = useState(issue?.notes || '');
  const [isResolved, setIsResolved] = useState(issue?.is_resolved || false);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const owner = users.find((u) => u.id === ownerId);
    onSave({
      id: issue?.id,
      title: title.trim(),
      priority: priority || null,
      owner_name: owner ? (owner.name || owner.email) : null,
      owner_id: ownerId || null,
      notes: notes || null,
      is_resolved: isResolved,
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
          {issue?.id ? 'Edit Issue' : 'Add Issue'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Issue</label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">None</option>
                <option value="High">High</option>
                <option value="Mid">Mid</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-cream)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
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

          {issue?.id && (
            <div className="flex items-center">
              <button
                onClick={() => setIsResolved(!isResolved)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isResolved ? 'var(--christmas-green)' : 'var(--bg-secondary)',
                  color: isResolved ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${isResolved ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
                }}
              >
                {isResolved ? 'Resolved' : 'Open'}
              </button>
            </div>
          )}
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
            disabled={!title.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            {issue?.id ? 'Save' : 'Add Issue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IdsTab() {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('l10-ids-col-widths');
      if (saved) return JSON.parse(saved);
    }
    return Object.fromEntries(COLUMNS.map((c) => [c.id, c.defaultWidth]));
  });
  const { issues, isLoading, mutate } = useIssues();
  const { users } = usePortalUsers();

  const [modalIssue, setModalIssue] = useState<Partial<Issue> | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Persist column widths
  useEffect(() => {
    localStorage.setItem('l10-ids-col-widths', JSON.stringify(colWidths));
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

  const handleSave = async (issue: Partial<Issue>) => {
    if (issue.id) {
      await fetch(`/api/l10/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issue),
      });
    } else {
      await fetch('/api/l10/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issue),
      });
    }
    setShowModal(false);
    setModalIssue(null);
    mutate();
  };

  const handleToggle = async (id: string, isResolved: boolean) => {
    await fetch(`/api/l10/issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: !isResolved }),
    });
    mutate();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/l10/issues/${id}`, { method: 'DELETE' });
    mutate();
  };

  // Build owner filter options from issues data
  const ownerOptions = (() => {
    const seen = new Set<string>();
    (issues || []).forEach((i) => { if (i.owner_name) seen.add(i.owner_name); });
    return Array.from(seen).sort().map((name) => ({ value: name, label: name }));
  })();

  // Filter
  let filteredIssues = issues || [];
  if (filter === 'open') {
    filteredIssues = filteredIssues.filter((i) => !i.is_resolved);
  } else if (filter === 'resolved') {
    filteredIssues = filteredIssues.filter((i) => i.is_resolved);
  }
  if (ownerFilter.length) {
    filteredIssues = filteredIssues.filter((i) => i.owner_name && ownerFilter.includes(i.owner_name));
  }

  // Sort
  if (sortKey) {
    filteredIssues = [...filteredIssues].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'priority': {
          const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
          const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
          cmp = pa - pb;
          break;
        }
        case 'owner':
          cmp = (a.owner_name || '').localeCompare(b.owner_name || '');
          break;
        case 'status':
          cmp = (a.is_resolved ? 1 : 0) - (b.is_resolved ? 1 : 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  // Summary counts
  const allIssues = issues || [];
  const openCount = allIssues.filter((i) => !i.is_resolved).length;
  const resolvedCount = allIssues.filter((i) => i.is_resolved).length;

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  return (
    <div>
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: filter === 'all' ? 'var(--christmas-green)' : 'var(--bg-card)',
            color: filter === 'all' ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${filter === 'all' ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
          }}
        >
          All ({allIssues.length})
        </button>
        <button
          onClick={() => setFilter('open')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: filter === 'open' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-card)',
            color: filter === 'open' ? '#6B9B75' : 'var(--text-secondary)',
            border: `1px solid ${filter === 'open' ? 'var(--christmas-green)' : 'var(--border-subtle)'}`,
          }}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{
            backgroundColor: filter === 'resolved' ? 'rgba(184, 149, 107, 0.15)' : 'var(--bg-card)',
            color: filter === 'resolved' ? '#B8956B' : 'var(--text-secondary)',
            border: `1px solid ${filter === 'resolved' ? 'var(--christmas-gold)' : 'var(--border-subtle)'}`,
          }}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <MultiSelect label="Owner" options={ownerOptions} selected={ownerFilter} onChange={setOwnerFilter} />

        <div className="sm:ml-auto">
          <button
            onClick={() => { setModalIssue({}); setShowModal(true); }}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            + Add Issue
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : !filteredIssues.length ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No issues match the current filters.
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
                {filteredIssues.map((issue) => (
                  <tr key={issue.id} style={{ opacity: issue.is_resolved ? 0.5 : 1 }}>
                    <td style={{ width: colWidths.resolved }}>
                      <button
                        onClick={() => handleToggle(issue.id, issue.is_resolved)}
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          borderColor: issue.is_resolved ? 'var(--christmas-green)' : 'var(--border-default)',
                          backgroundColor: issue.is_resolved ? 'var(--christmas-green)' : 'transparent',
                        }}
                      >
                        {issue.is_resolved && (
                          <svg className="w-3 h-3" fill="none" stroke="white" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>

                    <td style={{ width: colWidths.title }}>
                      <span
                        className={`text-xs font-medium ${issue.is_resolved ? 'line-through' : ''}`}
                        style={{ color: 'var(--christmas-cream)' }}
                      >
                        {issue.title}
                      </span>
                    </td>

                    <td style={{ width: colWidths.priority }}>
                      <PriorityBadge priority={issue.priority} />
                    </td>

                    <td style={{ width: colWidths.owner }}>
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {issue.owner_name || ''}
                      </span>
                    </td>

                    <td style={{ width: colWidths.notes, maxWidth: colWidths.notes, overflow: 'hidden' }}>
                      {issue.notes && <NotesTooltip notes={issue.notes} />}
                    </td>

                    <td style={{ width: colWidths.actions, textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setModalIssue(issue); setShowModal(true); }}
                          className="p-1.5 rounded transition-colors hover:bg-white/10"
                          style={{ color: 'var(--text-muted)' }}
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(issue.id)}
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
        <IssueModal
          issue={modalIssue}
          users={users || []}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setModalIssue(null); }}
        />
      )}
    </div>
  );
}
