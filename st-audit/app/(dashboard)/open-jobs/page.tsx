'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import EmailModal from '@/components/EmailModal';

interface OpenJob {
  id: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName: string;
  jobTypeName: string;
  customerId: number;
  createdOn: string;
  hoursOpen: number;
  severity: 'warning' | 'critical';
}

interface Summary {
  total: number;
  warning: number;
  critical: number;
  byStatus: Record<string, number>;
  byBusinessUnit: Record<string, number>;
}

interface AuditData {
  jobs: OpenJob[];
  summary: Summary;
  fetchedAt: string;
}

function formatDuration(hours: number): string {
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours - days * 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort }: {
  label: string; colKey: string; sortKey: string; sortDir: 'asc' | 'desc'; onSort: (key: string) => void;
}) {
  return (
    <th onClick={() => onSort(colKey)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === colKey && (
          <span style={{ fontSize: '0.6rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );
}

export default function OpenJobsPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBU, setFilterBU] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [sortKey, setSortKey] = useState<string>('hoursOpen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    fetch('/api/audit/open-jobs')
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setError(result.error);
        } else {
          setData(result);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const sortedJobs = useMemo(() => {
    if (!data) return [];
    const filtered = data.jobs.filter(job => {
      if (filterStatus !== 'all' && job.jobStatus !== filterStatus) return false;
      if (filterBU !== 'all' && job.businessUnitName !== filterBU) return false;
      if (filterSeverity !== 'all' && job.severity !== filterSeverity) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortKey) {
        case 'severity': aVal = a.severity === 'critical' ? 1 : 0; bVal = b.severity === 'critical' ? 1 : 0; break;
        case 'jobNumber': aVal = a.jobNumber; bVal = b.jobNumber; break;
        case 'jobStatus': aVal = a.jobStatus; bVal = b.jobStatus; break;
        case 'businessUnitName': aVal = a.businessUnitName; bVal = b.businessUnitName; break;
        case 'jobTypeName': aVal = a.jobTypeName; bVal = b.jobTypeName; break;
        case 'createdOn': aVal = a.createdOn; bVal = b.createdOn; break;
        case 'hoursOpen': aVal = a.hoursOpen; bVal = b.hoursOpen; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, filterStatus, filterBU, filterSeverity, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'hoursOpen' || key === 'severity' ? 'desc' : 'asc');
    }
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedJobs = useMemo(
    () => data?.jobs.filter(j => selectedIds.has(j.id)) || [],
    [data, selectedIds]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Fetching open jobs from ServiceTitan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <p className="font-medium" style={{ color: '#f87171' }}>Error loading audit data</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const statuses = Object.keys(data.summary.byStatus);
  const businessUnits = Object.keys(data.summary.byBusinessUnit).sort();

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Open Jobs Audit
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Jobs in In Progress, Dispatched, or Hold status for over 24 hours
          </p>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowEmailModal(true)}
            className="btn btn-primary"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email {selectedIds.size} Job{selectedIds.size !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Total Flagged
          </p>
          <p className="text-3xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {data.summary.total}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Critical (&gt;72h)
          </p>
          <p className="text-3xl font-bold" style={{ color: '#f87171' }}>
            {data.summary.critical}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Warning (24-72h)
          </p>
          <p className="text-3xl font-bold" style={{ color: '#fcd34d' }}>
            {data.summary.warning}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
            Business Units
          </p>
          <p className="text-3xl font-bold" style={{ color: 'var(--christmas-green-light)' }}>
            {businessUnits.length}
          </p>
        </div>
      </div>

      {/* BU Quick Filters */}
      {data.summary.total > 0 && businessUnits.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Business Unit:</span>
          <button
            onClick={() => setFilterBU('all')}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor: filterBU === 'all' ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
              color: filterBU === 'all' ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
              border: filterBU === 'all' ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
            }}
          >
            All ({data.summary.total})
          </button>
          {businessUnits.map(bu => {
            const count = data.summary.byBusinessUnit[bu] || 0;
            const active = filterBU === bu;
            return (
              <button
                key={bu}
                onClick={() => setFilterBU(active ? 'all' : bu)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? 'rgba(93, 138, 102, 0.2)' : 'var(--bg-secondary)',
                  color: active ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
                  border: active ? '1px solid var(--christmas-green-light)' : '1px solid var(--border-subtle)',
                }}
              >
                {bu} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {data.summary.total > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="select"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical (&gt;72h)</option>
            <option value="warning">Warning (24-72h)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="all">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <span className="self-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {sortedJobs.length} of {data.summary.total}
          </span>
        </div>
      )}

      {/* Jobs Table */}
      {data.summary.total === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(34, 197, 94, 0.15)' }}
          >
            <svg className="w-8 h-8" fill="none" stroke="#4ade80" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium" style={{ color: 'var(--christmas-cream)' }}>
            All clear
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No open jobs older than 24 hours found.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={sortedJobs.length > 0 && selectedIds.size === sortedJobs.length}
                      onChange={() => {
                        if (selectedIds.size === sortedJobs.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(sortedJobs.map(j => j.id)));
                        }
                      }}
                      style={{ accentColor: 'var(--christmas-green)' }}
                    />
                  </th>
                  <SortHeader label="Severity" colKey="severity" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Job #" colKey="jobNumber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Status" colKey="jobStatus" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Business Unit" colKey="businessUnitName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Job Type" colKey="jobTypeName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Created" colKey="createdOn" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Time Open" colKey="hoursOpen" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map(job => (
                  <tr key={job.id} style={{ background: selectedIds.has(job.id) ? 'var(--bg-card-hover)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        style={{ accentColor: 'var(--christmas-green)' }}
                      />
                    </td>
                    <td>
                      <span className={`badge ${job.severity === 'critical' ? 'badge-error' : 'badge-warning'}`}>
                        {job.severity === 'critical' ? 'Critical' : 'Warning'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{job.jobNumber}</span>
                        <a
                          href={`https://go.servicetitan.com/#/Job/Index/${job.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors flex-shrink-0"
                          title="Open in ServiceTitan"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{job.jobStatus}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{job.businessUnitName}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{job.jobTypeName}</td>
                    <td className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(job.createdOn)}
                    </td>
                    <td>
                      <span
                        className="font-medium"
                        style={{ color: job.severity === 'critical' ? '#f87171' : '#fcd34d' }}
                      >
                        {formatDuration(job.hoursOpen)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        Data fetched live from ServiceTitan at {data.fetchedAt}
      </p>

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        jobs={selectedJobs}
      />
    </div>
  );
}
