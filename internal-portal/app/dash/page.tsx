'use client';

import { useState, useEffect } from 'react';
import SummaryCard from '@/components/dash/SummaryCard';
import PacingSection from '@/components/dash/PacingSection';

interface PacingData {
  todayRevenue: number;
  dailyTarget: number;
  wtdRevenue: number;
  weeklyTarget: number;
  mtdRevenue: number;
  monthlyTarget: number;
  pacingPercent: number;
  businessDaysRemaining: number;
  businessDaysElapsed: number;
  businessDaysInMonth: number;
}

interface DashboardData {
  date: string;
  pacing?: PacingData;
  departments?: Array<{
    name: string;
    kpis: Array<{
      slug: string;
      actual: number | null;
    }>;
  }>;
}

// Placeholder department data - TODO: Connect to real API
const mockDepartments = [
  { name: 'HVAC Service', today: 0, mtd: 0, target: 0, pacing: 0 },
  { name: 'HVAC Install', today: 0, mtd: 0, target: 0, pacing: 0 },
  { name: 'Plumbing', today: 0, mtd: 0, target: 0, pacing: 0 },
  { name: 'Call Center', today: 0, mtd: 0, target: 0, pacing: 0 },
  { name: 'Marketing', today: 0, mtd: 0, target: 0, pacing: 0 },
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function getStatusColor(pacing: number): string {
  if (pacing >= 100) return 'var(--christmas-green)';
  if (pacing >= 90) return '#3B82F6';
  if (pacing >= 75) return 'var(--christmas-gold)';
  return '#EF4444';
}

function StatusDot({ pacing }: { pacing: number }) {
  const color = getStatusColor(pacing);
  return (
    <div
      className="w-3 h-3 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export default function DashboardPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setCurrentDate(now.toLocaleDateString('en-US', options));

    // Fetch real data from API
    async function fetchData() {
      try {
        const res = await fetch('/api/huddle');
        if (res.ok) {
          const data = await res.json();
          setDashData(data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Use real data from API, with fallback defaults
  const pacing = dashData?.pacing;
  const todayRevenue = pacing?.todayRevenue || 0;
  const dailyTarget = pacing?.dailyTarget || 36368;
  const weekRevenue = pacing?.wtdRevenue || 0;
  const weeklyTarget = pacing?.weeklyTarget || 181840;
  const mtdRevenue = pacing?.mtdRevenue || 0;
  const monthlyTarget = pacing?.monthlyTarget || 800096;
  const monthlyProgress = pacing?.pacingPercent || 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Christmas Air
          </h1>
          <p className="text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>
            Daily Huddle Dashboard
          </p>
        </div>

        {/* Date Display */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="var(--text-secondary)"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
            {currentDate}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          icon="dollar"
          label="Today's Revenue"
          value={loading ? '...' : formatCurrency(todayRevenue)}
          subValue={`of ${formatCurrency(dailyTarget)}`}
          trend={todayRevenue > dailyTarget ? { direction: 'up', value: `+${Math.round(((todayRevenue / dailyTarget) - 1) * 100)}%` } : undefined}
          accentColor="green"
        />
        <SummaryCard
          icon="percent"
          label="Monthly Progress"
          value={loading ? '...' : `${monthlyProgress}%`}
          subValue={`of ${formatCurrency(monthlyTarget)}`}
          accentColor="gold"
        />
        <SummaryCard
          icon="trend"
          label="This Week"
          value={loading ? '...' : formatCurrency(weekRevenue)}
          subValue={`of ${formatCurrency(weeklyTarget)}`}
          trend={weekRevenue > weeklyTarget * 0.5 ? { direction: 'up', value: `${Math.round((weekRevenue / weeklyTarget) * 100)}%` } : undefined}
          accentColor="blue"
        />
      </div>

      {/* Goal Pacing Section */}
      <div className="mb-8">
        <PacingSection data={{
          today: { current: todayRevenue, target: dailyTarget },
          week: { current: weekRevenue, target: weeklyTarget },
          month: { current: mtdRevenue, target: monthlyTarget },
          year: { current: mtdRevenue, target: 15100000 }, // Annual target
        }} />
      </div>

      {/* Department Summary */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Section Header */}
        <div
          className="flex items-center gap-3 p-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(184, 149, 107, 0.2)' }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="var(--christmas-gold)"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Department Summary
          </h3>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card)' }}>
                <th
                  className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Department
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Today
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  MTD
                </th>
                <th
                  className="text-right text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Pacing
                </th>
                <th
                  className="text-center text-xs font-semibold uppercase tracking-wider px-5 py-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {mockDepartments.map((dept, index) => (
                <tr
                  key={dept.name}
                  className="transition-colors hover:bg-opacity-50"
                  style={{
                    borderBottom:
                      index < mockDepartments.length - 1
                        ? '1px solid var(--border-subtle)'
                        : 'none',
                  }}
                >
                  <td className="px-5 py-4">
                    <span
                      className="font-medium"
                      style={{ color: 'var(--christmas-cream)' }}
                    >
                      {dept.name}
                    </span>
                  </td>
                  <td
                    className="text-right px-5 py-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {dept.today >= 1000
                      ? formatCurrency(dept.today)
                      : dept.today.toLocaleString()}
                  </td>
                  <td
                    className="text-right px-5 py-4"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatCurrency(dept.mtd)}
                  </td>
                  <td
                    className="text-right px-5 py-4 font-semibold"
                    style={{ color: getStatusColor(dept.pacing) }}
                  >
                    {dept.pacing}%
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-center">
                      <StatusDot pacing={dept.pacing} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
