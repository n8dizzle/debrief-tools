'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APInstallJob, APContractor } from '@/lib/supabase';
import { formatTimestamp } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { DateRangePicker, DateRange, DateRangePreset } from '@/components/DateRangePicker';
import JobsTable from '@/components/JobsTable';

const FILTER_KEY = 'ap-jobs-filters';

function getSavedFilters(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(FILTER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export default function JobsPage() {
  const { canSyncData, canManageAssignments, canManagePayments } = useAPPermissions();
  const [jobs, setJobs] = useState<APInstallJob[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [businessUnitOptions, setBusinessUnitOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Initialize filters from sessionStorage (persists across navigation)
  const saved = useRef(getSavedFilters());
  const [dateRange, setDateRange] = useState<DateRange>({
    start: saved.current?.start || '',
    end: saved.current?.end || '',
  });
  const [datePreset, setDatePreset] = useState<DateRangePreset | undefined>(saved.current?.datePreset);
  const [selectedBUs, setSelectedBUs] = useState<string[]>(saved.current?.bu || []);
  const [buDropdownOpen, setBuDropdownOpen] = useState(false);
  const buDropdownRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const [trade, setTrade] = useState(saved.current?.trade || '');
  const [assignment, setAssignment] = useState(saved.current?.assignment || '');
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>(saved.current?.payment || []);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  const [jobStatus, setJobStatus] = useState(saved.current?.jobStatus || '');
  const [contractorFilter, setContractorFilter] = useState(saved.current?.contractor || '');
  const [search, setSearch] = useState(saved.current?.q || '');
  const [minTotal, setMinTotal] = useState(saved.current?.minTotal || '');
  const [maxTotal, setMaxTotal] = useState(saved.current?.maxTotal || '');
  const [showIgnored, setShowIgnored] = useState(saved.current?.excluded || false);

  // Persist filters to sessionStorage whenever they change (skip first render to avoid overwriting)
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const filters = {
      start: dateRange.start, end: dateRange.end, datePreset,
      bu: selectedBUs, trade, assignment,
      payment: selectedPaymentStatuses, jobStatus, contractor: contractorFilter,
      q: search, minTotal, maxTotal, excluded: showIgnored,
    };
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch {}
  }, [dateRange, datePreset, selectedBUs, trade, assignment, selectedPaymentStatuses, jobStatus, contractorFilter, search, minTotal, maxTotal, showIgnored]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('start', dateRange.start);
      if (dateRange.end) params.set('end', dateRange.end);
      if (selectedBUs.length > 0) params.set('businessUnits', selectedBUs.join(','));
      if (trade) params.set('trade', trade);
      if (assignment) params.set('assignment', assignment);
      if (selectedPaymentStatuses.length > 0) params.set('paymentStatus', selectedPaymentStatuses.join(','));
      if (jobStatus) params.set('jobStatus', jobStatus);
      if (contractorFilter) params.set('contractorId', contractorFilter);
      if (search) params.set('search', search);
      if (minTotal) params.set('minTotal', minTotal);
      if (maxTotal) params.set('maxTotal', maxTotal);
      if (showIgnored) params.set('showIgnored', 'true');
      if (sortKey) {
        params.set('sort', sortKey);
        params.set('sortDir', sortDir);
      }
      params.set('limit', '100');
      params.set('offset', String(page * 100));

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedBUs, trade, assignment, selectedPaymentStatuses, jobStatus, contractorFilter, search, minTotal, maxTotal, showIgnored, page, sortKey, sortDir]);

  const loadContractors = useCallback(async () => {
    try {
      const res = await fetch('/api/contractors');
      if (res.ok) {
        setContractors(await res.json());
      }
    } catch (err) {
      console.error('Failed to load contractors:', err);
    }
  }, []);

  // Load distinct business unit names
  const loadBusinessUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/business-units');
      if (res.ok) {
        const data = await res.json();
        setBusinessUnitOptions(data);
      }
    } catch (err) {
      console.error('Failed to load BU options:', err);
    }
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (buDropdownRef.current && !buDropdownRef.current.contains(e.target as Node)) {
        setBuDropdownOpen(false);
      }
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(e.target as Node)) {
        setPaymentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadLastSync = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setLastSync(data.last_sync);
      }
    } catch (err) {
      console.error('Failed to load sync info:', err);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await Promise.all([loadJobs(), loadLastSync()]);
      } else {
        console.error('Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadContractors();
    loadLastSync();
    loadBusinessUnits();
  }, [loadContractors, loadLastSync, loadBusinessUnits]);

  const handleAssign = async (jobId: string, data: {
    assignment_type: 'unassigned' | 'in_house' | 'contractor';
    contractor_id?: string;
    payment_amount?: number;
  }) => {
    const res = await fetch(`/api/jobs/${jobId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error('Failed to assign job');
    await loadJobs();
  };

  const handlePaymentStatusChange = async (jobId: string, newStatus: string) => {
    const res = await fetch(`/api/jobs/${jobId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus }),
    });

    if (res.ok) {
      await loadJobs();
    }
  };

  const handleBulkExclude = async (jobIds: string[], isIgnored: boolean) => {
    const res = await fetch('/api/jobs/bulk-exclude', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_ids: jobIds, is_ignored: isIgnored }),
    });

    if (res.ok) {
      await loadJobs();
    }
  };

  // Reset to first page when any filter or sort changes
  useEffect(() => {
    setPage(0);
  }, [dateRange, selectedBUs, trade, assignment, selectedPaymentStatuses, jobStatus, contractorFilter, search, minTotal, maxTotal, showIgnored, sortKey, sortDir]);

  const clearAllFilters = () => {
    setTrade('');
    setAssignment('');
    setSelectedPaymentStatuses([]);
    setJobStatus('');
    setContractorFilter('');
    setSelectedBUs([]);
    setMinTotal('');
    setMaxTotal('');
    setShowIgnored(false);
    setDateRange({ start: '', end: '' });
    setDatePreset(undefined);
    setSearch('');
  };

  const hasActiveFilters = trade || assignment || selectedPaymentStatuses.length > 0 || jobStatus || contractorFilter || selectedBUs.length > 0 || showIgnored || dateRange.start || dateRange.end || search || minTotal || maxTotal;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Payment Tracker
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total} total jobs
            {lastSync && <> &middot; Last sync: {formatTimestamp(lastSync)}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSyncData && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-primary"
              style={{ opacity: syncing ? 0.6 : 1 }}
            >
              {syncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Jobs
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Quick Chip Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Quick filters:</span>

        {/* Trade Chips */}
        <button
          onClick={() => setTrade(trade === 'hvac' ? '' : 'hvac')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: trade === 'hvac' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
            color: trade === 'hvac' ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
            border: trade === 'hvac' ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
          }}
        >
          HVAC
        </button>
        <button
          onClick={() => setTrade(trade === 'plumbing' ? '' : 'plumbing')}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: trade === 'plumbing' ? 'rgba(184, 149, 107, 0.2)' : 'var(--bg-secondary)',
            color: trade === 'plumbing' ? 'var(--christmas-gold)' : 'var(--text-secondary)',
            border: trade === 'plumbing' ? '1px solid var(--christmas-gold)' : '1px solid var(--border-subtle)',
          }}
        >
          Plumbing
        </button>

        <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>

        {/* Assignment Chips */}
        {[
          { value: 'unassigned', label: 'Unassigned', color: 'var(--text-muted)' },
          { value: 'in_house', label: 'In-House', color: '#60a5fa' },
          { value: 'contractor', label: 'Contractor', color: '#a78bfa' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setAssignment(assignment === opt.value ? '' : opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: assignment === opt.value ? `${opt.color}20` : 'var(--bg-secondary)',
              color: assignment === opt.value ? opt.color : 'var(--text-secondary)',
              border: assignment === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}

        <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>

        {/* Job Status Chips */}
        {[
          { value: 'Completed', label: 'Completed', color: '#4ade80' },
          { value: 'Scheduled', label: 'Scheduled', color: '#60a5fa' },
          { value: 'InProgress', label: 'In Progress', color: '#fcd34d' },
          { value: 'Canceled', label: 'Canceled', color: '#f87171' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setJobStatus(jobStatus === opt.value ? '' : opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: jobStatus === opt.value ? `${opt.color}20` : 'var(--bg-secondary)',
              color: jobStatus === opt.value ? opt.color : 'var(--text-secondary)',
              border: jobStatus === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}

        {/* Show Excluded toggle */}
        <span className="mx-1" style={{ color: 'var(--border-subtle)' }}>|</span>
        <button
          onClick={() => setShowIgnored(!showIgnored)}
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            backgroundColor: showIgnored ? 'rgba(251, 146, 60, 0.2)' : 'var(--bg-secondary)',
            color: showIgnored ? '#fb923c' : 'var(--text-secondary)',
            border: showIgnored ? '1px solid #fb923c' : '1px solid var(--border-subtle)',
          }}
        >
          Show Excluded
        </button>

        {/* Clear All */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all ml-1"
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

        {/* Column picker renders here via portal */}
        <div ref={columnPickerRef} />
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(160px, 1fr) repeat(3, minmax(120px, 1fr)) auto auto' }}>
          <div>
            <input
              type="text"
              className="input"
              placeholder="Search job # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Multi-select Business Unit dropdown */}
          <div className="relative" ref={buDropdownRef}>
            <button
              type="button"
              className="select text-left flex items-center justify-between"
              onClick={() => setBuDropdownOpen(prev => !prev)}
            >
              <span className="truncate">
                {selectedBUs.length === 0
                  ? 'All Business Units'
                  : selectedBUs.length === 1
                    ? selectedBUs[0]
                    : `${selectedBUs.length} selected`}
              </span>
              <svg className="w-4 h-4 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {buDropdownOpen && (
              <div
                className="absolute z-50 mt-1 w-full rounded-lg shadow-lg border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
              >
                {selectedBUs.length > 0 && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:opacity-80"
                    style={{ color: 'var(--christmas-green-light)', borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => setSelectedBUs([])}
                  >
                    Clear all
                  </button>
                )}
                <div className="max-h-60 overflow-y-auto">
                  {businessUnitOptions.map((bu) => {
                    const checked = selectedBUs.includes(bu);
                    return (
                      <label
                        key={bu}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm"
                        style={{
                          color: 'var(--text-primary)',
                          background: checked ? 'var(--bg-card-hover)' : undefined,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = checked ? 'var(--bg-card-hover)' : '')}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedBUs(prev =>
                              checked ? prev.filter(b => b !== bu) : [...prev, bu]
                            );
                          }}
                          className="rounded"
                          style={{ accentColor: 'var(--christmas-green)' }}
                        />
                        {bu}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <select
            className="select"
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
          >
            <option value="">All Contractors</option>
            {contractors.filter(c => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Payment Status multi-select dropdown */}
          <div className="relative" ref={paymentDropdownRef}>
            <button
              type="button"
              className="select text-left flex items-center justify-between"
              onClick={() => setPaymentDropdownOpen(prev => !prev)}
            >
              <span className="truncate">
                {selectedPaymentStatuses.length === 0
                  ? 'All Statuses'
                  : selectedPaymentStatuses.length === 1
                    ? { none: 'No Payment', requested: 'Requested', approved: 'Approved', paid: 'Paid' }[selectedPaymentStatuses[0]] || selectedPaymentStatuses[0]
                    : `${selectedPaymentStatuses.length} selected`}
              </span>
              <svg className="w-4 h-4 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {paymentDropdownOpen && (
              <div
                className="absolute z-50 mt-1 w-full rounded-lg shadow-lg border overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
              >
                {selectedPaymentStatuses.length > 0 && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs font-medium hover:opacity-80"
                    style={{ color: 'var(--christmas-green-light)', borderBottom: '1px solid var(--border-subtle)' }}
                    onClick={() => setSelectedPaymentStatuses([])}
                  >
                    Clear all
                  </button>
                )}
                <div>
                  {[
                    { value: 'none', label: 'No Payment' },
                    { value: 'received', label: 'Received' },
                    { value: 'pending_approval', label: 'Pending Approval' },
                    { value: 'ready_to_pay', label: 'Ready to Pay' },
                    { value: 'paid', label: 'Paid' },
                  ].map((opt) => {
                    const checked = selectedPaymentStatuses.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm"
                        style={{
                          color: 'var(--text-primary)',
                          background: checked ? 'var(--bg-card-hover)' : undefined,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = checked ? 'var(--bg-card-hover)' : '')}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedPaymentStatuses(prev =>
                              checked ? prev.filter(s => s !== opt.value) : [...prev, opt.value]
                            );
                          }}
                          className="rounded"
                          style={{ accentColor: 'var(--christmas-green)' }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Job Total Range — inline min/max */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="input text-sm"
              style={{ width: '5.5rem' }}
              placeholder="Min"
              min="0"
              step="1"
              value={minTotal}
              onChange={(e) => setMinTotal(e.target.value)}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
            <input
              type="number"
              className="input text-sm"
              style={{ width: '5.5rem' }}
              placeholder="Max"
              min="0"
              step="1"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
            />
          </div>

          <DateRangePicker
            value={dateRange}
            onChange={(range, preset) => { setDateRange(range); setDatePreset(preset); }}
            defaultPreset={datePreset}
          />
        </div>
      </div>

      <JobsTable
        jobs={jobs}
        contractors={contractors}
        isLoading={loading}
        canManageAssignments={canManageAssignments}
        canManagePayments={canManagePayments}
        onAssign={handleAssign}
        onPaymentStatusChange={handlePaymentStatusChange}
        onBulkExclude={handleBulkExclude}
        showIgnored={showIgnored}
        columnPickerContainer={columnPickerRef}
        sortKey={sortKey as any}
        sortDir={sortDir}
        onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
      />

      {/* Pagination */}
      {total > 100 && (
        <div
          className="flex items-center justify-between mt-4 px-4 py-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {page * 100 + 1}–{Math.min((page + 1) * 100, total)} of {total} jobs
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="btn btn-secondary text-sm py-1.5 px-3"
              style={{ opacity: page === 0 ? 0.4 : 1 }}
            >
              Previous
            </button>
            <span className="text-sm px-2 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              Page
              <input
                type="number"
                min={1}
                max={Math.ceil(total / 100)}
                value={page + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val >= 1 && val <= Math.ceil(total / 100)) {
                    setPage(val - 1);
                  }
                }}
                className="input text-sm text-center"
                style={{ width: '3.5rem', padding: '2px 4px' }}
              />
              of {Math.ceil(total / 100)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * 100 >= total}
              className="btn btn-secondary text-sm py-1.5 px-3"
              style={{ opacity: (page + 1) * 100 >= total ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
