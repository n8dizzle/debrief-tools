'use client';

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { APInstallJob, APContractor, APContractorRate } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/ap-utils';
import PaymentStatusBadge from './PaymentStatusBadge';
import AssignmentBadge from './AssignmentBadge';

// --- Column definitions ---

type SortKey =
  | 'job_number'
  | 'customer_name'
  | 'business_unit'
  | 'job_type_name'
  | 'invoice_number'
  | 'invoice_date'
  | 'date'
  | 'job_status'
  | 'job_total'
  | 'invoice_exported'
  | 'assignment_type'
  | 'contractor'
  | 'labor_cost'
  | 'payment_status';

interface ColumnDef {
  key: SortKey;
  label: string;
  defaultWidth: number;
  minWidth: number;
}

const COLUMNS: ColumnDef[] = [
  { key: 'job_number', label: 'Job #', defaultWidth: 100, minWidth: 70 },
  { key: 'customer_name', label: 'Customer', defaultWidth: 180, minWidth: 120 },
  { key: 'business_unit', label: 'Business Unit', defaultWidth: 160, minWidth: 100 },
  { key: 'job_type_name', label: 'Type', defaultWidth: 140, minWidth: 80 },
  { key: 'invoice_number', label: 'Invoice #', defaultWidth: 110, minWidth: 80 },
  { key: 'invoice_date', label: 'Inv Date', defaultWidth: 90, minWidth: 70 },
  { key: 'date', label: 'Completed', defaultWidth: 100, minWidth: 80 },
  { key: 'job_status', label: 'Status', defaultWidth: 110, minWidth: 80 },
  { key: 'job_total', label: 'Job Total', defaultWidth: 100, minWidth: 80 },
  { key: 'invoice_exported', label: 'Exported', defaultWidth: 100, minWidth: 80 },
  { key: 'assignment_type', label: 'Assignment', defaultWidth: 120, minWidth: 100 },
  { key: 'contractor', label: 'Contractor', defaultWidth: 140, minWidth: 100 },
  { key: 'labor_cost', label: 'Labor Cost', defaultWidth: 120, minWidth: 90 },
  { key: 'payment_status', label: 'Pay Status', defaultWidth: 110, minWidth: 80 },
];

const DEFAULT_ORDER = COLUMNS.map((_, i) => i);
const DEFAULT_WIDTHS = COLUMNS.map(c => c.defaultWidth);
const STORAGE_KEY_ORDER = 'ap-jobs-col-order';
const STORAGE_KEY_WIDTHS = 'ap-jobs-col-widths';
const STORAGE_KEY_VISIBILITY = 'ap-jobs-col-visibility';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate array length matches column count (for array types)
      if (Array.isArray(parsed) && Array.isArray(fallback) && parsed.length === (fallback as unknown[]).length) {
        return parsed as T;
      }
      // For object types (visibility map), just return as-is
      if (!Array.isArray(parsed) && typeof parsed === 'object') {
        return parsed as T;
      }
    }
  } catch { /* ignore */ }
  return fallback;
}

// --- Sort helpers ---

const PAYMENT_STATUS_ORDER: Record<string, number> = {
  none: 0, received: 1, pending_approval: 2, ready_to_pay: 3, paid: 4,
};

const ASSIGNMENT_ORDER: Record<string, number> = {
  unassigned: 0, in_house: 1, contractor: 2,
};

const JOB_STATUS_ORDER: Record<string, number> = {
  Completed: 0, InProgress: 1, Scheduled: 2, Canceled: 3,
};

function getSortValue(job: APInstallJob, key: SortKey): string | number {
  switch (key) {
    case 'job_number': return job.job_number || '';
    case 'customer_name': return (job.customer_name || '').toLowerCase();
    case 'business_unit': return (job.business_unit_name || job.trade || '').toLowerCase();
    case 'job_type_name': return (job.job_type_name || '').toLowerCase();
    case 'invoice_number': return job.invoice_number || '';
    case 'invoice_date': return job.invoice_date || '';
    case 'date': return job.completed_date || job.scheduled_date || '';
    case 'job_status': return JOB_STATUS_ORDER[job.job_status || ''] ?? 99;
    case 'job_total': return job.job_total != null ? Number(job.job_total) : -1;
    case 'invoice_exported': return (job.invoice_exported_status || '').toLowerCase();
    case 'assignment_type': return ASSIGNMENT_ORDER[job.assignment_type] ?? 0;
    case 'contractor': return (job.contractor?.name || '').toLowerCase();
    case 'labor_cost': {
      if (job.assignment_type === 'contractor') return job.payment_amount != null ? Number(job.payment_amount) : -1;
      if (job.assignment_type === 'in_house') return job.labor_cost != null ? Number(job.labor_cost) : -1;
      return -1;
    }
    case 'payment_status': return PAYMENT_STATUS_ORDER[job.payment_status] ?? 0;
  }
}

// --- Props ---

interface JobsTableProps {
  jobs: APInstallJob[];
  contractors: APContractor[];
  isLoading: boolean;
  canManageAssignments: boolean;
  canManagePayments: boolean;
  onAssign: (jobId: string, data: {
    assignment_type: 'unassigned' | 'in_house' | 'contractor';
    contractor_id?: string;
    payment_amount?: number;
  }) => Promise<void>;
  onPaymentStatusChange: (jobId: string, newStatus: string) => Promise<void>;
  onBulkExclude?: (jobIds: string[], isIgnored: boolean) => Promise<void>;
  showIgnored?: boolean;
  columnPickerContainer?: React.RefObject<HTMLDivElement | null>;
  sortKey?: SortKey | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: SortKey, dir: 'asc' | 'desc') => void;
}

// --- Inline row component ---

function InlineAssignmentRow({
  job,
  contractors,
  canManageAssignments,
  canManagePayments,
  onAssign,
  onPaymentStatusChange,
  isSelected,
  onToggleSelect,
  showCheckbox,
  columnOrder,
}: {
  job: APInstallJob;
  contractors: APContractor[];
  canManageAssignments: boolean;
  canManagePayments: boolean;
  onAssign: JobsTableProps['onAssign'];
  onPaymentStatusChange: JobsTableProps['onPaymentStatusChange'];
  isSelected: boolean;
  onToggleSelect: () => void;
  showCheckbox: boolean;
  columnOrder: number[];
}) {
  const router = useRouter();
  const [assignmentType, setAssignmentType] = useState(job.assignment_type);
  const [contractorId, setContractorId] = useState(job.contractor_id || '');
  const [paymentAmount, setPaymentAmount] = useState(
    job.payment_amount != null ? String(job.payment_amount) : ''
  );
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<APContractorRate[]>([]);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAssignmentType(job.assignment_type);
    setContractorId(job.contractor_id || '');
    setPaymentAmount(job.payment_amount != null ? String(job.payment_amount) : '');
  }, [job.assignment_type, job.contractor_id, job.payment_amount]);

  useEffect(() => {
    if (!contractorId || assignmentType !== 'contractor') {
      setRates([]);
      return;
    }
    let cancelled = false;
    async function loadRates() {
      try {
        const res = await fetch(`/api/contractors/${contractorId}/rates`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRates(data);
          const matchingRate = data.find((r: APContractorRate) =>
            r.trade === job.trade &&
            r.job_type_name.toLowerCase() === (job.job_type_name || '').toLowerCase()
          );
          if (matchingRate && !paymentAmount) {
            const amount = String(matchingRate.rate_amount);
            setPaymentAmount(amount);
            saveAssignment('contractor', contractorId, parseFloat(amount));
          }
        }
      } catch { /* ignore */ }
    }
    loadRates();
    return () => { cancelled = true; };
  }, [contractorId]);

  const saveAssignment = async (type: string, conId?: string, amount?: number) => {
    setSaving(true);
    try {
      await onAssign(job.id, {
        assignment_type: type as 'unassigned' | 'in_house' | 'contractor',
        contractor_id: type === 'contractor' ? conId : undefined,
        payment_amount: type === 'contractor' && amount ? amount : undefined,
      });
    } catch (err) {
      console.error('Failed to save assignment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentChange = async (newType: string) => {
    setAssignmentType(newType as any);
    if (newType !== 'contractor') {
      setContractorId('');
      setPaymentAmount('');
      await saveAssignment(newType);
    }
  };

  const handleContractorChange = async (newContractorId: string) => {
    setContractorId(newContractorId);
    if (newContractorId) {
      setTimeout(async () => {
        if (!rates.length) {
          await saveAssignment('contractor', newContractorId, paymentAmount ? parseFloat(paymentAmount) : undefined);
        }
      }, 500);
    }
  };

  const handleAmountBlur = async () => {
    const amount = paymentAmount ? parseFloat(paymentAmount) : undefined;
    if (assignmentType === 'contractor' && contractorId) {
      await saveAssignment('contractor', contractorId, amount);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') amountRef.current?.blur();
  };

  const handlePaymentChange = async (newStatus: string) => {
    await onPaymentStatusChange(job.id, newStatus);
  };

  // Build a cell map keyed by column key
  const cells: Record<SortKey, ReactNode> = {
    job_number: (
      <td key="job_number">
        <span className="font-mono text-sm" style={{ color: 'var(--christmas-green-light)' }}>
          {job.job_number}
        </span>
        {job.st_job_id && (
          <a
            href={`https://go.servicetitan.com/#/Job/Index/${job.st_job_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1.5 inline-flex align-middle"
            title="Open in ServiceTitan"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </td>
    ),
    customer_name: (
      <td key="customer_name">
        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {job.customer_name || '—'}
        </div>
        {job.job_address && (
          <div className="text-xs truncate" style={{ color: 'var(--text-muted)', maxWidth: '100%' }}>
            {job.job_address}
          </div>
        )}
      </td>
    ),
    business_unit: (
      <td key="business_unit">
        <span
          className="badge"
          style={{
            backgroundColor: job.trade === 'hvac' ? 'rgba(93, 138, 102, 0.15)' : 'rgba(184, 149, 107, 0.15)',
            color: job.trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--christmas-gold)',
          }}
        >
          {job.business_unit_name || job.trade.toUpperCase()}
        </span>
      </td>
    ),
    job_type_name: (
      <td key="job_type_name" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {job.job_type_name || '—'}
      </td>
    ),
    invoice_number: (
      <td key="invoice_number">
        {job.invoice_number && job.st_invoice_id ? (
          <a
            href={`https://go.servicetitan.com/#/Invoice/${job.st_invoice_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm inline-flex items-center gap-1 hover:underline"
            style={{ color: 'var(--christmas-green-light)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {job.invoice_number}
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
    ),
    invoice_date: (
      <td key="invoice_date" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {formatDate(job.invoice_date)}
      </td>
    ),
    date: (
      <td key="date" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {formatDate(job.completed_date || job.scheduled_date)}
      </td>
    ),
    job_status: (
      <td key="job_status">
        {job.job_status ? (
          <span
            className="badge"
            style={{
              backgroundColor:
                job.job_status === 'Completed' ? 'rgba(34, 197, 94, 0.15)' :
                job.job_status === 'Scheduled' ? 'rgba(59, 130, 246, 0.15)' :
                job.job_status === 'InProgress' ? 'rgba(234, 179, 8, 0.15)' :
                job.job_status === 'Canceled' ? 'rgba(239, 68, 68, 0.15)' :
                'rgba(107, 114, 128, 0.15)',
              color:
                job.job_status === 'Completed' ? 'var(--status-success)' :
                job.job_status === 'Scheduled' ? 'var(--status-info)' :
                job.job_status === 'InProgress' ? 'var(--status-warning)' :
                job.job_status === 'Canceled' ? 'var(--status-error)' :
                'var(--text-muted)',
            }}
          >
            {job.job_status}
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
    ),
    job_total: (
      <td key="job_total" className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {formatCurrency(job.job_total)}
      </td>
    ),
    invoice_exported: (
      <td key="invoice_exported">
        {job.invoice_exported_status ? (
          <span
            className="badge"
            style={{
              backgroundColor:
                job.invoice_exported_status === 'Exported' ? 'rgba(34, 197, 94, 0.15)' :
                job.invoice_exported_status === 'Posted' ? 'rgba(59, 130, 246, 0.15)' :
                'rgba(234, 179, 8, 0.15)',
              color:
                job.invoice_exported_status === 'Exported' ? 'var(--status-success)' :
                job.invoice_exported_status === 'Posted' ? 'var(--status-info)' :
                'var(--status-warning)',
            }}
          >
            {job.invoice_exported_status}
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
    ),
    assignment_type: (
      <td key="assignment_type" onClick={(e) => e.stopPropagation()}>
        {canManageAssignments ? (
          <select
            className="select text-xs py-1 px-2"
            style={{
              width: 'auto', minWidth: '110px',
              backgroundColor: assignmentType === 'in_house'
                ? 'rgba(59, 130, 246, 0.1)'
                : assignmentType === 'contractor' ? 'rgba(168, 85, 247, 0.1)' : undefined,
            }}
            value={assignmentType}
            onChange={(e) => handleAssignmentChange(e.target.value)}
          >
            <option value="unassigned">Unassigned</option>
            <option value="in_house">In-House</option>
            <option value="contractor">Contractor</option>
          </select>
        ) : (
          <AssignmentBadge type={job.assignment_type} />
        )}
      </td>
    ),
    contractor: (
      <td key="contractor" onClick={(e) => e.stopPropagation()}>
        {canManageAssignments && assignmentType === 'contractor' ? (
          <select
            className="select text-xs py-1 px-2"
            style={{ width: 'auto', minWidth: '120px' }}
            value={contractorId}
            onChange={(e) => handleContractorChange(e.target.value)}
          >
            <option value="">Select...</option>
            {contractors.filter(c => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {job.contractor?.name || '—'}
          </span>
        )}
      </td>
    ),
    labor_cost: (
      <td key="labor_cost" onClick={(e) => e.stopPropagation()}>
        {assignmentType === 'contractor' ? (
          canManageAssignments && job.payment_status !== 'paid' ? (
            <div className="flex items-center gap-1" style={{ width: '110px' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
              <input
                ref={amountRef}
                type="number"
                className="input text-xs py-1 px-2"
                style={{ width: '90px' }}
                placeholder="0.00"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
              />
            </div>
          ) : (
            <span className="text-sm font-medium" style={{ color: 'var(--christmas-gold)' }}>
              {job.payment_amount != null ? formatCurrency(job.payment_amount) : '—'}
            </span>
          )
        ) : assignmentType === 'in_house' ? (
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--christmas-green-light)' }}
            title={job.labor_hours != null && job.labor_cost != null
              ? `${job.labor_hours} total hrs — ${formatCurrency(job.labor_cost)}`
              : job.labor_hours != null
              ? `${job.labor_hours} hrs (no rate set)`
              : 'Missing labor hours'}
          >
            {job.labor_cost != null ? formatCurrency(job.labor_cost) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
            )}
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
    ),
    payment_status: (
      <td key="payment_status" onClick={(e) => e.stopPropagation()}>
        {canManagePayments && assignmentType === 'contractor' && job.payment_status !== 'paid' ? (
          job.payment_status === 'pending_approval' ? (
            <button
              className="btn btn-primary text-xs py-1 px-3"
              onClick={() => handlePaymentChange('ready_to_pay')}
              title="Approve this invoice"
            >
              Approve
            </button>
          ) : (
            <select
              className="select text-xs py-1 px-2"
              style={{ width: 'auto', minWidth: '120px' }}
              value={job.payment_status}
              onChange={(e) => handlePaymentChange(e.target.value)}
            >
              <option value="none">None</option>
              <option value="received">Received</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="ready_to_pay">Ready to Pay</option>
              <option value="paid">Paid</option>
            </select>
          )
        ) : (
          <div className="flex items-center gap-1.5">
            <PaymentStatusBadge status={job.payment_status} />
            {job.invoice_source && (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {job.invoice_source === 'manager_text' ? '(Text)' : '(Email)'}
              </span>
            )}
          </div>
        )}
      </td>
    ),
  };

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('select, input, button, a, textarea')) return;
    router.push(`/jobs/${job.id}`);
  };

  const isIgnored = job.is_ignored;

  return (
    <tr
      style={{
        opacity: saving ? 0.6 : isIgnored ? 0.45 : 1,
        transition: 'opacity 0.2s',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(93, 138, 102, 0.08)' : undefined,
      }}
      onClick={handleRowClick}
    >
      {showCheckbox && (
        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', padding: '0 4px' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ accentColor: 'var(--christmas-green)', cursor: 'pointer' }}
          />
        </td>
      )}
      {columnOrder.map(idx => {
        // columnOrder already filtered to visible columns
        return cells[COLUMNS[idx].key];
      })}
    </tr>
  );
}

// --- Sort indicator ---

function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <span className="inline-flex flex-col ml-1" style={{ fontSize: '8px', lineHeight: '8px', verticalAlign: 'middle' }}>
      <span style={{ color: direction === 'asc' ? 'var(--christmas-green-light)' : 'var(--text-muted)', opacity: direction === 'asc' ? 1 : 0.3 }}>▲</span>
      <span style={{ color: direction === 'desc' ? 'var(--christmas-green-light)' : 'var(--text-muted)', opacity: direction === 'desc' ? 1 : 0.3 }}>▼</span>
    </span>
  );
}

// --- Main table ---

export default function JobsTable({
  jobs,
  contractors,
  isLoading,
  canManageAssignments,
  canManagePayments,
  onAssign,
  onPaymentStatusChange,
  onBulkExclude,
  showIgnored,
  columnPickerContainer,
  sortKey: controlledSortKey,
  sortDir: controlledSortDir = 'asc',
  onSort,
}: JobsTableProps) {
  // Use controlled sort if provided, otherwise manage internally
  const [internalSortKey, setInternalSortKey] = useState<SortKey | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');
  const sortKey = onSort ? (controlledSortKey ?? null) : internalSortKey;
  const sortDir = onSort ? controlledSortDir : internalSortDir;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  const [colWidths, setColWidths] = useState<number[]>(() => loadFromStorage(STORAGE_KEY_WIDTHS, DEFAULT_WIDTHS));
  const [columnOrder, setColumnOrder] = useState<number[]>(() => loadFromStorage(STORAGE_KEY_ORDER, DEFAULT_ORDER));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadFromStorage(STORAGE_KEY_VISIBILITY, {} as Record<string, boolean>)
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // Close column picker on outside click
  useEffect(() => {
    if (!showColumnPicker) return;
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnPicker]);

  // Column visibility helpers
  const isColumnVisible = useCallback((key: SortKey) => columnVisibility[key] !== false, [columnVisibility]);

  const toggleColumnVisibility = useCallback((key: SortKey) => {
    setColumnVisibility(prev => {
      const next = { ...prev, [key]: prev[key] === false };
      try { localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Filtered column order (only visible columns)
  const visibleColumnOrder = useMemo(
    () => columnOrder.filter(idx => isColumnVisible(COLUMNS[idx].key)),
    [columnOrder, isColumnVisible]
  );

  // Persist column order and widths to localStorage
  const orderRef = useRef(columnOrder);
  const widthsRef = useRef(colWidths);
  orderRef.current = columnOrder;
  widthsRef.current = colWidths;

  const saveLayout = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(orderRef.current));
      localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(widthsRef.current));
    } catch { /* ignore */ }
  }, []);

  // Resize state
  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colIndex;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[colIndex];

    const onMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current == null) return;
      const diff = ev.clientX - resizeStartX.current;
      const newWidth = Math.max(COLUMNS[resizingCol.current].minWidth, resizeStartW.current + diff);
      setColWidths(prev => {
        const next = [...prev];
        next[resizingCol.current!] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveLayout();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths, saveLayout]);

  const handleSort = useCallback((key: SortKey) => {
    const newDir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSortKey(key);
      setInternalSortDir(newDir);
    }
  }, [sortKey, sortDir, onSort]);

  // Drag-to-reorder handlers
  const handleDragStart = useCallback((orderPos: number, e: React.DragEvent) => {
    setDragCol(orderPos);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent image so the default ghost is hidden
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((orderPos: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragCol !== null && dragCol !== orderPos) {
      setDragOverCol(orderPos);
    }
  }, [dragCol]);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback((orderPos: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragCol === null || dragCol === orderPos) {
      setDragCol(null);
      setDragOverCol(null);
      return;
    }

    setColumnOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragCol, 1);
      next.splice(orderPos, 0, moved);
      return next;
    });

    setColWidths(prev => {
      const next = [...prev];
      const [movedW] = next.splice(dragCol, 1);
      next.splice(orderPos, 0, movedW);
      return next;
    });

    setDragCol(null);
    setDragOverCol(null);

    // Persist after state updates
    requestAnimationFrame(() => saveLayout());
  }, [dragCol, saveLayout]);

  const handleDragEnd = useCallback(() => {
    setDragCol(null);
    setDragOverCol(null);
  }, []);

  const sortedJobs = useMemo(() => {
    // When sort is controlled externally (server-side), data arrives pre-sorted
    if (onSort) return jobs;
    if (!sortKey) return jobs;
    return [...jobs].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, sortKey, sortDir, onSort]);

  // Clear selection when jobs change (e.g. after bulk action or filter change)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [jobs]);

  const showCheckbox = !!onBulkExclude;
  const allOnPageSelected = sortedJobs.length > 0 && sortedJobs.every(j => selectedIds.has(j.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedJobs.map(j => j.id)));
    }
  }, [allOnPageSelected, sortedJobs]);

  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async (isIgnored: boolean) => {
    if (!onBulkExclude || selectedIds.size === 0) return;
    setBulkActing(true);
    try {
      await onBulkExclude(Array.from(selectedIds), isIgnored);
      setSelectedIds(new Set());
    } finally {
      setBulkActing(false);
    }
  }, [onBulkExclude, selectedIds]);

  const CHECKBOX_WIDTH = 40;
  const visibleWidths = visibleColumnOrder.map(origIdx => {
    const orderPos = columnOrder.indexOf(origIdx);
    return colWidths[orderPos] ?? COLUMNS[origIdx].defaultWidth;
  });
  const totalWidth = visibleWidths.reduce((s, w) => s + w, 0) + (showCheckbox ? CHECKBOX_WIDTH : 0);

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 rounded" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          No jobs found
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Try adjusting your filters or sync new data from ServiceTitan
        </div>
      </div>
    );
  }

  // Determine if selected jobs are all excluded or all not-excluded (for action button labels)
  const selectedJobs = sortedJobs.filter(j => selectedIds.has(j.id));
  const allSelectedExcluded = selectedJobs.length > 0 && selectedJobs.every(j => j.is_ignored);
  const allSelectedNotExcluded = selectedJobs.length > 0 && selectedJobs.every(j => !j.is_ignored);

  const columnPickerElement = (
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
            {COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={isColumnVisible(col.key)}
                  onChange={() => toggleColumnVisibility(col.key)}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--christmas-green)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {col.label}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 pt-2 flex gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              className="text-xs flex-1 text-center px-2 py-1 rounded hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                setColumnVisibility({});
                try { localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify({})); } catch { /* ignore */ }
              }}
            >
              Show All
            </button>
            <button
              className="text-xs flex-1 text-center px-2 py-1 rounded hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                setColumnOrder(DEFAULT_ORDER);
                setColWidths(DEFAULT_WIDTHS);
                setColumnVisibility({});
                try {
                  localStorage.removeItem(STORAGE_KEY_ORDER);
                  localStorage.removeItem(STORAGE_KEY_WIDTHS);
                  localStorage.removeItem(STORAGE_KEY_VISIBILITY);
                } catch { /* ignore */ }
              }}
            >
              Reset All
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Render column picker into external container via portal, or inline fallback */}
      {columnPickerContainer?.current
        ? createPortal(columnPickerElement, columnPickerContainer.current)
        : <div className="flex justify-end mb-2">{columnPickerElement}</div>
      }

      {/* Floating action bar */}
      {someSelected && onBulkExclude && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg mb-3"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--christmas-green)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          {(allSelectedNotExcluded || !showIgnored) && (
            <button
              className="btn btn-secondary text-xs py-1.5 px-3"
              disabled={bulkActing}
              onClick={() => handleBulkAction(true)}
              style={{ opacity: bulkActing ? 0.6 : 1 }}
            >
              {bulkActing ? 'Excluding...' : 'Exclude'}
            </button>
          )}
          {(allSelectedExcluded || showIgnored) && !allSelectedNotExcluded && (
            <button
              className="btn btn-primary text-xs py-1.5 px-3"
              disabled={bulkActing}
              onClick={() => handleBulkAction(false)}
              style={{ opacity: bulkActing ? 0.6 : 1 }}
            >
              {bulkActing ? 'Restoring...' : 'Restore'}
            </button>
          )}
          <button
            className="text-xs px-2 py-1"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setSelectedIds(new Set())}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="table-wrapper">
          <table className="ap-table" style={{ tableLayout: 'fixed', width: `${totalWidth}px`, minWidth: '100%' }}>
            <colgroup>
              {showCheckbox && <col style={{ width: `${CHECKBOX_WIDTH}px` }} />}
              {visibleColumnOrder.map((origIdx, i) => (
                <col key={origIdx} style={{ width: `${visibleWidths[i]}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {showCheckbox && (
                  <th style={{ width: `${CHECKBOX_WIDTH}px`, padding: '0 4px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allOnPageSelected; }}
                      onChange={toggleSelectAll}
                      style={{ accentColor: 'var(--christmas-green)', cursor: 'pointer' }}
                      title="Select all on page"
                    />
                  </th>
                )}
                {visibleColumnOrder.map((origIdx) => {
                  const col = COLUMNS[origIdx];
                  const orderPos = columnOrder.indexOf(origIdx);
                  const isDragging = dragCol === orderPos;
                  const isDragOver = dragOverCol === orderPos;
                  return (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={(e) => handleDragStart(orderPos, e)}
                      onDragOver={(e) => handleDragOver(orderPos, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(orderPos, e)}
                      onDragEnd={handleDragEnd}
                      style={{
                        position: 'relative',
                        cursor: 'grab',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        opacity: isDragging ? 0.4 : 1,
                        borderLeft: isDragOver ? '2px solid var(--christmas-green-light)' : '2px solid transparent',
                        transition: 'opacity 0.15s, border-color 0.15s',
                      }}
                      onClick={() => handleSort(col.key)}
                    >
                      {/* Drag grip icon */}
                      <span style={{ color: 'var(--text-muted)', marginRight: '4px', fontSize: '10px', opacity: 0.5 }}>⠿</span>
                      <span>{col.label}</span>
                      <SortIndicator direction={sortKey === col.key ? sortDir : null} />
                      {/* Resize handle */}
                      <span
                        onMouseDown={(e) => {
                          onResizeStart(orderPos, e);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => e.stopPropagation()}
                        draggable={false}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          cursor: 'col-resize',
                          zIndex: 1,
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.background = 'var(--christmas-green)';
                          (e.target as HTMLElement).style.opacity = '0.4';
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.background = '';
                          (e.target as HTMLElement).style.opacity = '';
                        }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedJobs.map((job) => (
                <InlineAssignmentRow
                  key={job.id}
                  job={job}
                  contractors={contractors}
                  canManageAssignments={canManageAssignments}
                  canManagePayments={canManagePayments}
                  onAssign={onAssign}
                  onPaymentStatusChange={onPaymentStatusChange}
                  isSelected={selectedIds.has(job.id)}
                  onToggleSelect={() => toggleSelect(job.id)}
                  showCheckbox={showCheckbox}
                  columnOrder={visibleColumnOrder}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
