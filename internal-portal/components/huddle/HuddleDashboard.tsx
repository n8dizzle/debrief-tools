'use client';

import { useState, useEffect, useCallback } from 'react';
import { HuddleDashboardResponse, HuddleDepartmentWithKPIs } from '@/lib/supabase';
import { getTodayDateString, getYesterdayDateString, formatDateForDisplay } from '@/lib/huddle-utils';
import DepartmentSection from './DepartmentSection';

interface HuddleDashboardProps {
  initialData?: HuddleDashboardResponse;
  canEditNotes?: boolean;
  defaultDate?: string;
  showHeader?: boolean;
}

// Pacing card component for the visual header
function PacingCard({
  label,
  current,
  target,
  unit = '$',
  size = 'normal',
}: {
  label: string;
  current: number;
  target: number;
  unit?: string;
  size?: 'normal' | 'large';
}) {
  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
  const isAhead = percent >= 100;
  const isClose = percent >= 85;

  const formatValue = (val: number) => {
    if (unit === '$') {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    }
    return val.toFixed(0);
  };

  return (
    <div
      className={`rounded-xl p-4 ${size === 'large' ? 'col-span-2' : ''}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isAhead ? 'bg-green-500/20 text-green-400' : isClose ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {percent}%
        </span>
      </div>
      <div className={`font-bold ${size === 'large' ? 'text-3xl' : 'text-2xl'}`} style={{ color: 'var(--christmas-cream)' }}>
        {formatValue(current)}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
        of {formatValue(target)} target
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: isAhead ? '#4ade80' : isClose ? '#facc15' : '#f87171',
          }}
        />
      </div>
    </div>
  );
}

// Department group header
function DepartmentGroupHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-8 mb-4">
      <h2 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
        {title}
      </h2>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
    </div>
  );
}

export default function HuddleDashboard({
  initialData,
  canEditNotes = true,
  defaultDate,
  showHeader = true,
}: HuddleDashboardProps) {
  const [data, setData] = useState<HuddleDashboardResponse | null>(initialData || null);
  const [selectedDate, setSelectedDate] = useState(defaultDate || getYesterdayDateString());
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/huddle?date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Trigger data sync from ServiceTitan
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/huddle/snapshots/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      });
      if (!response.ok) throw new Error('Sync failed');
      setLastSync(new Date().toLocaleTimeString());
      await fetchData();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle note changes
  const handleNoteChange = (kpiId: string, note: string) => {
    if (!data) return;
    setData({
      ...data,
      departments: data.departments.map((dept) => ({
        ...dept,
        kpis: dept.kpis.map((kpi) =>
          kpi.id === kpiId ? { ...kpi, note } : kpi
        ),
      })),
    });
  };

  // Get pacing data from API response
  const getPacingData = () => {
    if (!data?.pacing) return null;
    return data.pacing;
  };

  // Group departments
  const getDepartmentGroups = () => {
    if (!data) return [];

    // Skip pacing department from the list (we show it visually at top)
    const depts = data.departments.filter(d => d.slug !== 'christmas-pacing');

    const christmasOverall = depts.find(d => d.slug === 'christmas-overall');
    const hvacOverall = depts.find(d => d.slug === 'hvac-overall');
    const hvacInstall = depts.find(d => d.slug === 'hvac-install');
    const hvacService = depts.find(d => d.slug === 'hvac-service');
    const hvacMaintenance = depts.find(d => d.slug === 'hvac-maintenance');
    const plumbing = depts.find(d => d.slug === 'plumbing');
    const callCenter = depts.find(d => d.slug === 'call-center');
    const marketing = depts.find(d => d.slug === 'marketing');
    const finance = depts.find(d => d.slug === 'finance');
    const warehouse = depts.find(d => d.slug === 'warehouse');

    return [
      { title: null, depts: christmasOverall ? [christmasOverall] : [] },
      { title: 'HVAC', depts: [hvacOverall, hvacInstall, hvacService, hvacMaintenance].filter(Boolean) as HuddleDepartmentWithKPIs[] },
      { title: 'Plumbing', depts: plumbing ? [plumbing] : [] },
      { title: 'Operations', depts: [callCenter, marketing, finance, warehouse].filter(Boolean) as HuddleDepartmentWithKPIs[] },
    ].filter(g => g.depts.length > 0);
  };

  // Date presets
  const datePresets = [
    { label: 'Yesterday', value: getYesterdayDateString() },
    { label: 'Today', value: getTodayDateString() },
  ];

  const pacingData = getPacingData();

  return (
    <div>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Date selector */}
          <div className="flex items-center gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSelectedDate(preset.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedDate === preset.value ? 'font-medium' : ''
                }`}
                style={{
                  backgroundColor:
                    selectedDate === preset.value
                      ? 'var(--christmas-green)'
                      : 'var(--bg-card)',
                  color:
                    selectedDate === preset.value
                      ? 'var(--christmas-cream)'
                      : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          </div>
        </div>

        {/* Sync button */}
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Synced: {lastSync}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--christmas-gold)',
              color: 'var(--bg-primary)',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? 'Syncing...' : 'Sync ServiceTitan'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 animate-spin"
              style={{ color: 'var(--christmas-green)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span style={{ color: 'var(--text-secondary)' }}>Loading...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
          }}
        >
          <p style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Visual Pacing Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
                Revenue Pacing
              </h2>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatDateForDisplay(selectedDate)}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <PacingCard
                label="Today"
                current={pacingData?.todayRevenue || 0}
                target={pacingData?.dailyTarget || 0}
              />
              <PacingCard
                label="This Week"
                current={pacingData?.wtdRevenue || 0}
                target={pacingData?.weeklyTarget || 0}
              />
              <PacingCard
                label="MTD"
                current={pacingData?.mtdRevenue || 0}
                target={pacingData?.monthlyTarget || 0}
              />
              <PacingCard
                label="Pacing"
                current={pacingData?.pacingPercent || 0}
                target={100}
                unit="%"
              />
            </div>
          </div>

          {/* Department Sections */}
          {getDepartmentGroups().map((group, idx) => (
            <div key={idx}>
              {group.title && <DepartmentGroupHeader title={group.title} />}
              {group.depts.map((dept) => (
                <DepartmentSection
                  key={dept.id}
                  department={dept}
                  date={selectedDate}
                  defaultExpanded={dept.slug === 'christmas-overall' || dept.slug.includes('hvac')}
                  canEditNotes={canEditNotes}
                  onNoteChange={handleNoteChange}
                />
              ))}
            </div>
          ))}
        </>
      )}

      {/* Last updated */}
      {data && (
        <p
          className="text-xs text-center mt-6"
          style={{ color: 'var(--text-muted)' }}
        >
          Data as of {new Date(data.last_updated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
