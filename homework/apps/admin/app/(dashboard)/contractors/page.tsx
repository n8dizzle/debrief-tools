'use client';

import { useEffect, useState, useCallback } from 'react';

type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';

interface Trade {
  id: string;
  department_id: string;
  department: { id: string; name: string; slug: string } | null;
}

interface Contractor {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  rating_overall: number | null;
  jobs_completed: number;
  member_since: string;
  trades: Trade[];
  service_area_count: number;
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-[var(--admin-surface)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--admin-surface)] rounded animate-pulse mt-2" />
        </div>
      </div>
      <div className="flex items-center gap-1 p-1 bg-[var(--admin-surface)] rounded-lg w-fit">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-[var(--admin-card)] rounded-md animate-pulse" />
        ))}
      </div>
      <div className="h-9 w-80 bg-[var(--admin-surface)] rounded animate-pulse" />
      <div className="admin-card p-0">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--admin-border)]">
            <div className="h-4 w-36 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-24 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-12 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-12 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--admin-surface)] rounded animate-pulse" />
            <div className="h-4 w-20 bg-[var(--admin-surface)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function tradeBadgeClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('lot')) return 'badge-green';
  if (lower.includes('exterior')) return 'badge-blue';
  if (lower.includes('interior')) return 'badge-purple';
  return 'badge-gray';
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchContractors = useCallback(async () => {
    try {
      const res = await fetch('/api/contractors');
      if (!res.ok) throw new Error('Failed to load contractors');
      const data = await res.json();
      setContractors(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  const handleStatusChange = async (contractorId: string, newStatus: VerificationStatus) => {
    setUpdating(contractorId);
    try {
      const res = await fetch('/api/contractors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contractorId, verification_status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      await fetchContractors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = contractors.filter((c) => {
    if (statusFilter !== 'all' && c.verification_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(c.business_name || '').toLowerCase().includes(q) &&
        !(c.owner_name || '').toLowerCase().includes(q) &&
        !(c.email || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const statusCounts = {
    all: contractors.length,
    pending: contractors.filter((c) => c.verification_status === 'pending').length,
    approved: contractors.filter((c) => c.verification_status === 'approved').length,
    suspended: contractors.filter((c) => c.verification_status === 'suspended').length,
    rejected: contractors.filter((c) => c.verification_status === 'rejected').length,
  };

  const statusBadge = (status: VerificationStatus) => {
    const map: Record<VerificationStatus, { className: string; label: string; dot: string }> = {
      approved: { className: 'badge-green', label: 'Approved', dot: 'status-dot-active' },
      pending: { className: 'badge-yellow', label: 'Pending', dot: 'status-dot-pending' },
      under_review: { className: 'badge-blue', label: 'Under Review', dot: 'status-dot-pending' },
      rejected: { className: 'badge-red', label: 'Rejected', dot: 'status-dot-rejected' },
      suspended: { className: 'badge-red', label: 'Suspended', dot: 'status-dot-rejected' },
    };
    const s = map[status];
    return (
      <span className={`badge ${s.className}`}>
        <span className={`status-dot ${s.dot} mr-1.5`} />
        {s.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <div className="admin-card text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4 text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Contractors</h1>
          <p className="text-sm text-[var(--admin-text-muted)] mt-1">
            {contractors.length} contractors &middot; Manage applications and accounts
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--admin-surface)] rounded-lg w-fit">
        {(['all', 'pending', 'approved', 'suspended', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-[var(--admin-card)] text-[var(--admin-text)] shadow-sm'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-1.5 text-xs opacity-60">
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by business name, owner, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input max-w-md"
        />
        <span className="text-sm text-[var(--admin-text-muted)] ml-auto">
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Phone</th>
                <th>Trades</th>
                <th>Areas</th>
                <th>Jobs</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Applied</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-[var(--admin-text-muted)]">
                    No contractors found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div>
                        <p className="font-medium text-[var(--admin-text)]">{c.business_name}</p>
                        {c.email && (
                          <p className="text-xs text-[var(--admin-text-muted)]">{c.email}</p>
                        )}
                      </div>
                    </td>
                    <td>{c.owner_name || <span className="text-[var(--admin-text-muted)]">-</span>}</td>
                    <td className="text-sm">{c.phone || <span className="text-[var(--admin-text-muted)]">-</span>}</td>
                    <td>
                      {c.trades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.trades.map((t) => (
                            <span key={t.id} className={`badge ${tradeBadgeClass(t.department?.name || '')}`}>
                              {t.department?.name || 'Unknown'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--admin-text-muted)]">-</span>
                      )}
                    </td>
                    <td>{c.service_area_count || <span className="text-[var(--admin-text-muted)]">-</span>}</td>
                    <td>{c.jobs_completed || <span className="text-[var(--admin-text-muted)]">-</span>}</td>
                    <td>
                      {c.rating_overall && c.rating_overall > 0 ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-sm">{c.rating_overall.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-[var(--admin-text-muted)]">-</span>
                      )}
                    </td>
                    <td>{statusBadge(c.verification_status)}</td>
                    <td className="text-xs whitespace-nowrap">{formatDate(c.member_since)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {c.verification_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(c.id, 'approved')}
                              disabled={updating === c.id}
                              className="text-xs text-green-400 hover:text-green-300 font-medium disabled:opacity-50"
                            >
                              {updating === c.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(c.id, 'rejected')}
                              disabled={updating === c.id}
                              className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {c.verification_status === 'approved' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'suspended')}
                            disabled={updating === c.id}
                            className="text-xs text-yellow-400 hover:text-yellow-300 font-medium disabled:opacity-50"
                          >
                            {updating === c.id ? '...' : 'Suspend'}
                          </button>
                        )}
                        {c.verification_status === 'suspended' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'approved')}
                            disabled={updating === c.id}
                            className="text-xs text-green-400 hover:text-green-300 font-medium disabled:opacity-50"
                          >
                            {updating === c.id ? '...' : 'Reinstate'}
                          </button>
                        )}
                        {c.verification_status === 'under_review' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(c.id, 'approved')}
                              disabled={updating === c.id}
                              className="text-xs text-green-400 hover:text-green-300 font-medium disabled:opacity-50"
                            >
                              {updating === c.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleStatusChange(c.id, 'rejected')}
                              disabled={updating === c.id}
                              className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
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
