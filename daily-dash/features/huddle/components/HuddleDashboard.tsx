'use client';

import { useState, useEffect } from 'react';
import { HuddleDashboardResponse, HuddleDepartmentWithKPIs } from '@/lib/supabase';
import { getTodayDateString, getYesterdayDateString, formatDateForDisplay, getPriorHuddleRange, getRangeLabel } from '@/lib/huddle-utils';
import { useHuddleData } from '@/lib/hooks/useHuddleData';
import DepartmentSection from './DepartmentSection';
import NotesInput from './NotesInput';

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

// Pace gauge V6 - color banner + zoned arc + status word
function PaceGauge({
  label,
  needed,
  target,
  formatValue,
  suffix,
  noData,
  mtdActual,
  mtdGoal,
  daysElapsed,
  daysInMonth,
  tooltip,
}: {
  label: string;
  needed: number;
  target: number;
  formatValue?: (v: number) => string;
  suffix?: string;
  noData?: boolean;
  mtdActual?: number;
  mtdGoal?: number;
  daysElapsed?: number;
  daysInMonth?: number;
  tooltip?: string;
}) {
  const fmt = formatValue || formatCardCurrency;
  const sfx = suffix || '/day';

  // Projected % of goal based on current MTD rate
  const projectedPct = (mtdActual !== undefined && mtdGoal && daysElapsed && daysInMonth && daysElapsed > 0)
    ? Math.round(((mtdActual / daysElapsed) * daysInMonth / mtdGoal) * 100)
    : null;

  // Needle angle mapped to zone boundaries:
  // 0% projected = -90 (far left), 90% = 18 (red/gold boundary), 100% = 45 (gold/green boundary), 130%+ = 90 (far right)
  const pacingPct = projectedPct !== null ? projectedPct : (noData ? 0 : (target > 0 ? Math.round((1 / (needed / target)) * 100) : 0));
  const getNeedleAngle = () => {
    if (noData) return -90;
    if (pacingPct <= 0) return -90;
    if (pacingPct <= 90) return -90 + (pacingPct / 90) * 108; // 0% -> -90, 90% -> 18
    if (pacingPct <= 100) return 18 + ((pacingPct - 90) / 10) * 27; // 90% -> 18, 100% -> 45
    return Math.min(45 + ((pacingPct - 100) / 30) * 45, 90); // 100% -> 45, 130% -> 90
  };
  const needleAngle = getNeedleAngle();

  // Status thresholds: <90% = red/behind, 90-99% = gold/slightly behind, 100%+ = green
  const pacingRatio = projectedPct !== null ? projectedPct / 100 : (noData ? 0 : (target > 0 ? 1 / (needed / target) : 0));

  const getStatus = () => {
    if (noData) return { word: '--', bg: 'var(--bg-secondary)', arcColor: 'var(--text-muted)' };
    if (pacingRatio >= 1.0) return { word: 'ON TRACK', bg: 'var(--christmas-green)', arcColor: 'var(--christmas-green)' };
    if (pacingRatio >= 0.9) return { word: 'SLIGHTLY BEHIND', bg: 'var(--christmas-gold)', arcColor: 'var(--christmas-gold)' };
    return { word: 'BEHIND', bg: '#DC2626', arcColor: '#EF4444' };
  };
  const status = getStatus();
  const bannerTextColor = 'var(--bg-primary)';

  const cx = 110, cy = 95, r = 65;

  return (
    <div className="flex-1 min-w-0 rounded-xl overflow-hidden relative group" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      {/* Color banner */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: status.bg }}
      >
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: bannerTextColor }}>{status.word}</span>
        {projectedPct !== null && !noData && (
          <span className="text-sm font-bold" style={{ color: bannerTextColor }}>
            {projectedPct}% of goal
          </span>
        )}
      </div>

      {/* Label + Goal */}
      <div className="flex items-start justify-between px-4 pt-4 pb-1">
        <div className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--christmas-cream)' }}>{label}</div>
        {mtdGoal !== undefined && !noData && (
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Goal: <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>{mtdGoal >= 1000 ? formatCardCurrency(mtdGoal) : Math.round(mtdGoal)}</span>
            </div>
            {mtdActual !== undefined && (
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Actual: {mtdActual >= 1000 ? formatCardCurrency(mtdActual) : Math.round(mtdActual)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gauge */}
      <div className="flex justify-center">
        <svg width="220" height="130" viewBox="0 0 220 130">
          {/* 3 zones: Behind 60% (red), Slightly Behind 15% (gold), Ahead 25% (green) */}
          <path d={describeArc(cx, cy, r, -90, 18)} fill="none" stroke="#EF4444" strokeWidth="16" strokeLinecap="butt" />
          <path d={describeArc(cx, cy, r, 18, 45)} fill="none" stroke="#B8956B" strokeWidth="16" strokeLinecap="butt" />
          <path d={describeArc(cx, cy, r, 45, 90)} fill="none" stroke="#5D8A66" strokeWidth="16" strokeLinecap="butt" />
          {/* No active arc fill - zones stay visible, needle shows position */}
          {/* Goal tick at green zone start (45 degrees) - overlaps arc */}
          {(() => {
            const goalAngle = 45 * Math.PI / 180;
            const innerX = cx + (r - 10) * Math.sin(goalAngle);
            const innerY = cy - (r - 10) * Math.cos(goalAngle);
            const outerX = cx + (r + 12) * Math.sin(goalAngle);
            const outerY = cy - (r + 12) * Math.cos(goalAngle);
            const labelX = cx + (r + 16) * Math.sin(goalAngle);
            const labelY = cy - (r + 16) * Math.cos(goalAngle);
            return (
              <>
                <line x1={innerX} y1={innerY} x2={outerX} y2={outerY} stroke="var(--christmas-cream)" strokeWidth="2.5" opacity="0.9" />
                <text x={labelX + 2} y={labelY + 3} fontSize="10" fill="var(--christmas-cream)" textAnchor="start" opacity="0.9" fontWeight="700">GOAL</text>
              </>
            );
          })()}
          {/* Needle - color matches banner status */}
          {!noData && (
            <>
              <line
                x1={cx} y1={cy}
                x2={cx + (r + 4) * Math.sin(needleAngle * Math.PI / 180)}
                y2={cy - (r + 4) * Math.cos(needleAngle * Math.PI / 180)}
                stroke={status.arcColor} strokeWidth="3" strokeLinecap="round"
              />
              <circle cx={cx} cy={cy} r="5" fill="var(--bg-card)" stroke={status.arcColor} strokeWidth="2.5" />
            </>
          )}
          {/* Actual value centered under needle */}
          {mtdActual !== undefined && !noData && (
            <text x={cx} y={cy + 20} fontSize="12" fill="var(--christmas-cream)" textAnchor="middle" fontWeight="700">
              {mtdActual >= 1000 ? formatCardCurrency(mtdActual) : Math.round(mtdActual)}
            </text>
          )}
        </svg>
      </div>

      {/* Bottom stats - more padding, clear separation */}
      <div className="flex items-end justify-between px-5 pb-5 pt-1">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Need/day</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {noData ? '\u2014' : `${fmt(needed)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Was</div>
          <div className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>
            {noData ? `\u2014${sfx}` : `${fmt(target)}${sfx}`}
          </div>
        </div>
      </div>

      {/* Tooltip on hover */}
      {tooltip && (
        <div
          className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs text-left whitespace-pre-line max-w-[200px] hidden group-hover:block"
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

// Helper to describe an SVG arc path
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.sin(startAngle * Math.PI / 180),
    y: cy - r * Math.cos(startAngle * Math.PI / 180),
  };
  const end = {
    x: cx + r * Math.sin(endAngle * Math.PI / 180),
    y: cy - r * Math.cos(endAngle * Math.PI / 180),
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// Pacing card - matches dashboard screenshot exactly
function PacingCard({
  label,
  revenue,
  sales,
  target,
  pacing,
  completed,
  badge,
}: {
  label: string;
  revenue: number;
  sales: number;
  target: number;
  pacing?: number;
  completed?: boolean;
  badge?: string;
}) {
  const pct = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const getRatio = () => pacing !== undefined && pacing > 0 ? pct / pacing : pct / 100;
  const ratio = getRatio();

  // Completed: color by actual vs target. In-progress: color by actual vs expected pacing.
  const color = completed
    ? (pct >= 100 ? 'var(--christmas-green)' : pct >= 90 ? 'var(--christmas-gold)' : '#EF4444')
    : (ratio >= 1 ? 'var(--christmas-green)' : ratio >= 0.9 ? 'var(--christmas-gold)' : '#EF4444');

  // Completed periods get a verdict, in-progress get pacing copy
  const getStatusLabel = () => {
    if (completed) {
      if (pct >= 100) return '✓ Hit goal';
      if (pct >= 90) return '~ Nearly hit goal';
      return '✗ Missed goal';
    }
    if (ratio >= 1) return '▲ On track';
    if (ratio >= 0.9) return '▶ Slightly behind';
    return '▼ Behind pace';
  };
  const statusLabel = getStatusLabel();

  return (
    <div className="p-4 sm:p-5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {target > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>{pct}%</span>
        )}
      </div>
      {/* Revenue | Sales centered with divider */}
      <div className="flex items-center justify-center gap-0 mb-3">
        <div className="flex-1 text-center">
          <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {formatCardCurrency(revenue)}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Revenue</div>
        </div>
        <div className="w-px h-10 flex-shrink-0" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
        <div className="flex-1 text-center">
          <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--christmas-gold)' }}>
            {formatCardCurrency(sales)}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Sales</div>
        </div>
      </div>
      <div className="h-px w-full mb-2" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />
      {target > 0 && (
        <>
          <div className="text-xs mb-2 text-right" style={{ color: 'var(--text-muted)' }}>of {formatCardCurrency(target)} target</div>
          <div className="relative h-1.5 rounded-full overflow-visible" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
            {!completed && pacing !== undefined && pacing > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3" style={{ left: `${Math.min(pacing, 100)}%`, backgroundColor: 'var(--christmas-cream)', opacity: 0.8 }} />
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] whitespace-nowrap" style={{ color }}>
              {statusLabel}
            </span>
            {!completed && pacing !== undefined && (
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{pacing}% exp</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Review pacing card - same layout as revenue cards (count | rating)
function ReviewCard({
  reviewCount,
  monthlyGoal,
  avgRating,
  pacing,
}: {
  reviewCount: number;
  monthlyGoal: number;
  avgRating: number;
  pacing?: number;
}) {
  const percent = monthlyGoal > 0 ? Math.round((reviewCount / monthlyGoal) * 100) : 0;
  const getRatio = () => pacing !== undefined && pacing > 0 ? percent / pacing : percent / 100;
  const ratio = getRatio();
  const color = ratio >= 1 ? 'var(--christmas-green)' : ratio >= 0.9 ? 'var(--christmas-gold)' : '#EF4444';
  const pacingLabel = ratio >= 1 ? '▲ On track' : ratio >= 0.9 ? '▶ Slightly behind' : '▼ Behind pace';

  return (
    <div
      className="p-4 sm:p-5 rounded-xl"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Reviews MTD
        </span>
        {monthlyGoal > 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {percent}%
          </span>
        )}
      </div>
      {/* Count | Rating side by side with divider */}
      <div className="flex items-center justify-center gap-0 mb-3">
        <div className="flex-1 text-center">
          <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {reviewCount}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Reviews</div>
        </div>
        <div className="w-px h-10 flex-shrink-0" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.5 }} />
        <div className="flex-1 text-center">
          <div className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--christmas-gold)' }}>
            {avgRating > 0 ? avgRating.toFixed(1) : '--'}
          </div>
          <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>Avg Rating</div>
        </div>
      </div>
      <div className="h-px w-full mb-2" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />
      {monthlyGoal > 0 && (
        <>
          <div className="text-xs mb-2 text-right" style={{ color: 'var(--text-muted)' }}>of {monthlyGoal} goal</div>
          <div className="relative h-1.5 rounded-full overflow-visible" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(percent, 100)}%`,
                backgroundColor: color,
              }}
            />
            {pacing !== undefined && pacing > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3" style={{ left: `${Math.min(pacing, 100)}%`, backgroundColor: 'var(--christmas-cream)', opacity: 0.8 }} />
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] whitespace-nowrap" style={{ color }}>
              {pacingLabel}
            </span>
            {pacing !== undefined && (
              <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{pacing}% exp</span>
            )}
          </div>
        </>
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

  // Compute daily pacing % (how far through today's business hours)
  const getDailyPacing = () => {
    const now = new Date();
    const dow = now.getDay();
    if (dow === 0) return 0;
    const hour = now.getHours() + now.getMinutes() / 60;
    if (hour < 8) return 0;
    if (hour >= 18) return 100;
    const dayWeight = dow === 6 ? 0.5 : 1;
    return Math.round(((hour - 8) / 10) * 100 * dayWeight);
  };

  // Compute weekly pacing %
  const getWeeklyPacing = () => {
    const now = new Date();
    const dow = now.getDay();
    if (dow === 0) return 0;
    const hour = now.getHours() + now.getMinutes() / 60;
    let dayProgress = 0;
    if (hour >= 18) dayProgress = dow === 6 ? 0.5 : 1;
    else if (hour >= 8) dayProgress = ((hour - 8) / 10) * (dow === 6 ? 0.5 : 1);
    const daysCompleted = dow === 6 ? 5 : dow - 1;
    return Math.round(((daysCompleted + dayProgress) / 5.5) * 100);
  };

  const dailyPacing = getDailyPacing();
  const weeklyPacing = getWeeklyPacing();
  const monthlyPacing = pacingData?.businessDaysInMonth
    ? Math.round(((pacingData?.businessDaysElapsed || 0) / pacingData.businessDaysInMonth) * 100)
    : undefined;

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
                pacing={dailyPacing}
                completed={selectedEndDate < today}
              />
              <PacingCard
                label="This Week"
                revenue={pacingData?.wtdRevenue || 0}
                sales={pacingData?.wtdSales || 0}
                target={pacingData?.weeklyTarget || 0}
                pacing={weeklyPacing}
              />
              <PacingCard
                label="MTD"
                revenue={pacingData?.mtdRevenue || 0}
                sales={pacingData?.mtdSales || 0}
                target={pacingData?.monthlyTarget || 0}
                pacing={monthlyPacing}
              />
              <ReviewCard
                reviewCount={pacingData?.reviewsMtdCount || 0}
                monthlyGoal={pacingData?.reviewMonthlyGoal || 0}
                avgRating={pacingData?.reviewsMtdAvgRating || 0}
                pacing={monthlyPacing}
              />
            </div>
          </div>

          {/* Christmas Overall - Pacing Action Card */}
          {pacingData && (() => {
            const SALES_MULTIPLIER = 1.05;
            const monthlyRevTarget = pacingData.monthlyTarget || 0;
            const monthlySalesTarget = monthlyRevTarget * SALES_MULTIPLIER;
            const mtdRev = pacingData.mtdRevenue || 0;
            const mtdSales = pacingData.mtdSales || 0;
            const bdzLeft = pacingData.businessDaysRemaining || 0;
            const origDailyTarget = pacingData.dailyTarget || 0;
            const revRemaining = Math.max(0, monthlyRevTarget - mtdRev);
            const salesRemaining = Math.max(0, monthlySalesTarget - mtdSales);
            const dailyRevNeeded = bdzLeft > 0 ? revRemaining / bdzLeft : 0;
            const dailySalesNeeded = bdzLeft > 0 ? salesRemaining / bdzLeft : 0;
            const revOnTrack = dailyRevNeeded <= origDailyTarget;
            const salesOnTrack = dailySalesNeeded <= (origDailyTarget * SALES_MULTIPLIER);

            const wtdRev = pacingData.wtdRevenue || 0;
            const wtdSales = pacingData.wtdSales || 0;
            const weekTarget = pacingData.weeklyTarget || 0;
            const weekSalesTarget = weekTarget * SALES_MULTIPLIER;
            const weekRevRemaining = Math.max(0, weekTarget - wtdRev);
            const weekSalesRemaining = Math.max(0, weekSalesTarget - wtdSales);

            // Get department ID for general notes
            const christmasOverallDept = data?.departments?.find(d => d.slug === 'christmas-overall');
            const generalNoteKey = christmasOverallDept ? `dept-${christmasOverallDept.id}` : 'dept-christmas-overall';

            const revDelta = dailyRevNeeded - origDailyTarget;
            const salesDelta = dailySalesNeeded - (origDailyTarget * SALES_MULTIPLIER);

            return (
              <div className="mb-8">
                {/* Header bar */}
                <div className="flex flex-col items-center gap-1 mb-4">
                  <div className="flex items-center gap-4 w-full">
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--christmas-green), transparent)', opacity: 0.3 }} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--christmas-green)' }}>
                      Rest of Month
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, var(--christmas-green), transparent)', opacity: 0.3 }} />
                  </div>
                  {pacingData?.businessDaysRemaining !== undefined && (
                    <span
                      className="text-sm font-bold px-4 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: 'rgba(52, 102, 67, 0.15)',
                        color: 'var(--christmas-green)',
                        border: '1px solid rgba(52, 102, 67, 0.3)',
                      }}
                    >
                      {pacingData.businessDaysRemaining} business days left
                    </span>
                  )}
                </div>

                {/* Pace gauges - 4 across */}
                <div className="relative mb-6 py-5 px-4 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const elapsed = pacingData?.businessDaysElapsed || 0;
                      const total = pacingData?.businessDaysInMonth || 0;
                      const leadsMtd = pacingData?.replacementLeadsMtd || 0;
                      const tglMtd = pacingData?.tglLeadsMtd || 0;
                      const mktMtd = pacingData?.marketingLeadsMtd || 0;
                      const leadsGoal = pacingData?.replacementLeadMonthlyGoal || 0;
                      const leadsRemaining = Math.max(0, leadsGoal - leadsMtd);
                      const leadsPerDayNeeded = bdzLeft > 0 ? leadsRemaining / bdzLeft : 0;
                      const leadsPerDayTarget = leadsGoal > 0 && total > 0 ? leadsGoal / total : 0;
                      return (
                        <>
                          <PaceGauge
                            label="Revenue Pace"
                            needed={dailyRevNeeded}
                            target={origDailyTarget}
                            mtdActual={mtdRev}
                            mtdGoal={monthlyRevTarget}
                            daysElapsed={elapsed}
                            daysInMonth={total}
                          />
                          <PaceGauge
                            label="Sales Pace"
                            needed={dailySalesNeeded}
                            target={origDailyTarget * SALES_MULTIPLIER}
                            mtdActual={mtdSales}
                            mtdGoal={monthlySalesTarget}
                            daysElapsed={elapsed}
                            daysInMonth={total}
                          />
                          <PaceGauge
                            label="Replacement Leads"
                            needed={leadsPerDayNeeded}
                            target={leadsPerDayTarget}
                            suffix="/day"
                            formatValue={(v) => v.toFixed(1)}
                            noData={leadsGoal === 0}
                            mtdActual={leadsMtd}
                            mtdGoal={leadsGoal}
                            daysElapsed={elapsed}
                            daysInMonth={total}
                            tooltip={`TGL: ${tglMtd}\nMarketing Lead: ${mktMtd}`}
                          />
                          <PaceGauge
                            label="Avg Ticket"
                            needed={0}
                            target={0}
                            suffix=""
                            noData
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Scoreboard table removed - data shown in gauges and pacing cards above */}
              </div>
            );
          })()}

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
                  generalNote={data?.generalNotes?.[`dept-${dept.id}`] || null}
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
