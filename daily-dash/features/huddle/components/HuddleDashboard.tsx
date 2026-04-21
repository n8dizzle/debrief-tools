'use client';

import { useState, useEffect } from 'react';
import { HuddleDashboardResponse, HuddleDepartmentWithKPIs } from '@/lib/supabase';
import { getTodayDateString, getYesterdayDateString, formatDateForDisplay, getPriorHuddleRange, getRangeLabel } from '@/lib/huddle-utils';
import { useHuddleData } from '@/lib/hooks/useHuddleData';
import DepartmentSection from './DepartmentSection';

interface HuddleDashboardProps {
  initialData?: HuddleDashboardResponse;
  canEditNotes?: boolean;
  defaultDate?: string;
  showHeader?: boolean;
}

// Format currency for cards
function formatCardCurrency(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

// Pacing card - matches dashboard screenshot exactly
function PacingCard({
  label,
  revenue,
  sales,
  target,
  pacing,
}: {
  label: string;
  revenue: number;
  sales: number;
  target: number;
  pacing?: number;
}) {
  const pct = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const getColor = (p: number) => p >= 100 ? '#4ade80' : p >= 85 ? '#facc15' : '#f87171';
  const color = getColor(pct);
  const behindPace = pacing !== undefined && pct < pacing;

  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {target > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${color}15`, color }}>{pct}%</span>
        )}
      </div>
      {/* Revenue | Sales side by side with divider */}
      <div className="flex items-start gap-4 mb-3">
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {formatCardCurrency(revenue)}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Revenue</div>
        </div>
        <div className="self-stretch w-px my-0.5" style={{ backgroundColor: 'var(--border-subtle)' }} />
        <div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-gold)' }}>
            {formatCardCurrency(sales)}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Sales</div>
        </div>
      </div>
      {target > 0 && (
        <>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>of {formatCardCurrency(target)} target</div>
          <div className="relative h-1.5 rounded-full overflow-visible" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
            {pacing !== undefined && pacing > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3" style={{ left: `${Math.min(pacing, 100)}%`, backgroundColor: 'var(--christmas-cream)', opacity: 0.8 }} />
            )}
          </div>
          {pacing !== undefined && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs font-medium" style={{ color: behindPace ? '#f87171' : '#4ade80' }}>
                {behindPace ? '\u25BC' : '\u25B2'} {behindPace ? 'Behind' : 'Ahead'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pacing}% exp</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Review pacing card
function ReviewCard({
  reviewCount,
  monthlyGoal,
  avgRating,
}: {
  reviewCount: number;
  monthlyGoal: number;
  avgRating: number;
}) {
  const percent = monthlyGoal > 0 ? Math.round((reviewCount / monthlyGoal) * 100) : 0;
  const isAhead = percent >= 100;
  const isClose = percent >= 85;

  // Star display
  const fullStars = Math.floor(avgRating);
  const hasHalf = avgRating - fullStars >= 0.25;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Reviews MTD
        </span>
        {monthlyGoal > 0 && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isAhead ? 'bg-green-500/20 text-green-400' : isClose ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {percent}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
        {reviewCount}
      </div>
      {monthlyGoal > 0 && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          of {monthlyGoal} goal
        </div>
      )}
      {avgRating > 0 && (
        <div className="flex items-center gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className="w-3.5 h-3.5"
              fill={star <= fullStars ? '#facc15' : (star === fullStars + 1 && hasHalf ? '#facc15' : 'none')}
              stroke="#facc15"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              style={star === fullStars + 1 && hasHalf ? { clipPath: 'inset(0 50% 0 0)' } : undefined}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          ))}
          <span className="text-xs font-medium ml-1" style={{ color: 'var(--christmas-gold)' }}>
            {avgRating.toFixed(1)}
          </span>
        </div>
      )}
      {monthlyGoal > 0 && (
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: isAhead ? '#4ade80' : isClose ? '#facc15' : '#f87171',
            }}
          />
        </div>
      )}
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
  // Default huddle range: yesterday, or Fri-Sun on Mondays
  const defaultRange = getPriorHuddleRange();
  const [selectedDate, setSelectedDate] = useState(defaultDate || defaultRange.start);
  const [selectedEndDate, setSelectedEndDate] = useState(defaultDate || defaultRange.end);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Use SWR for cached data fetching - instant load on navigation
  const { data: apiData, error: fetchError, isLoading, isValidating, mutate } = useHuddleData(selectedDate, selectedEndDate);

  // Local state for optimistic updates (notes)
  const [localData, setLocalData] = useState<HuddleDashboardResponse | null>(initialData || null);

  // Sync local data with API data
  useEffect(() => {
    if (apiData) {
      setLocalData(apiData as unknown as HuddleDashboardResponse);
    }
  }, [apiData]);

  const data = localData;
  const error = fetchError ? 'Failed to load dashboard data' : null;

  // Trigger data sync from ServiceTitan for each day in the selected range
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Build list of dates to sync
      const dates: string[] = [];
      const start = new Date(selectedDate + 'T12:00:00');
      const end = new Date(selectedEndDate + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
      }

      for (const d of dates) {
        const response = await fetch('/api/huddle/snapshots/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: d }),
        });
        if (!response.ok) throw new Error(`Sync failed for ${d}`);
      }
      setLastSync(new Date().toLocaleTimeString());
      mutate();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle note changes (optimistic update on local state)
  const handleNoteChange = (kpiId: string, note: string) => {
    if (!localData) return;
    setLocalData({
      ...localData,
      departments: localData.departments.map((dept) => ({
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

  // Date presets. "Prior Huddle" = yesterday on Tue-Fri, Fri-Sun on Mon.
  const today = getTodayDateString();
  const priorRange = getPriorHuddleRange();
  const datePresets = [
    { label: priorRange.label, start: priorRange.start, end: priorRange.end },
    { label: 'Today', start: today, end: today },
  ];
  const selectRange = (start: string, end: string) => {
    setSelectedDate(start);
    setSelectedEndDate(end);
  };
  const isPresetActive = (p: { start: string; end: string }) =>
    selectedDate === p.start && selectedEndDate === p.end;

  const pacingData = getPacingData();
  // Dynamic label for the first pacing card based on the selected range
  const pacingCardLabel = getRangeLabel(selectedDate, selectedEndDate);

  return (
    <div>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Date selector */}
          <div className="flex items-center gap-2">
            {datePresets.map((preset) => {
              const active = isPresetActive(preset);
              return (
                <button
                  key={preset.label}
                  onClick={() => selectRange(preset.start, preset.end)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${active ? 'font-medium' : ''}`}
                  style={{
                    backgroundColor: active ? 'var(--christmas-green)' : 'var(--bg-card)',
                    color: active ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => selectRange(e.target.value, e.target.value)}
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
          {/* Background refresh indicator */}
          {isValidating && !isLoading && !isSyncing && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-card)' }}>
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span style={{ color: 'var(--text-muted)' }}>Refreshing</span>
            </div>
          )}
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
                {selectedDate === selectedEndDate
                  ? formatDateForDisplay(selectedDate)
                  : `${formatDateForDisplay(selectedDate)} → ${formatDateForDisplay(selectedEndDate)}`}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <PacingCard
                label={pacingCardLabel}
                revenue={pacingData?.todayRevenue || 0}
                sales={pacingData?.todaySales || 0}
                target={pacingData?.dailyTarget ? pacingData.dailyTarget * (data?.daysInRange || 1) : 0}
              />
              <PacingCard
                label="This Week"
                revenue={pacingData?.wtdRevenue || 0}
                sales={pacingData?.wtdSales || 0}
                target={pacingData?.weeklyTarget || 0}
              />
              <PacingCard
                label="MTD"
                revenue={pacingData?.mtdRevenue || 0}
                sales={pacingData?.mtdSales || 0}
                target={pacingData?.monthlyTarget || 0}
                pacing={pacingData?.businessDaysInMonth ? Math.round(((pacingData?.businessDaysElapsed || 0) / pacingData.businessDaysInMonth) * 100) : undefined}
              />
              <ReviewCard
                reviewCount={pacingData?.reviewsMtdCount || 0}
                monthlyGoal={pacingData?.reviewMonthlyGoal || 0}
                avgRating={pacingData?.reviewsMtdAvgRating || 0}
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
                  canEditNotes={canEditNotes && selectedDate === selectedEndDate}
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
