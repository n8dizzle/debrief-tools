'use client';

import { useState, useEffect, useCallback } from 'react';
import { APDashboardStats, APInstallJob, APContractor } from '@/lib/supabase';
import { formatTimestamp } from '@/lib/ap-utils';
import { useAPPermissions } from '@/hooks/useAPPermissions';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import StatsCards from '@/components/StatsCards';
import JobsTable from '@/components/JobsTable';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

function getMonthToDateRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${day}` };
}

export default function DashboardPage() {
  const { canSyncData, canManageAssignments, canManagePayments } = useAPPermissions();
  const [stats, setStats] = useState<APDashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<APInstallJob[]>([]);
  const [contractors, setContractors] = useState<APContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getMonthToDateRange);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
      const [statsRes, jobsRes, contractorsRes] = await Promise.all([
        fetch(`/api/dashboard?${params}`),
        fetch('/api/jobs?limit=10'),
        fetch('/api/contractors'),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setRecentJobs(data.jobs || []);
      }
      if (contractorsRes.ok) {
        setContractors(await contractorsRes.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        await loadData();
      } else {
        console.error('Sync failed');
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

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
    await loadData();
  };

  const handlePaymentStatusChange = async (jobId: string, newStatus: string) => {
    const res = await fetch(`/api/jobs/${jobId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus }),
    });

    if (res.ok) {
      await loadData();
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Dashboard
          </h1>
          {stats?.last_sync && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last sync: {formatTimestamp(stats.last_sync)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
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
                Sync Now
              </>
            )}
          </button>
        )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8">
        <StatsCards stats={stats} isLoading={loading} />
      </div>

      {/* Monthly Contractor % Trend */}
      {stats && stats.monthly_trend.length > 0 && (
        <div className="card mb-8 p-4">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Monthly Contractor Cost
          </h2>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthly_trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="dollars"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const v = Number(value) || 0;
                    if (name === 'contractor_pct') return [`${v.toFixed(1)}%`, 'Contractor %'];
                    return [`$${v.toLocaleString()}`, name === 'job_total' ? 'Job Total' : 'Contractor Pay'];
                  }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: 4 }}
                />
                <Bar yAxisId="dollars" dataKey="job_total" fill="#346643" radius={[3, 3, 0, 0]} barSize={24} />
                <Bar yAxisId="dollars" dataKey="contractor_pay" fill="#B8956B" radius={[3, 3, 0, 0]} barSize={24} />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="contractor_pct"
                  stroke="#F5F0E1"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#F5F0E1', stroke: '#F5F0E1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Recent Jobs
          </h2>
          <a
            href="/jobs"
            className="text-sm font-medium"
            style={{ color: 'var(--christmas-green-light)' }}
          >
            View All
          </a>
        </div>
        <JobsTable
          jobs={recentJobs}
          contractors={contractors}
          isLoading={loading}
          canManageAssignments={canManageAssignments}
          canManagePayments={canManagePayments}
          onAssign={handleAssign}
          onPaymentStatusChange={handlePaymentStatusChange}
        />
      </div>
    </div>
  );
}
