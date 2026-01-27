'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARInvoice, ARInvoiceTracking, PortalUser } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

interface InvoiceWithTracking extends ARInvoice {
  tracking: ARInvoiceTracking | null;
}

type FilterState = {
  search: string;
  businessUnit: string;
  owner: string;
  controlBucket: string;
  jobStatus: string;
  agingBucket: string;
  customerType: string;
  inhouseFinancing: string;
};

type SortField = 'owner' | 'invoice_date' | 'invoice_number' | 'customer_name' | 'business_unit_name' | 'balance' | 'days_outstanding' | 'aging_bucket' | 'customer_type' | 'job_status' | 'inhouse_financing';
type SortDirection = 'asc' | 'desc';

interface ColumnDef {
  id: SortField;
  label: string;
  sortable: boolean;
  minWidth: number;
  defaultWidth: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'owner', label: 'Owner', sortable: false, minWidth: 80, defaultWidth: 100 },
  { id: 'invoice_date', label: 'Date', sortable: true, minWidth: 80, defaultWidth: 100 },
  { id: 'invoice_number', label: 'Inv #', sortable: true, minWidth: 100, defaultWidth: 120 },
  { id: 'customer_name', label: 'Customer', sortable: true, minWidth: 120, defaultWidth: 180 },
  { id: 'business_unit_name', label: 'Business Unit', sortable: true, minWidth: 100, defaultWidth: 140 },
  { id: 'customer_type', label: 'R/C', sortable: true, minWidth: 50, defaultWidth: 60 },
  { id: 'inhouse_financing', label: 'IHF', sortable: true, minWidth: 40, defaultWidth: 50 },
  { id: 'balance', label: 'Balance', sortable: true, minWidth: 90, defaultWidth: 110 },
  { id: 'job_status', label: 'Job Status', sortable: false, minWidth: 100, defaultWidth: 130 },
  { id: 'days_outstanding', label: 'DSO', sortable: true, minWidth: 50, defaultWidth: 60 },
  { id: 'aging_bucket', label: 'Bucket', sortable: true, minWidth: 70, defaultWidth: 90 },
];

const STORAGE_KEY = 'ar-invoices-column-order';
const WIDTH_STORAGE_KEY = 'ar-invoices-column-widths';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithTracking[]>([]);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    businessUnit: '',
    owner: '',
    controlBucket: '',
    jobStatus: '',
    agingBucket: '',
    customerType: '',
    inhouseFinancing: '',
  });
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const { canUpdateWorkflow, canAssignOwner } = useARPermissions();

  // Load column order and widths from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOrder = JSON.parse(saved) as string[];
        const reordered = savedOrder
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
    } catch (e) {
      console.error('Failed to load column settings:', e);
    }
  }, []);

  // Save column order to localStorage
  function saveColumnOrder(newColumns: ColumnDef[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newColumns.map(c => c.id)));
    } catch (e) {
      console.error('Failed to save column order:', e);
    }
  }

  // Save column widths to localStorage
  function saveColumnWidths(widths: Record<string, number>) {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }

  useEffect(() => {
    fetchInvoices();
    fetchOwners();
  }, []);

  async function fetchInvoices() {
    try {
      const response = await fetch('/api/invoices', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      const invoiceList = data.invoices || [];
      setInvoices(invoiceList);

      const units = [...new Set(invoiceList.map((inv: ARInvoice) => inv.business_unit_name).filter(Boolean))] as string[];
      setBusinessUnits(units.sort());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function fetchOwners() {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setOwners(data.users || []);
    } catch (err) {
      console.error('Failed to fetch owners:', err);
    }
  }

  async function updateTracking(invoiceId: string, field: string, value: any) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Failed to update');
      const updated = await response.json();
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, tracking: updated.tracking } : inv
      ));
    } catch (err) {
      console.error('Update failed:', err);
    }
  }

  // Handle column header click for sorting
  function handleSort(field: SortField) {
    const column = columns.find(c => c.id === field);
    if (!column?.sortable) return;

    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(['balance', 'days_outstanding'].includes(field) ? 'desc' : 'asc');
    }
  }

  // Drag and drop handlers for reordering
  function handleDragStart(e: React.DragEvent, columnId: string) {
    if (resizingColumn) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }

  function handleDragEnd(e: React.DragEvent) {
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

  // Sort indicator component
  function SortIndicator({ field }: { field: SortField }) {
    const column = columns.find(c => c.id === field);
    if (!column?.sortable) return null;

    if (sortField !== field) {
      return <span className="text-gray-500 ml-1 opacity-50">↕</span>;
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  }

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !inv.customer_name.toLowerCase().includes(search) &&
        !inv.invoice_number.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filters.businessUnit && inv.business_unit_name !== filters.businessUnit) return false;
    if (filters.owner && inv.tracking?.owner_id !== filters.owner) return false;
    if (filters.controlBucket && inv.tracking?.control_bucket !== filters.controlBucket) return false;
    if (filters.jobStatus && inv.tracking?.job_status !== filters.jobStatus) return false;
    if (filters.agingBucket && inv.aging_bucket !== filters.agingBucket) return false;
    if (filters.customerType && inv.customer_type !== filters.customerType) return false;
    if (filters.inhouseFinancing) {
      const hasIHF = inv.has_inhouse_financing === true;
      if (filters.inhouseFinancing === 'yes' && !hasIHF) return false;
      if (filters.inhouseFinancing === 'no' && hasIHF) return false;
    }
    return true;
  });

  // Sort invoices
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'invoice_date':
        aVal = new Date(a.invoice_date).getTime();
        bVal = new Date(b.invoice_date).getTime();
        break;
      case 'invoice_number':
        aVal = a.invoice_number.toLowerCase();
        bVal = b.invoice_number.toLowerCase();
        break;
      case 'customer_name':
        aVal = a.customer_name.toLowerCase();
        bVal = b.customer_name.toLowerCase();
        break;
      case 'business_unit_name':
        aVal = (a.business_unit_name || '').toLowerCase();
        bVal = (b.business_unit_name || '').toLowerCase();
        break;
      case 'balance':
        aVal = Number(a.balance);
        bVal = Number(b.balance);
        break;
      case 'days_outstanding':
        aVal = a.days_outstanding;
        bVal = b.days_outstanding;
        break;
      case 'aging_bucket':
        const bucketOrder = { 'current': 0, '30': 1, '60': 2, '90+': 3 };
        aVal = bucketOrder[a.aging_bucket as keyof typeof bucketOrder] ?? 0;
        bVal = bucketOrder[b.aging_bucket as keyof typeof bucketOrder] ?? 0;
        break;
      case 'customer_type':
        aVal = a.customer_type;
        bVal = b.customer_type;
        break;
      case 'inhouse_financing':
        aVal = a.has_inhouse_financing ? 1 : 0;
        bVal = b.has_inhouse_financing ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate totals
  const totalBalance = filteredInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);

  // Get column width
  function getColumnWidth(columnId: string): number {
    const column = columns.find(c => c.id === columnId);
    return columnWidths[columnId] || column?.defaultWidth || 100;
  }

  // Render cell content based on column
  function renderCell(invoice: InvoiceWithTracking, columnId: SortField) {
    switch (columnId) {
      case 'owner':
        return canAssignOwner ? (
          <select
            className="select text-xs py-1"
            value={invoice.tracking?.owner_id || ''}
            onChange={(e) => updateTracking(invoice.id, 'owner_id', e.target.value || null)}
          >
            <option value="">-</option>
            {owners.map(owner => (
              <option key={owner.id} value={owner.id}>
                {owner.name?.split(' ')[0]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs">
            {owners.find(o => o.id === invoice.tracking?.owner_id)?.name?.split(' ')[0] || '-'}
          </span>
        );
      case 'invoice_date':
        return <span className="text-xs whitespace-nowrap">{formatDate(invoice.invoice_date)}</span>;
      case 'invoice_number':
        return (
          <div className="flex items-center gap-1">
            <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline whitespace-nowrap">
              {invoice.invoice_number}
            </Link>
            {invoice.st_invoice_id && invoice.st_invoice_id > 0 && (
              <a
                href={`https://go.servicetitan.com/#/Invoice/${invoice.st_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
                title="Open in ServiceTitan"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      case 'customer_name':
        return (
          <span className="truncate block" title={invoice.customer_name}>
            {invoice.customer_name}
          </span>
        );
      case 'business_unit_name':
        return (
          <span className="text-xs truncate block" title={invoice.business_unit_name || ''}>
            {invoice.business_unit_name || '-'}
          </span>
        );
      case 'customer_type':
        return (
          <span className={`badge ${invoice.customer_type === 'residential' ? 'badge-residential' : 'badge-commercial'}`}>
            {invoice.customer_type === 'residential' ? 'R' : 'C'}
          </span>
        );
      case 'balance':
        return (
          <span className="font-medium whitespace-nowrap" style={{ color: 'var(--status-error)' }}>
            {formatCurrency(invoice.balance)}
          </span>
        );
      case 'job_status':
        return (
          <select
            className="select text-xs py-1"
            value={invoice.tracking?.job_status || ''}
            onChange={(e) => updateTracking(invoice.id, 'job_status', e.target.value || null)}
            disabled={!canUpdateWorkflow}
          >
            <option value="">-</option>
            <option value="qc_booked">QC Booked</option>
            <option value="qc_completed">QC Complete</option>
            <option value="job_not_done">Not Done</option>
            <option value="need_clarification">Clarify</option>
            <option value="construction">Construction</option>
            <option value="tech_question">Tech Q</option>
            <option value="emailed_customer">Emailed</option>
            <option value="payment_promised">Promised</option>
            <option value="financing_pending">Financing</option>
          </select>
        );
      case 'days_outstanding':
        return <span className="text-xs">{invoice.days_outstanding}</span>;
      case 'aging_bucket':
        return (
          <span className={`badge badge-${invoice.aging_bucket === '90+' ? '90' : invoice.aging_bucket}`}>
            {getAgingBucketLabel(invoice.aging_bucket)}
          </span>
        );
      case 'inhouse_financing':
        return invoice.has_inhouse_financing ? (
          <span className="badge badge-financing" title="In-house Financing">💳</span>
        ) : null;
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            AR Invoices
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filteredInvoices.length} invoices · {formatCurrency(totalBalance)} outstanding
          </p>
        </div>
        <button
          className="btn btn-secondary text-xs"
          onClick={() => {
            setColumns(DEFAULT_COLUMNS);
            setColumnWidths({});
            saveColumnOrder(DEFAULT_COLUMNS);
            localStorage.removeItem(WIDTH_STORAGE_KEY);
          }}
        >
          Reset Columns
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Search
            </label>
            <input
              type="text"
              className="input"
              placeholder="Customer, Invoice #"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Business Unit
            </label>
            <select
              className="select"
              value={filters.businessUnit}
              onChange={(e) => setFilters(prev => ({ ...prev, businessUnit: e.target.value }))}
            >
              <option value="">All Business Units</option>
              {businessUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Owner
            </label>
            <select
              className="select"
              value={filters.owner}
              onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
            >
              <option value="">All Owners</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Control Bucket
            </label>
            <select
              className="select"
              value={filters.controlBucket}
              onChange={(e) => setFilters(prev => ({ ...prev, controlBucket: e.target.value }))}
            >
              <option value="">All</option>
              <option value="ar_collectible">AR Collectible</option>
              <option value="ar_not_in_our_control">Not In Control</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Job Status
            </label>
            <select
              className="select"
              value={filters.jobStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, jobStatus: e.target.value }))}
            >
              <option value="">All</option>
              <option value="qc_booked">QC Booked</option>
              <option value="qc_completed">QC Completed</option>
              <option value="job_not_done">Job Not Done</option>
              <option value="need_clarification">Need Clarification</option>
              <option value="construction">Construction</option>
              <option value="tech_question">Tech Question</option>
              <option value="emailed_customer">Emailed Customer</option>
              <option value="payment_promised">Payment Promised</option>
              <option value="financing_pending">Financing Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Aging
            </label>
            <select
              className="select"
              value={filters.agingBucket}
              onChange={(e) => setFilters(prev => ({ ...prev, agingBucket: e.target.value }))}
            >
              <option value="">All</option>
              <option value="current">Current</option>
              <option value="30">31-60 Days</option>
              <option value="60">61-90 Days</option>
              <option value="90+">90+ Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              R/C
            </label>
            <select
              className="select"
              value={filters.customerType}
              onChange={(e) => setFilters(prev => ({ ...prev, customerType: e.target.value }))}
            >
              <option value="">All</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              IHF
            </label>
            <select
              className="select"
              value={filters.inhouseFinancing}
              onChange={(e) => setFilters(prev => ({ ...prev, inhouseFinancing: e.target.value }))}
            >
              <option value="">All</option>
              <option value="yes">In-house</option>
              <option value="no">No IHF</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
          <table className="ar-table" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                {columns.map((column) => (
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
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={invoice.tracking?.closed ? 'row-closed' : ''}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        style={{
                          width: getColumnWidth(column.id),
                          minWidth: column.minWidth,
                          maxWidth: getColumnWidth(column.id),
                        }}
                      >
                        {renderCell(invoice, column.id)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
