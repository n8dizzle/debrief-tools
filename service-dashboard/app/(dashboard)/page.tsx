'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker, type DateRange } from '@/components/DateRangePicker';
import LeaderboardTable from '@/components/LeaderboardTable';
import type { LeaderboardEntry } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/sd-utils';

function getMonthToDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(now),
  };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function SummaryCard({ label, value, icon }: SummaryCardProps) {
  return (
    <div className="card flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>(getMonthToDateRange);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totals, setTotals] = useState({ gross_sales: 0, tgls: 0, options_per_opportunity: 0, reviews: 0, memberships_sold: 0, attendance_points: 0 });
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setTotals(data.totals || { gross_sales: 0, tgls: 0, options_per_opportunity: 0, reviews: 0, memberships_sold: 0, attendance_points: 0 });
        setWeights(data.weights || {});
        setLastSyncAt(data.lastSyncAt || null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Service Leaderboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {formatDateLabel(dateRange.start)} &ndash; {formatDateLabel(dateRange.end)}
            {lastSyncAt && (
              <span style={{ color: 'var(--text-muted)' }}>
                {' '}&middot; Last sync: {new Date(lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <SummaryCard
          label="Total Sales"
          value={formatCurrency(totals.gross_sales)}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <SummaryCard
          label="Leads Set"
          value={totals.tgls.toString()}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <SummaryCard
          label="Avg Opts/Opp"
          value={totals.options_per_opportunity.toFixed(2)}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        />
        <SummaryCard
          label="Total Reviews"
          value={totals.reviews.toString()}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <SummaryCard
          label="Memberships Sold"
          value={totals.memberships_sold.toString()}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <SummaryCard
          label="Attendance Pts"
          value={Math.max(0, totals.attendance_points).toString()}
          icon={
            <svg className="w-6 h-6" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Loading leaderboard...</p>
        </div>
      ) : (
        <LeaderboardTable data={leaderboard} weights={weights} startDate={dateRange.start} endDate={dateRange.end} />
      )}
    </div>
  );
}
