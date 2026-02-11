'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APInstallJob, APContractor } from '@/lib/supabase';
import { formatTimestamp } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import JobsTable from '@/components/JobsTable';

export default function JobsPage() {
  const { canSyncData, canManageAssignments, canManagePayments } = useAPPermissions();
  const [jobs, setJobs] = useState<APInstallJob[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [businessUnitOptions, setBusinessUnitOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [selectedBUs, setSelectedBUs] = useState<string[]>([]);
  const [buDropdownOpen, setBuDropdownOpen] = useState(false);
  const buDropdownRef = useRef<HTMLDivElement>(null);
  const [assignment, setAssignment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [contractorFilter, setContractorFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBUs.length > 0) params.set('businessUnits', selectedBUs.join(','));
      if (assignment) params.set('assignment', assignment);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (contractorFilter) params.set('contractorId', contractorFilter);
      if (search) params.set('search', search);
      params.set('limit', '100');

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
  }, [selectedBUs, assignment, paymentStatus, contractorFilter, search]);

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

  // Close BU dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (buDropdownRef.current && !buDropdownRef.current.contains(e.target as Node)) {
        setBuDropdownOpen(false);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Install Jobs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total} total jobs
            {lastSync && <> &middot; Last sync: {formatTimestamp(lastSync)}</>}
          </p>
        </div>
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

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="col-span-2 lg:col-span-1">
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
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
          >
            <option value="">All Assignments</option>
            <option value="unassigned">Unassigned</option>
            <option value="in_house">In-House</option>
            <option value="contractor">Contractor</option>
          </select>

          <select
            className="select"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <option value="">All Payment Status</option>
            <option value="none">None</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>

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
      />
    </div>
  );
}
