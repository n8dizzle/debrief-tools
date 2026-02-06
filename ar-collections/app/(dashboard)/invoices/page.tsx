'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatCurrency, formatDate, getAgingBucketLabel } from '@/lib/ar-utils';
import { ARInvoice, ARInvoiceTracking, PortalUser, ARJobStatusOption } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';
import QuickLogButtons from '@/components/QuickLogButtons';

interface InvoiceWithTracking extends ARInvoice {
  tracking: ARInvoiceTracking | null;
}

type FilterState = {
  search: string;
  businessUnits: string[];
  owners: string[];
  controlBuckets: string[];
  jobStatuses: string[];
  agingBucket: string;
  customerType: string;
  invoiceType: string; // 'membership' | 'service' | '' (all)
};

// Multi-select dropdown component
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="select w-full text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selected.length === 0 ? 'opacity-60' : ''}>{displayText}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          )}
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type SortField = 'owner' | 'invoice_date' | 'invoice_number' | 'customer_name' | 'location_name' | 'business_unit_name' | 'balance' | 'days_outstanding' | 'aging_bucket' | 'customer_type' | 'job_status' | 'st_job_type_name' | 'inhouse_financing' | 'is_membership_invoice' | 'booking_payment_type' | 'control_bucket' | 'project_name' | 'actions';
type SortDirection = 'asc' | 'desc';

interface ColumnDef {
  id: SortField;
  label: string;
  sortable: boolean;
  minWidth: number;
  defaultWidth: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'owner', label: 'AR Owner', sortable: false, minWidth: 80, defaultWidth: 100 },
  { id: 'invoice_date', label: 'Date', sortable: true, minWidth: 80, defaultWidth: 100 },
  { id: 'invoice_number', label: 'Inv #', sortable: true, minWidth: 100, defaultWidth: 120 },
  { id: 'customer_name', label: 'Customer', sortable: true, minWidth: 120, defaultWidth: 180 },
  { id: 'location_name', label: 'Location', sortable: true, minWidth: 120, defaultWidth: 180 },
  { id: 'business_unit_name', label: 'Business Unit', sortable: true, minWidth: 100, defaultWidth: 140 },
  { id: 'project_name', label: 'Project', sortable: true, minWidth: 100, defaultWidth: 140 },
  { id: 'st_job_type_name', label: 'Job Type', sortable: true, minWidth: 80, defaultWidth: 100 },
  { id: 'customer_type', label: 'R/C', sortable: true, minWidth: 50, defaultWidth: 60 },
  { id: 'inhouse_financing', label: 'IHF', sortable: true, minWidth: 40, defaultWidth: 50 },
  { id: 'is_membership_invoice', label: 'Mbrshp Inv', sortable: true, minWidth: 60, defaultWidth: 70 },
  { id: 'booking_payment_type', label: 'Booked Pay', sortable: true, minWidth: 80, defaultWidth: 100 },
  { id: 'balance', label: 'Balance', sortable: true, minWidth: 90, defaultWidth: 110 },
  { id: 'job_status', label: 'Job Status', sortable: false, minWidth: 100, defaultWidth: 130 },
  { id: 'control_bucket', label: 'Actionable AR', sortable: true, minWidth: 90, defaultWidth: 110 },
  { id: 'days_outstanding', label: 'DSO', sortable: true, minWidth: 50, defaultWidth: 60 },
  { id: 'aging_bucket', label: 'Bucket', sortable: true, minWidth: 70, defaultWidth: 90 },
  { id: 'actions', label: 'Log', sortable: false, minWidth: 80, defaultWidth: 90 },
];

const STORAGE_KEY = 'ar-invoices-column-order';
const WIDTH_STORAGE_KEY = 'ar-invoices-column-widths';
const VISIBILITY_STORAGE_KEY = 'ar-invoices-column-visibility';

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithTracking[]>([]);
  const [owners, setOwners] = useState<PortalUser[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get('search') || '',
    businessUnits: searchParams.get('businessUnits')?.split(',').filter(Boolean) || [],
    owners: searchParams.get('owners')?.split(',').filter(Boolean) || [],
    controlBuckets: searchParams.get('controlBuckets')?.split(',').filter(Boolean) || [],
    jobStatuses: searchParams.get('jobStatuses')?.split(',').filter(Boolean) || [],
    agingBucket: searchParams.get('agingBucket') || '',
    customerType: searchParams.get('customerType') || '',
    invoiceType: searchParams.get('invoiceType') || '',
  }));
  const [sortField, setSortField] = useState<SortField>((searchParams.get('sortField') as SortField) || 'balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>((searchParams.get('sortDir') as SortDirection) || 'desc');
  const [excludeInhouseFinancing, setExcludeInhouseFinancing] = useState(searchParams.get('excludeIHF') !== 'false');
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [jobStatuses, setJobStatuses] = useState<ARJobStatusOption[]>([]);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const { canUpdateWorkflow, canAssignOwner, canChangeControlBucket } = useARPermissions();

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.businessUnits.length > 0) params.set('businessUnits', filters.businessUnits.join(','));
    if (filters.owners.length > 0) params.set('owners', filters.owners.join(','));
    if (filters.controlBuckets.length > 0) params.set('controlBuckets', filters.controlBuckets.join(','));
    if (filters.jobStatuses.length > 0) params.set('jobStatuses', filters.jobStatuses.join(','));
    if (filters.agingBucket) params.set('agingBucket', filters.agingBucket);
    if (filters.customerType) params.set('customerType', filters.customerType);
    if (filters.invoiceType) params.set('invoiceType', filters.invoiceType);
    if (sortField !== 'balance') params.set('sortField', sortField);
    if (sortDirection !== 'desc') params.set('sortDir', sortDirection);
    if (!excludeInhouseFinancing) params.set('excludeIHF', 'false');

    const queryString = params.toString();
    const newUrl = queryString ? `/invoices?${queryString}` : '/invoices';

    // Use replace to avoid adding to history on every filter change
    router.replace(newUrl, { scroll: false });
  }, [filters, sortField, sortDirection, excludeInhouseFinancing, router]);

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

      const savedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (savedVisibility) {
        setColumnVisibility(JSON.parse(savedVisibility));
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

  // Save column visibility to localStorage
  function saveColumnVisibility(visibility: Record<string, boolean>) {
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
    } catch (e) {
      console.error('Failed to save column visibility:', e);
    }
  }

  // Toggle column visibility
  function toggleColumnVisibility(columnId: string) {
    const newVisibility = {
      ...columnVisibility,
      [columnId]: columnVisibility[columnId] === false ? true : false,
    };
    setColumnVisibility(newVisibility);
    saveColumnVisibility(newVisibility);
  }

  // Check if column is visible (default to true if not set)
  function isColumnVisible(columnId: string): boolean {
    return columnVisibility[columnId] !== false;
  }

  useEffect(() => {
    fetchInvoices();
    fetchOwners();
    fetchJobStatuses();
    fetchLastSync();
  }, []);

  async function fetchLastSync() {
    try {
      const response = await fetch('/api/sync/last', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLastSyncAt(data.last_sync_at);
      }
    } catch (err) {
      console.error('Failed to fetch last sync:', err);
    }
  }

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

  async function fetchJobStatuses() {
    try {
      const response = await fetch('/api/settings/job-statuses', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      setJobStatuses(data.statuses || []);
    } catch (err) {
      console.error('Failed to fetch job statuses:', err);
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
    if (filters.businessUnits.length > 0 && !filters.businessUnits.includes(inv.business_unit_name || '')) return false;
    if (filters.owners.length > 0 && !filters.owners.includes(inv.tracking?.owner_id || '')) return false;
    if (filters.controlBuckets.length > 0 && !filters.controlBuckets.includes(inv.tracking?.control_bucket || '')) return false;
    if (filters.jobStatuses.length > 0 && !filters.jobStatuses.includes(inv.tracking?.job_status || '')) return false;
    if (filters.agingBucket && inv.aging_bucket !== filters.agingBucket) return false;
    if (filters.customerType && inv.customer_type !== filters.customerType) return false;
    if (excludeInhouseFinancing && inv.has_inhouse_financing) return false;
    if (filters.invoiceType) {
      const isMembershipInvoice = (inv as any).is_membership_invoice || false;
      if (filters.invoiceType === 'membership' && !isMembershipInvoice) return false;
      if (filters.invoiceType === 'service' && isMembershipInvoice) return false;
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
      case 'location_name':
        aVal = (a.location_name || '').toLowerCase();
        bVal = (b.location_name || '').toLowerCase();
        break;
      case 'business_unit_name':
        aVal = (a.business_unit_name || '').toLowerCase();
        bVal = (b.business_unit_name || '').toLowerCase();
        break;
      case 'st_job_type_name':
        aVal = (a.st_job_type_name || '').toLowerCase();
        bVal = (b.st_job_type_name || '').toLowerCase();
        break;
      case 'project_name':
        aVal = (a.project_name || '').toLowerCase();
        bVal = (b.project_name || '').toLowerCase();
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
      case 'is_membership_invoice':
        aVal = (a as any).is_membership_invoice ? 1 : 0;
        bVal = (b as any).is_membership_invoice ? 1 : 0;
        break;
      case 'booking_payment_type':
        aVal = (a.booking_payment_type || '').toLowerCase();
        bVal = (b.booking_payment_type || '').toLowerCase();
        break;
      case 'control_bucket':
        aVal = a.tracking?.control_bucket === 'ar_not_in_our_control' ? 1 : 0;
        bVal = b.tracking?.control_bucket === 'ar_not_in_our_control' ? 1 : 0;
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
            <Link href={`/invoices/${invoice.id}`} className="text-xs font-medium hover:underline whitespace-nowrap">
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
        const stCustomerId = (invoice as any).st_customer_id;
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs truncate" title={invoice.customer_name}>
              {invoice.customer_name}
            </span>
            {stCustomerId && stCustomerId > 0 && (
              <a
                href={`https://go.servicetitan.com/#/Customer/${stCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                title="Open Customer in ServiceTitan"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      case 'location_name':
        const stLocationId = invoice.st_location_id;
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs truncate" title={invoice.location_name || ''}>
              {invoice.location_name || '-'}
            </span>
            {stLocationId && stLocationId > 0 && (
              <a
                href={`https://go.servicetitan.com/#/Location/${stLocationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                title="Open Location in ServiceTitan"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      case 'business_unit_name':
        return (
          <span className="text-xs truncate block" title={invoice.business_unit_name || ''}>
            {invoice.business_unit_name || '-'}
          </span>
        );
      case 'st_job_type_name':
        return (
          <span className="text-xs truncate block" title={invoice.st_job_type_name || ''}>
            {invoice.st_job_type_name || '-'}
          </span>
        );
      case 'project_name':
        const stProjectId = invoice.st_project_id;
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs truncate" title={invoice.project_name || ''}>
              {invoice.project_name || '-'}
            </span>
            {stProjectId && stProjectId > 0 && (
              <a
                href={`https://go.servicetitan.com/#/project/${stProjectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                title="Open Project in ServiceTitan"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      case 'customer_type':
        return (
          <span className={`text-xs badge ${invoice.customer_type === 'residential' ? 'badge-residential' : 'badge-commercial'}`}>
            {invoice.customer_type === 'residential' ? 'R' : 'C'}
          </span>
        );
      case 'balance':
        return (
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--status-error)' }}>
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
            {jobStatuses.map(status => (
              <option key={status.key} value={status.key}>{status.label}</option>
            ))}
          </select>
        );
      case 'control_bucket':
        return (
          <span className={`text-xs badge ${invoice.tracking?.control_bucket === 'ar_not_in_our_control' ? 'badge-30' : 'badge-current'}`}>
            {invoice.tracking?.control_bucket === 'ar_not_in_our_control' ? 'Pending Closures' : 'Actionable AR'}
          </span>
        );
      case 'days_outstanding':
        return <span className="text-xs">{invoice.days_outstanding}</span>;
      case 'aging_bucket':
        return (
          <span className={`text-xs badge badge-${invoice.aging_bucket === '90+' ? '90' : invoice.aging_bucket}`}>
            {getAgingBucketLabel(invoice.aging_bucket)}
          </span>
        );
      case 'inhouse_financing':
        return invoice.has_inhouse_financing ? (
          <span className="text-xs badge badge-financing" title="In-house Financing">💳</span>
        ) : null;
      case 'is_membership_invoice':
        return (invoice as any).is_membership_invoice ? (
          <span className="text-xs" title="Membership Invoice">📋</span>
        ) : null;
      case 'booking_payment_type':
        return (
          <span className="text-xs truncate block" title={invoice.booking_payment_type || ''}>
            {invoice.booking_payment_type || '-'}
          </span>
        );
      case 'actions':
        return (
          <QuickLogButtons
            invoiceId={invoice.id}
            compact
          />
        );
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
            {lastSyncAt && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                • Last synced {new Date(lastSyncAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Exclude In-House Financing
            </span>
            <button
              onClick={() => setExcludeInhouseFinancing(!excludeInhouseFinancing)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{
                backgroundColor: excludeInhouseFinancing ? 'var(--christmas-green)' : 'var(--bg-secondary)',
              }}
            >
              <span
                className="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform"
                style={{
                  backgroundColor: 'var(--christmas-cream)',
                  transform: excludeInhouseFinancing ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Quick Chip Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Quick filters:</span>

        {/* Customer Type Chips */}
        <button
          onClick={() => setFilters(prev => ({
            ...prev,
            customerType: prev.customerType === 'residential' ? '' : 'residential'
          }))}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: filters.customerType === 'residential' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-secondary)',
            color: filters.customerType === 'residential' ? '#f87171' : 'var(--text-secondary)',
            border: filters.customerType === 'residential' ? '1px solid #f87171' : '1px solid var(--border-subtle)',
          }}
        >
          Residential
        </button>
        <button
          onClick={() => setFilters(prev => ({
            ...prev,
            customerType: prev.customerType === 'commercial' ? '' : 'commercial'
          }))}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: filters.customerType === 'commercial' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
            color: filters.customerType === 'commercial' ? '#60a5fa' : 'var(--text-secondary)',
            border: filters.customerType === 'commercial' ? '1px solid #60a5fa' : '1px solid var(--border-subtle)',
          }}
        >
          Commercial
        </button>

        <span className="mx-2" style={{ color: 'var(--border-subtle)' }}>|</span>

        {/* Aging Bucket Chips */}
        {[
          { value: 'current', label: 'Current', color: '#4ade80' },
          { value: '30', label: '31-60', color: '#fcd34d' },
          { value: '60', label: '61-90', color: '#fb923c' },
          { value: '90+', label: '90+', color: '#f87171' },
        ].map((bucket) => (
          <button
            key={bucket.value}
            onClick={() => setFilters(prev => ({
              ...prev,
              agingBucket: prev.agingBucket === bucket.value ? '' : bucket.value
            }))}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filters.agingBucket === bucket.value ? `${bucket.color}20` : 'var(--bg-secondary)',
              color: filters.agingBucket === bucket.value ? bucket.color : 'var(--text-secondary)',
              border: filters.agingBucket === bucket.value ? `1px solid ${bucket.color}` : '1px solid var(--border-subtle)',
            }}
          >
            {bucket.label}
          </button>
        ))}

        <span className="mx-2" style={{ color: 'var(--border-subtle)' }}>|</span>

        {/* Actionable AR Chips */}
        <button
          onClick={() => setFilters(prev => ({
            ...prev,
            controlBuckets: prev.controlBuckets.includes('ar_collectible') ? [] : ['ar_collectible']
          }))}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: filters.controlBuckets.includes('ar_collectible') ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-secondary)',
            color: filters.controlBuckets.includes('ar_collectible') ? '#4ade80' : 'var(--text-secondary)',
            border: filters.controlBuckets.includes('ar_collectible') ? '1px solid #4ade80' : '1px solid var(--border-subtle)',
          }}
        >
          Actionable AR
        </button>
        <button
          onClick={() => setFilters(prev => ({
            ...prev,
            controlBuckets: prev.controlBuckets.includes('ar_not_in_our_control') ? [] : ['ar_not_in_our_control']
          }))}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: filters.controlBuckets.includes('ar_not_in_our_control') ? 'rgba(251, 146, 60, 0.2)' : 'var(--bg-secondary)',
            color: filters.controlBuckets.includes('ar_not_in_our_control') ? '#fb923c' : 'var(--text-secondary)',
            border: filters.controlBuckets.includes('ar_not_in_our_control') ? '1px solid #fb923c' : '1px solid var(--border-subtle)',
          }}
        >
          Pending Closures
        </button>

        <span className="mx-2" style={{ color: 'var(--border-subtle)' }}>|</span>

        {/* Membership Invoices Chip */}
        <button
          onClick={() => setFilters(prev => ({
            ...prev,
            invoiceType: prev.invoiceType === 'membership' ? '' : 'membership'
          }))}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: filters.invoiceType === 'membership' ? 'rgba(147, 51, 234, 0.2)' : 'var(--bg-secondary)',
            color: filters.invoiceType === 'membership' ? '#a78bfa' : 'var(--text-secondary)',
            border: filters.invoiceType === 'membership' ? '1px solid #a78bfa' : '1px solid var(--border-subtle)',
          }}
        >
          Membership Invoices
        </button>

        {/* Clear All Filters */}
        {(filters.customerType || filters.agingBucket || filters.invoiceType || filters.businessUnits.length > 0 || filters.owners.length > 0 || filters.controlBuckets.length > 0 || filters.jobStatuses.length > 0) && (
          <button
            onClick={() => setFilters({
              search: filters.search,
              businessUnits: [],
              owners: [],
              controlBuckets: [],
              jobStatuses: [],
              agingBucket: '',
              customerType: '',
              invoiceType: '',
            })}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all ml-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Clear All
          </button>
        )}
        </div>

        {/* Column Picker */}
        <div className="relative" ref={columnPickerRef}>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
          >
            Add Columns
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
                  onClick={() => {
                    setColumns(DEFAULT_COLUMNS);
                    setColumnWidths({});
                    setColumnVisibility({});
                    saveColumnOrder(DEFAULT_COLUMNS);
                    localStorage.removeItem(WIDTH_STORAGE_KEY);
                    localStorage.removeItem(VISIBILITY_STORAGE_KEY);
                  }}
                >
                  Reset All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <MultiSelectDropdown
              label="Business Unit"
              options={businessUnits.map(unit => ({ value: unit, label: unit }))}
              selected={filters.businessUnits}
              onChange={(values) => setFilters(prev => ({ ...prev, businessUnits: values }))}
              placeholder="All Business Units"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              AR Owner
            </label>
            <MultiSelectDropdown
              label="AR Owner"
              options={owners.map(owner => ({ value: owner.id, label: owner.name || owner.email }))}
              selected={filters.owners}
              onChange={(values) => setFilters(prev => ({ ...prev, owners: values }))}
              placeholder="All AR Owners"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Job Status
            </label>
            <MultiSelectDropdown
              label="Job Status"
              options={jobStatuses.map(status => ({ value: status.key, label: status.label }))}
              selected={filters.jobStatuses}
              onChange={(values) => setFilters(prev => ({ ...prev, jobStatuses: values }))}
              placeholder="All"
            />
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
          <table className="ar-table" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                {columns.filter(col => isColumnVisible(col.id)).map((column) => (
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
                  <td colSpan={columns.filter(col => isColumnVisible(col.id)).length} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={invoice.tracking?.closed ? 'row-closed' : ''}
                  >
                    {columns.filter(col => isColumnVisible(col.id)).map((column) => (
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
