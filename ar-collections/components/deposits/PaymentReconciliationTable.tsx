'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';

export interface ReconciliationRecord {
  id: string;
  qb_payment_id: string | null;
  st_payment_id: number | null;
  st_invoice_id: number | null;
  ar_invoice_id: string | null;
  amount: number;
  payment_date: string;
  payment_type: string;
  customer_name: string | null;
  match_status: 'st_only' | 'matched' | 'unmatched' | 'auto_matched' | 'manual_matched' | 'pending_review' | 'discrepancy';
  match_confidence: number | null;
  is_deposited: boolean;
  deposit_date: string | null;
  invoice?: {
    invoice_number: string;
    st_invoice_id: number;
  } | null;
}

interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  minWidth: number;
  defaultWidth: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'payment_date', label: 'Date', minWidth: 80, defaultWidth: 100, sortable: true },
  { id: 'customer_name', label: 'Customer', minWidth: 100, defaultWidth: 180, sortable: true },
  { id: 'amount', label: 'Amount', minWidth: 80, defaultWidth: 110, sortable: true },
  { id: 'payment_type', label: 'Type', minWidth: 70, defaultWidth: 100, sortable: true },
  { id: 'st_payment_id', label: 'ST#', minWidth: 70, defaultWidth: 90, sortable: true },
  { id: 'invoice', label: 'Invoice', minWidth: 100, defaultWidth: 120, sortable: true },
  { id: 'qb_payment_id', label: 'QB#', minWidth: 70, defaultWidth: 90, sortable: true },
  { id: 'match_status', label: 'Status', minWidth: 100, defaultWidth: 130, sortable: true },
  { id: 'is_deposited', label: 'Deposited', minWidth: 80, defaultWidth: 100, sortable: true },
  { id: 'actions', label: 'Actions', minWidth: 60, defaultWidth: 80, sortable: false },
];

const STORAGE_KEY = 'ar-deposits-column-order';
const WIDTH_STORAGE_KEY = 'ar-deposits-column-widths';
const VISIBILITY_STORAGE_KEY = 'ar-deposits-column-visibility';
const SORT_STORAGE_KEY = 'ar-deposits-sort';

interface PaymentReconciliationTableProps {
  records: ReconciliationRecord[];
  loading: boolean;
  onManualMatch: (recordId: string) => void;
  onMarkDiscrepancy: (recordId: string) => void;
}

export default function PaymentReconciliationTable({
  records,
  loading,
  onManualMatch,
  onMarkDiscrepancy,
}: PaymentReconciliationTableProps) {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [sortColumn, setSortColumn] = useState<string>('payment_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Load saved configuration
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem(STORAGE_KEY);
      if (savedOrder) {
        const order = JSON.parse(savedOrder) as string[];
        const reordered = order
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter((col): col is ColumnDef => col !== undefined);
        DEFAULT_COLUMNS.forEach(col => {
          if (!reordered.find(c => c.id === col.id)) {
            reordered.push(col);
          }
        });
        setColumns(reordered);
      }

      const savedWidths = localStorage.getItem(WIDTH_STORAGE_KEY);
      if (savedWidths) {
        setColumnWidths(JSON.parse(savedWidths));
      }

      const savedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (savedVisibility) {
        setColumnVisibility(JSON.parse(savedVisibility));
      }

      const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
      if (savedSort) {
        const { column, direction } = JSON.parse(savedSort);
        setSortColumn(column);
        setSortDirection(direction);
      }
    } catch (e) {
      console.warn('Failed to load table config:', e);
    }
  }, []);

  // Close column picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    if (showColumnPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColumnPicker]);

  // Save functions
  function saveColumnOrder(newColumns: ColumnDef[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newColumns.map(c => c.id)));
    } catch (e) {
      console.warn('Failed to save column order:', e);
    }
  }

  function saveColumnWidths(widths: Record<string, number>) {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {
      console.warn('Failed to save column widths:', e);
    }
  }

  function saveColumnVisibility(visibility: Record<string, boolean>) {
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
    } catch (e) {
      console.warn('Failed to save column visibility:', e);
    }
  }

  function saveSortConfig(column: string, direction: 'asc' | 'desc') {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ column, direction }));
    } catch (e) {
      console.warn('Failed to save sort config:', e);
    }
  }

  // Column visibility
  function toggleColumnVisibility(columnId: string) {
    const newVisibility = {
      ...columnVisibility,
      [columnId]: columnVisibility[columnId] === false ? true : false,
    };
    setColumnVisibility(newVisibility);
    saveColumnVisibility(newVisibility);
  }

  function isColumnVisible(columnId: string): boolean {
    return columnVisibility[columnId] !== false;
  }

  // Get column width
  function getColumnWidth(columnId: string): number {
    const column = columns.find(c => c.id === columnId);
    return columnWidths[columnId] || column?.defaultWidth || 100;
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, columnId: string) {
    if (resizingColumn) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }

  function handleDragEnd() {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedColumn) {
      setDragOverColumn(columnId);
    }
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e: React.DragEvent, targetColumnId: string) {
    e.preventDefault();
    const sourceColumnId = e.dataTransfer.getData('text/plain');

    if (sourceColumnId === targetColumnId) {
      setDragOverColumn(null);
      return;
    }

    const newColumns = [...columns];
    const sourceIndex = newColumns.findIndex(c => c.id === sourceColumnId);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = newColumns.splice(sourceIndex, 1);
      newColumns.splice(targetIndex, 0, removed);
      setColumns(newColumns);
      saveColumnOrder(newColumns);
    }

    setDragOverColumn(null);
  }

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    const column = columns.find(c => c.id === columnId);
    setResizeStartWidth(columnWidths[columnId] || column?.defaultWidth || 100);
  }, [columns, columnWidths]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const column = columns.find(c => c.id === resizingColumn);
      const minWidth = column?.minWidth || 50;
      const newWidth = Math.max(minWidth, resizeStartWidth + diff);

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      if (resizingColumn) {
        saveColumnWidths({
          ...columnWidths,
          [resizingColumn]: columnWidths[resizingColumn] || resizeStartWidth,
        });
      }
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth, columns, columnWidths]);

  // Sort handlers
  function handleSort(columnId: string) {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    const newDirection = sortColumn === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnId);
    setSortDirection(newDirection);
    saveSortConfig(columnId, newDirection);
  }

  // Sort indicator component
  function SortIndicator({ field }: { field: string }) {
    const column = columns.find(c => c.id === field);
    if (!column?.sortable) return null;

    if (sortColumn !== field) {
      return <span className="text-gray-500 ml-1 opacity-50">↕</span>;
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  }

  // Sort records
  const sortedRecords = [...records].sort((a, b) => {
    let aVal: string | number | boolean | null = null;
    let bVal: string | number | boolean | null = null;

    switch (sortColumn) {
      case 'payment_date':
        aVal = a.payment_date;
        bVal = b.payment_date;
        break;
      case 'customer_name':
        aVal = a.customer_name?.toLowerCase() || '';
        bVal = b.customer_name?.toLowerCase() || '';
        break;
      case 'amount':
        aVal = a.amount;
        bVal = b.amount;
        break;
      case 'payment_type':
        aVal = a.payment_type || '';
        bVal = b.payment_type || '';
        break;
      case 'st_payment_id':
        aVal = a.st_payment_id || 0;
        bVal = b.st_payment_id || 0;
        break;
      case 'invoice':
        aVal = a.invoice?.invoice_number || '';
        bVal = b.invoice?.invoice_number || '';
        break;
      case 'qb_payment_id':
        aVal = a.qb_payment_id || '';
        bVal = b.qb_payment_id || '';
        break;
      case 'match_status':
        aVal = a.match_status;
        bVal = b.match_status;
        break;
      case 'is_deposited':
        aVal = a.is_deposited ? 1 : 0;
        bVal = b.is_deposited ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aVal === null || aVal === '') return 1;
    if (bVal === null || bVal === '') return -1;
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Reset all
  function handleResetAll() {
    setColumns(DEFAULT_COLUMNS);
    setColumnWidths({});
    setColumnVisibility({});
    setSortColumn('payment_date');
    setSortDirection('desc');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WIDTH_STORAGE_KEY);
    localStorage.removeItem(VISIBILITY_STORAGE_KEY);
    localStorage.removeItem(SORT_STORAGE_KEY);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading payments...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--christmas-green)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        <p className="text-lg font-medium" style={{ color: 'var(--christmas-green)' }}>
          All clear!
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          No payments need attention in this view. Run a sync to check for new data.
        </p>
      </div>
    );
  }

  function getStatusBadge(status: string, confidence: number | null) {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      st_only: {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: 'var(--status-error)',
        label: 'Needs Tracking',
      },
      matched: {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: 'var(--christmas-green)',
        label: 'Matched',
      },
      auto_matched: {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: 'var(--christmas-green)',
        label: 'Auto-Matched',
      },
      manual_matched: {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: 'var(--christmas-green)',
        label: 'Matched',
      },
      pending_review: {
        bg: 'rgba(234, 179, 8, 0.15)',
        color: '#eab308',
        label: 'Pending Review',
      },
      unmatched: {
        bg: 'rgba(156, 163, 175, 0.15)',
        color: 'var(--text-secondary)',
        label: 'Unmatched',
      },
      discrepancy: {
        bg: 'rgba(239, 68, 68, 0.15)',
        color: 'var(--status-error)',
        label: 'Discrepancy',
      },
    };

    const style = styles[status] || styles.unmatched;

    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {style.label}
        {confidence !== null && confidence > 0 && confidence < 1 && (
          <span className="opacity-75">({Math.round(confidence * 100)}%)</span>
        )}
      </span>
    );
  }

  function getDepositStatus(isDeposited: boolean, depositDate: string | null) {
    if (isDeposited) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--christmas-green)' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Deposited
          {depositDate && (
            <span className="opacity-75">{formatDate(depositDate)}</span>
          )}
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}
      >
        Undeposited
      </span>
    );
  }

  function renderCell(record: ReconciliationRecord, columnId: string) {
    switch (columnId) {
      case 'payment_date':
        return <span className="text-xs whitespace-nowrap">{formatDate(record.payment_date)}</span>;
      case 'customer_name':
        return (
          <span className="text-xs truncate block" title={record.customer_name || ''}>
            {record.customer_name || <span style={{ color: 'var(--text-muted)' }}>Unknown</span>}
          </span>
        );
      case 'amount':
        return <span className="text-xs tabular-nums font-medium">{formatCurrency(record.amount)}</span>;
      case 'payment_type':
        return <span className="text-xs capitalize">{record.payment_type || '—'}</span>;
      case 'st_payment_id':
        if (record.st_payment_id) {
          // Link to ServiceTitan invoice if available
          if (record.st_invoice_id) {
            return (
              <a
                href={`https://go.servicetitan.com/#/Invoice/${record.st_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: 'var(--christmas-green)' }}
                title="Open invoice in ServiceTitan"
              >
                {record.st_payment_id}
              </a>
            );
          }
          return <span className="text-xs font-mono">{record.st_payment_id}</span>;
        }
        return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
      case 'invoice':
        if (record.invoice) {
          return (
            <div className="flex items-center gap-1">
              <Link
                href={`/invoices/${record.ar_invoice_id}`}
                className="text-xs hover:underline"
                style={{ color: 'var(--christmas-green)' }}
              >
                {record.invoice.invoice_number}
              </Link>
              <a
                href={`https://go.servicetitan.com/#/Invoice/${record.invoice.st_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                title="Open in ServiceTitan"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          );
        }
        if (record.st_payment_id) {
          return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ST#{record.st_payment_id}</span>;
        }
        return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
      case 'qb_payment_id':
        return record.qb_payment_id ? (
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {record.qb_payment_id}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
        );
      case 'match_status':
        return getStatusBadge(record.match_status, record.match_confidence);
      case 'is_deposited':
        return getDepositStatus(record.is_deposited, record.deposit_date);
      case 'actions':
        // ST-only records (needs tracking) - can mark as discrepancy (needs investigation)
        if (record.match_status === 'st_only') {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onMarkDiscrepancy(record.id)}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                title="Mark as discrepancy - needs investigation"
              >
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </button>
            </div>
          );
        }
        // Unmatched QB payments - can match to invoice or mark as discrepancy
        if (record.match_status === 'unmatched' || record.match_status === 'pending_review') {
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onManualMatch(record.id)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Match to invoice"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </button>
              <button
                onClick={() => onMarkDiscrepancy(record.id)}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                title="Mark as discrepancy"
              >
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </button>
            </div>
          );
        }
        return null;
      default:
        return null;
    }
  }

  const visibleColumns = columns.filter(col => isColumnVisible(col.id));

  return (
    <div className="space-y-4">
      {/* Column Picker */}
      <div className="flex justify-end">
        <div className="relative" ref={columnPickerRef}>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
          >
            Columns
          </button>
          {showColumnPicker && (
            <div
              className="absolute right-0 top-full mt-2 p-3 rounded-lg shadow-lg z-50 min-w-[200px]"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                Show/Hide Columns
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {DEFAULT_COLUMNS.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={isColumnVisible(col.id)}
                      onChange={() => toggleColumnVisibility(col.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  className="text-xs flex-1 text-center px-2 py-1 rounded hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => {
                    setColumnVisibility({});
                    saveColumnVisibility({});
                  }}
                >
                  Show All
                </button>
                <button
                  className="text-xs flex-1 text-center px-2 py-1 rounded hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={handleResetAll}
                >
                  Reset All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 400px)' }}>
        <table className="ar-table" style={{ minWidth: 'max-content' }}>
          <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-card)' }}>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  draggable={!resizingColumn}
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                  onClick={() => !resizingColumn && handleSort(column.id)}
                  className={`
                    ${column.sortable ? 'cursor-pointer' : ''}
                    hover:bg-white/5 select-none transition-all relative
                    ${dragOverColumn === column.id ? 'bg-white/10 border-l-2 border-blue-400' : ''}
                    ${draggedColumn === column.id ? 'opacity-50' : ''}
                  `}
                  style={{
                    width: getColumnWidth(column.id),
                    minWidth: column.minWidth,
                  }}
                >
                  <div className="flex items-center gap-1 pr-2">
                    <span className="text-gray-500 cursor-grab text-xs">⋮⋮</span>
                    <span className="truncate">{column.label}</span>
                    <SortIndicator field={column.id} />
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group"
                    onMouseDown={(e) => handleResizeStart(e, column.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-500 group-hover:bg-blue-400" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((record) => (
              <tr key={record.id} className="hover:bg-white/5">
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    style={{
                      width: getColumnWidth(column.id),
                      minWidth: column.minWidth,
                      maxWidth: getColumnWidth(column.id),
                    }}
                  >
                    {renderCell(record, column.id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
