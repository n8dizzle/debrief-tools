'use client';

import { useState, useEffect, useCallback } from 'react';
import { APInstallJob, APContractor } from '@/lib/supabase';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import JobsTable from '@/components/JobsTable';

export default function JobsPage() {
  const { canManageAssignments, canManagePayments } = useAPPermissions();
  const [jobs, setJobs] = useState<APInstallJob[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [trade, setTrade] = useState('');
  const [assignment, setAssignment] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [contractorFilter, setContractorFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (trade) params.set('trade', trade);
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
  }, [trade, assignment, paymentStatus, contractorFilter, search]);

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

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Install Jobs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {total} total jobs
        </p>
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

          <select
            className="select"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
          >
            <option value="">All Trades</option>
            <option value="hvac">HVAC</option>
            <option value="plumbing">Plumbing</option>
          </select>

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
