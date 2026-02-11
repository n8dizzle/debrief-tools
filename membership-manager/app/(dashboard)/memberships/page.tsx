'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MMMembership } from '@/lib/supabase';
import { formatDate, getStatusBadgeStyle } from '@/lib/mm-utils';

// ── Column Definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  minWidth: number;
  defaultWidth: number;
  defaultVisible: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'customer', label: 'Customer', sortable: true, minWidth: 120, defaultWidth: 180, defaultVisible: true },
  { id: 'address', label: 'Address', sortable: true, minWidth: 120, defaultWidth: 200, defaultVisible: true },
  { id: 'type', label: 'Type', sortable: true, minWidth: 100, defaultWidth: 180, defaultVisible: true },
  { id: 'status', label: 'Status', sortable: true, minWidth: 80, defaultWidth: 100, defaultVisible: true },
  { id: 'start', label: 'Start', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: true },
  { id: 'end', label: 'End', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: true },
  { id: 'visits', label: 'Visits', sortable: true, minWidth: 70, defaultWidth: 80, defaultVisible: true },
  { id: 'next_due', label: 'Next Due', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: true },
  { id: 'sold_on', label: 'Sold On', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: true },
  { id: 'sold_by', label: 'Sold By', sortable: true, minWidth: 100, defaultWidth: 140, defaultVisible: true },
  { id: 'phone', label: 'Phone', sortable: true, minWidth: 100, defaultWidth: 130, defaultVisible: false },
  { id: 'email', label: 'Email', sortable: true, minWidth: 120, defaultWidth: 180, defaultVisible: false },
  { id: 'location', label: 'Location Name', sortable: true, minWidth: 100, defaultWidth: 150, defaultVisible: false },
  { id: 'billing', label: 'Billing Freq', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: false },
  { id: 'expiry_days', label: 'Days to Expiry', sortable: true, minWidth: 90, defaultWidth: 110, defaultVisible: false },
  { id: 'scheduled', label: 'Scheduled', sortable: true, minWidth: 70, defaultWidth: 90, defaultVisible: false },
];

// ── LocalStorage Keys ───────────────────────────────────────────────────────

const STORAGE_KEY = 'mm-memberships-column-order';
const WIDTH_STORAGE_KEY = 'mm-memberships-column-widths';
const VISIBILITY_STORAGE_KEY = 'mm-memberships-column-visibility';

// ── Component ───────────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<MMMembership[]>([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Active');
  const [type, setType] = useState('');
  const [expiringDays, setExpiringDays] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Sort state
  const [sortField, setSortField] = useState('customer');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Column state
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // Column picker
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Drag & drop
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Resize
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  // ── Load persisted column state ─────────────────────────────────────────

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(STORAGE_KEY);
      if (savedOrder) {
        const orderIds: string[] = JSON.parse(savedOrder);
        const colMap = new Map(DEFAULT_COLUMNS.map(c => [c.id, c]));
        // Add any new columns not in saved order
        const ordered: ColumnDef[] = [];
        for (const id of orderIds) {
          const col = colMap.get(id);
          if (col) {
            ordered.push(col);
            colMap.delete(id);
          }
        }
        for (const col of colMap.values()) {
          ordered.push(col);
        }
        setColumns(ordered);
      }

      const savedWidths = localStorage.getItem(WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths(JSON.parse(savedWidths));
      }

      const savedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (savedVisibility) {
        setColumnVisibility(JSON.parse(savedVisibility));
      }
    } catch {}
  }, []);

  // ── Persistence helpers ─────────────────────────────────────────────────

  const saveColumnOrder = useCallback((cols: ColumnDef[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cols.map(c => c.id)));
    } catch {}
  }, []);

  const saveColumnWidths = useCallback((widths: Record<string, number>) => {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths));
    } catch {}
  }, []);

  const saveColumnVisibility = useCallback((vis: Record<string, boolean>) => {
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(vis));
    } catch {}
  }, []);

  // ── Column visibility ───────────────────────────────────────────────────

  const isColumnVisible = (colId: string): boolean => {
    if (colId in columnVisibility) return columnVisibility[colId];
    return DEFAULT_COLUMNS.find(c => c.id === colId)?.defaultVisible ?? true;
  };

  const toggleColumnVisibility = (colId: string) => {
    const newVis = { ...columnVisibility, [colId]: !isColumnVisible(colId) };
    setColumnVisibility(newVis);
    saveColumnVisibility(newVis);
  };

  const visibleColumns = columns.filter(c => isColumnVisible(c.id));

  // ── Column width ────────────────────────────────────────────────────────

  const getColumnWidth = (colId: string): number => {
    return columnWidths[colId] || DEFAULT_COLUMNS.find(c => c.id === colId)?.defaultWidth || 120;
  };

  // ── Sorting ─────────────────────────────────────────────────────────────

  const handleSort = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    if (!col?.sortable) return;
    if (sortField === colId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(colId);
      const numericCols = ['visits', 'expiry_days', 'scheduled'];
      setSortDirection(numericCols.includes(colId) ? 'desc' : 'asc');
    }
    setOffset(0);
  };

  const SortIndicator = ({ colId }: { colId: string }) => {
    if (sortField !== colId) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span> {sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColumn(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (colId !== draggedColumn) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColId) return;

    const newCols = [...columns];
    const dragIdx = newCols.findIndex(c => c.id === draggedColumn);
    const dropIdx = newCols.findIndex(c => c.id === targetColId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const [removed] = newCols.splice(dragIdx, 1);
    newCols.splice(dropIdx, 0, removed);
    setColumns(newCols);
    saveColumnOrder(newCols);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // ── Resize ──────────────────────────────────────────────────────────────

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(colId);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = getColumnWidth(colId);
  };

  useEffect(() => {
    if (!resizingColumn) return;
    const col = columns.find(c => c.id === resizingColumn);
    const minWidth = col?.minWidth || 60;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(minWidth, resizeStartWidthRef.current + delta);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      setColumnWidths(prev => {
        saveColumnWidths(prev);
        return prev;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, columns, saveColumnWidths]);

  // ── Close column picker on outside click ────────────────────────────────

  useEffect(() => {
    if (!showColumnPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColumnPicker]);

  // ── Data fetch ──────────────────────────────────────────────────────────

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (expiringDays) params.set('expiringDays', expiringDays);
      if (search) params.set('search', search);
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      params.set('sortField', sortField);
      params.set('sortDirection', sortDirection);

      const res = await fetch(`/api/memberships?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships || []);
        setTotal(data.total || 0);
        if (data.types) setTypes(data.types);
      }
    } catch (err) {
      console.error('Failed to load memberships:', err);
    } finally {
      setLoading(false);
    }
  }, [status, type, expiringDays, search, offset, sortField, sortDirection]);

  useEffect(() => {
    setOffset(0);
  }, [status, type, expiringDays, search]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // ── Cell renderer ───────────────────────────────────────────────────────

  const renderCell = (colId: string, m: MMMembership) => {
    switch (colId) {
      case 'customer':
        return (
          <Link
            href={`/memberships/${m.id}`}
            className="font-medium"
            style={{ color: 'var(--christmas-green-light)' }}
          >
            {m.customer_name || 'Unknown'}
          </Link>
        );
      case 'address':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.customer_address || '—'}</span>;
      case 'type':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.membership_type_name || '—'}</span>;
      case 'status': {
        const badgeStyle = getStatusBadgeStyle(m.status);
        return <span className="badge" style={badgeStyle}>{m.status}</span>;
      }
      case 'start':
        return <span style={{ color: 'var(--text-secondary)' }}>{formatDate(m.start_date)}</span>;
      case 'end':
        return <span style={{ color: 'var(--text-secondary)' }}>{formatDate(m.end_date)}</span>;
      case 'visits':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.total_visits_completed}/{m.total_visits_expected}</span>;
      case 'next_due':
        return <span style={{ color: 'var(--text-secondary)' }}>{formatDate(m.next_visit_due_date)}</span>;
      case 'sold_on':
        return <span style={{ color: 'var(--text-secondary)' }}>{formatDate((m as any).sold_on)}</span>;
      case 'sold_by':
        return <span style={{ color: 'var(--text-secondary)' }}>{(m as any).sold_by_name || '—'}</span>;
      case 'phone':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.customer_phone || '—'}</span>;
      case 'email':
        return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{m.customer_email || '—'}</span>;
      case 'location':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.location_name || '—'}</span>;
      case 'billing':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.billing_frequency || '—'}</span>;
      case 'expiry_days':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.days_until_expiry != null ? m.days_until_expiry : '—'}</span>;
      case 'scheduled':
        return <span style={{ color: 'var(--text-secondary)' }}>{m.total_visits_scheduled ?? '—'}</span>;
      default:
        return '—';
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Memberships
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total} total membership{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Add Columns button */}
        <div className="relative" ref={columnPickerRef}>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="btn btn-secondary text-sm"
          >
            + Columns
          </button>

          {showColumnPicker && (
            <div
              className="absolute right-0 top-full mt-2 z-50 rounded-lg border shadow-xl"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                minWidth: '220px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newVis: Record<string, boolean> = {};
                      columns.forEach(c => { newVis[c.id] = true; });
                      setColumnVisibility(newVis);
                      saveColumnVisibility(newVis);
                    }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    Show All
                  </button>
                  <button
                    onClick={() => {
                      setColumnVisibility({});
                      saveColumnVisibility({});
                    }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              {columns.map(col => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:opacity-80"
                  style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}
                >
                  <input
                    type="checkbox"
                    checked={isColumnVisible(col.id)}
                    onChange={() => toggleColumnVisibility(col.id)}
                    style={{ accentColor: 'var(--christmas-green)' }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search name, address, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: '300px' }}
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="select"
          style={{ maxWidth: '150px' }}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Suspended">Suspended</option>
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="select"
          style={{ maxWidth: '200px' }}
        >
          <option value="">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={expiringDays}
          onChange={(e) => setExpiringDays(e.target.value)}
          className="select"
          style={{ maxWidth: '180px' }}
        >
          <option value="">Any Expiry</option>
          <option value="30">Expiring in 30 days</option>
          <option value="60">Expiring in 60 days</option>
          <option value="90">Expiring in 90 days</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-2" style={{ color: 'var(--christmas-green)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading memberships...</p>
          </div>
        ) : memberships.length === 0 ? (
          <div className="p-8 text-center">
            <p style={{ color: 'var(--text-muted)' }}>No memberships found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="mm-table" style={{ tableLayout: 'fixed', minWidth: visibleColumns.reduce((sum, c) => sum + getColumnWidth(c.id), 0) }}>
                <thead>
                  <tr>
                    {visibleColumns.map(col => (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        onClick={() => handleSort(col.id)}
                        style={{
                          width: getColumnWidth(col.id),
                          minWidth: col.minWidth,
                          position: 'relative',
                          cursor: col.sortable ? 'pointer' : 'default',
                          userSelect: 'none',
                          opacity: draggedColumn === col.id ? 0.5 : 1,
                          borderLeft: dragOverColumn === col.id ? '2px solid var(--status-info)' : undefined,
                          background: dragOverColumn === col.id ? 'rgba(255,255,255,0.05)' : undefined,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ cursor: 'grab', marginRight: '4px', opacity: 0.4, fontSize: '0.65rem' }}>⋮⋮</span>
                        {col.label}
                        {col.sortable && <SortIndicator colId={col.id} />}

                        {/* Resize handle */}
                        <div
                          onMouseDown={(e) => handleResizeStart(e, col.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '5px',
                            cursor: 'col-resize',
                            background: resizingColumn === col.id ? 'var(--christmas-green)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!resizingColumn) (e.target as HTMLElement).style.background = 'var(--border-default)';
                          }}
                          onMouseLeave={(e) => {
                            if (!resizingColumn) (e.target as HTMLElement).style.background = 'transparent';
                          }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m) => (
                    <tr key={m.id}>
                      {visibleColumns.map(col => (
                        <td
                          key={col.id}
                          style={{
                            width: getColumnWidth(col.id),
                            minWidth: col.minWidth,
                            maxWidth: getColumnWidth(col.id),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {renderCell(col.id, m)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="btn btn-secondary text-sm"
                  style={{ opacity: offset === 0 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={currentPage >= totalPages}
                  className="btn btn-secondary text-sm"
                  style={{ opacity: currentPage >= totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
