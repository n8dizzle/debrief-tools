'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntelligenceReport {
  id: string;
  report_date: string;
  report_type: 'daily' | 'weekly';
  narrative: string;
  structured_insights: {
    headline?: string;
    top_channel?: string;
    biggest_concern?: string;
    channel_grades?: Record<string, string>;
    recommendations?: string[];
  };
  generated_at: string;
}

interface SourceMetrics {
  source: string;
  sourceDetail: string | null;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
  cpa: number;
  bookingRate: number;
  closeRate: number;
  roi: number;
}

interface DailyMetric {
  date: string;
  leads: number;
  qualified: number;
  booked: number;
  completed: number;
  revenue: number;
  cost: number;
}

interface MetricsSummary {
  totalLeads: number;
  qualifiedLeads: number;
  bookedLeads: number;
  completedLeads: number;
  totalRevenue: number;
  totalCost: number;
  cpa: number;
  bookingRate: number;
  closeRate: number;
  roi: number;
}

interface MetricsResponse {
  dateRange: { start: string; end: string };
  summary: MetricsSummary;
  comparisons?: {
    wow: Record<string, number | null>;
    yoy: Record<string, number | null>;
    sparkline: Array<{ date: string; leads: number; revenue: number }>;
  } | null;
  bySource: SourceMetrics[];
  byTrade: SourceMetrics[];
  daily: DailyMetric[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Health Grade calculation
// ---------------------------------------------------------------------------

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#5D8A66',
  C: '#B8956B',
  D: '#f97316',
  F: '#ef4444',
};

function calculateGrade(source: SourceMetrics): string {
  let score = 0;

  // Lead volume (0-30 pts): more leads = better
  if (source.leads >= 20) score += 30;
  else if (source.leads >= 10) score += 22;
  else if (source.leads >= 5) score += 15;
  else if (source.leads >= 1) score += 8;

  // Revenue (0-30 pts): any revenue is good
  if (source.revenue >= 20000) score += 30;
  else if (source.revenue >= 10000) score += 22;
  else if (source.revenue >= 5000) score += 15;
  else if (source.revenue > 0) score += 8;

  // Booking rate (0-20 pts)
  if (source.bookingRate >= 60) score += 20;
  else if (source.bookingRate >= 40) score += 15;
  else if (source.bookingRate >= 20) score += 10;
  else if (source.bookingRate > 0) score += 5;

  // Cost efficiency (0-20 pts): lower CPA is better, free is best
  if (source.cost === 0) score += 20;
  else if (source.cpa <= 30) score += 18;
  else if (source.cpa <= 60) score += 12;
  else if (source.cpa <= 100) score += 6;

  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Sparkline component (inline)
// ---------------------------------------------------------------------------

function Sparkline({ data, dataKey, color = '#5D8A66', height = 40 }: {
  data: { value: number }[];
  dataKey?: string;
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  return (
    <div className="hidden sm:block" aria-hidden="true">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey || 'value'}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-fill-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card component
// ---------------------------------------------------------------------------

function KPICard({
  title,
  value,
  formattedValue,
  trendPercent,
  sparkData,
  wowPercent,
  yoyPercent,
  isLoading,
  invertTrend,
}: {
  title: string;
  value: number | null;
  formattedValue: string;
  trendPercent: number | null;
  sparkData: { value: number }[];
  wowPercent: number | null;
  yoyPercent: number | null;
  isLoading: boolean;
  invertTrend?: boolean;
}) {
  const isPositive = trendPercent !== null
    ? invertTrend ? trendPercent < 0 : trendPercent > 0
    : null;

  const trendColor = isPositive === null
    ? 'var(--text-muted)'
    : isPositive ? '#22c55e' : '#ef4444';

  const trendArrow = isPositive === null
    ? ''
    : isPositive ? '\u25B2' : '\u25BC';

  const ariaLabel = value !== null && trendPercent !== null
    ? `${title}: ${formattedValue}, ${isPositive ? 'up' : 'down'} ${Math.abs(trendPercent).toFixed(1)}% week over week`
    : `${title}: ${formattedValue}`;

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      aria-label={ariaLabel}
    >
      <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>

      {isLoading ? (
        <>
          <div className="h-8 w-24 rounded animate-pulse mb-2" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <div className="h-10 w-full rounded animate-pulse" style={{ backgroundColor: 'var(--border-subtle)' }} />
        </>
      ) : (
        <>
          {/* Value + trend */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              {formattedValue}
            </span>
            {trendPercent !== null && (
              <span className="text-sm font-medium" style={{ color: trendColor }}>
                {trendArrow} {Math.abs(trendPercent).toFixed(1)}%
              </span>
            )}
          </div>

          {/* Sparkline */}
          <Sparkline data={sparkData} />

          {/* WoW / YoY rows */}
          <div className="mt-2 space-y-0.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>WoW</span>
              <span style={{ color: wowPercent !== null ? (((invertTrend ? -1 : 1) * wowPercent) > 0 ? '#22c55e' : '#ef4444') : 'var(--text-muted)' }}>
                {wowPercent !== null ? `${wowPercent > 0 ? '+' : ''}${wowPercent.toFixed(1)}%` : '--'}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:flex hidden">
              <span style={{ color: 'var(--text-muted)' }}>YoY</span>
              <span style={{ color: 'var(--text-muted)' }}>--</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade Badge component
// ---------------------------------------------------------------------------

function GradeBadge({ grade }: { grade: string }) {
  const color = GRADE_COLORS[grade] || 'var(--text-muted)';
  const labels: Record<string, string> = { A: 'excellent', B: 'good', C: 'needs attention', D: 'concerning', F: 'critical' };

  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-bold inline-block"
      style={{ backgroundColor: `${color}33`, color }}
      aria-label={`Channel health: ${grade}, ${labels[grade] || 'unknown'}`}
    >
      {grade}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function IntelligenceCenterPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  // --- Date Range ---
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { start: formatLocalDate(start), end: formatLocalDate(end) };
  });

  // --- Brief state ---
  const [briefMode, setBriefMode] = useState<'daily' | 'weekly'>('daily');
  const [brief, setBrief] = useState<IntelligenceReport | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError] = useState(false);

  // --- Metrics state ---
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // --- Sync state ---
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Campaign report state ---
  const [reportData, setReportData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // --- Fetch AI brief ---
  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(false);
    try {
      const res = await fetch('/api/intelligence/daily', { credentials: 'include' });
      if (!res.ok) {
        setBriefError(true);
        return;
      }
      const data = await res.json();
      setBrief(data.report || null);
    } catch {
      setBriefError(true);
    } finally {
      setBriefLoading(false);
    }
  }, []);

  // --- Fetch metrics ---
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const url = `/api/leads/metrics?startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch metrics');
      }
      const data: MetricsResponse = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setMetricsError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [dateRange]);

  // --- Fetch campaign report data ---
  const fetchReportData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reports/summary?startDate=${dateRange.start}&endDate=${dateRange.end}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.hasData) setReportData(data);
      }
    } catch { /* non-blocking */ }
  }, [dateRange]);

  // --- Upload handler (supports multiple files) ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMessage(null);

    let totalProcessed = 0;
    let totalBooked = 0;
    let totalRevenue = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadMessage(`Uploading ${i + 1} of ${files.length}: ${file.name}...`);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/reports/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        totalProcessed += data.campaignsProcessed || 0;
        totalBooked += data.summary?.totalBooked || 0;
        totalRevenue += data.summary?.totalRevenue || 0;
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        errors++;
      }
    }

    setUploadMessage(
      `Done: ${files.length} files uploaded, ${totalProcessed} campaigns, ${totalBooked.toLocaleString()} jobs booked, $${totalRevenue.toLocaleString()} revenue${errors > 0 ? ` (${errors} errors)` : ''}`
    );
    await fetchReportData();
    await fetchMetrics();
    setUploading(false);
    e.target.value = '';
  };

  // --- Initial load ---
  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  useEffect(() => {
    fetchMetrics();
    fetchReportData();
  }, [fetchMetrics, fetchReportData]);

  // --- Sync handler ---
  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      // Regenerate today's AI brief, then refresh everything
      await fetch('/api/intelligence/daily', { method: 'POST', credentials: 'include' }).catch(() => {});
      await Promise.all([fetchBrief(), fetchMetrics(), fetchReportData()]);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Derived data (prefer campaign report data when available) ---
  const hasReport = !!reportData?.hasData;
  const rptSummary = reportData?.summary;

  const displayLeads = hasReport ? rptSummary.totalCalls : (metrics?.summary?.totalLeads ?? 0);
  const displayRevenue = hasReport ? rptSummary.totalRevenue : (metrics?.summary?.totalRevenue ?? 0);
  const displayBooked = hasReport ? rptSummary.totalBooked : (metrics?.summary?.bookedLeads ?? 0);
  const displayBookingRate = hasReport ? rptSummary.bookingRate : (metrics?.summary?.bookingRate ?? 0);
  const displayAvgTicket = hasReport ? rptSummary.avgTicket : 0;
  const displayCPL = hasReport && rptSummary.totalCalls > 0
    ? rptSummary.totalRevenue / rptSummary.totalCalls
    : (metrics?.summary?.cpa ?? 0);

  const sparkLeads = (metrics?.daily || []).map(d => ({ value: d.leads }));
  const sparkRevenue = (metrics?.daily || []).map(d => ({ value: d.revenue }));
  const sparkCPL = (metrics?.daily || []).map(d => ({ value: d.leads > 0 ? d.cost / d.leads : 0 }));
  const sparkBooking = (metrics?.daily || []).map(d => ({ value: d.leads > 0 ? (d.booked / d.leads) * 100 : 0 }));

  // Channel data: prefer uploaded report, fall back to master_leads metrics
  // Filter out channels with zero activity across the board
  const channelsSorted: SourceMetrics[] = (hasReport
    ? (reportData.channels || []).map((ch: any) => ({
        source: ch.channel,
        sourceDetail: ch.category,
        leads: ch.calls,
        qualified: ch.uniqueCalls,
        booked: ch.booked,
        completed: ch.completed,
        revenue: ch.revenue,
        cost: 0,
        cpa: ch.uniqueCalls > 0 ? ch.revenue / ch.uniqueCalls : 0,
        bookingRate: ch.calls > 0 ? (ch.booked / ch.calls) * 100 : 0,
        closeRate: 0,
        roi: 0,
      }))
    : [...(metrics?.bySource || [])].sort((a, b) => b.revenue - a.revenue)
  ).filter((ch: SourceMetrics) => ch.leads > 0 || ch.booked > 0 || ch.revenue > 0);

  // Use AI-generated channel grades if available, otherwise calculate
  const aiGrades = brief?.structured_insights?.channel_grades || {};

  function getGrade(source: SourceMetrics): string {
    if (aiGrades[source.source]) return aiGrades[source.source];
    return calculateGrade(source);
  }

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------- */}
      {/* Header */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Intelligence Center
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Welcome back, {firstName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} dataDelay={3} />
          <label
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--christmas-gold)', color: 'var(--dark-bg, #0F1210)' }}
          >
            {uploading ? 'Uploading...' : 'Upload Reports'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <button
            onClick={handleSyncData}
            disabled={isSyncing}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            {isSyncing ? (
              <>
                <svg className="inline w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              'Sync Data'
            )}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* AI Brief Panel */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="rounded-xl p-8"
        style={{
          backgroundColor: '#1D251F',
          border: '1px solid var(--border-subtle)',
          borderTop: '3px solid var(--christmas-gold)',
        }}
      >
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Marketing Intelligence
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {brief ? formatDateLong(brief.report_date) : formatDateLong(formatLocalDate(new Date()))}
            </p>
          </div>

          {/* Daily / Weekly toggle */}
          <div
            className="flex rounded-full overflow-hidden text-xs"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <button
              onClick={() => setBriefMode('daily')}
              className="px-3 py-1 transition-colors"
              style={{
                backgroundColor: briefMode === 'daily' ? 'var(--christmas-green)' : 'transparent',
                color: briefMode === 'daily' ? 'var(--christmas-cream)' : 'var(--text-muted)',
              }}
            >
              Daily
            </button>
            <button
              onClick={() => setBriefMode('weekly')}
              className="px-3 py-1 transition-colors"
              style={{
                backgroundColor: briefMode === 'weekly' ? 'var(--christmas-green)' : 'transparent',
                color: briefMode === 'weekly' ? 'var(--christmas-cream)' : 'var(--text-muted)',
              }}
            >
              Weekly
            </button>
          </div>
        </div>

        {/* Brief body */}
        {briefLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-4 rounded animate-pulse"
                style={{
                  backgroundColor: 'var(--border-subtle)',
                  width: i === 4 ? '60%' : '100%',
                }}
              />
            ))}
          </div>
        ) : briefError ? (
          <div>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Brief unavailable for today.
            </p>
            <button
              onClick={fetchBrief}
              className="mt-2 text-sm underline"
              style={{ color: 'var(--christmas-green-light)' }}
            >
              View Yesterday
            </button>
          </div>
        ) : brief && brief.narrative ? (
          <div className="space-y-2">
            {brief.narrative.split('\n').filter(Boolean).map((line, i) => {
              // Render **bold** labels inline
              const parts = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/(<b>.+?<\/b>)/);
              return (
                <p
                  key={i}
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--christmas-cream)' }}
                  dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--christmas-gold)">$1</strong>') }}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Brief generating. Check back after 6am CT.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* KPI Cards */}
      {/* ---------------------------------------------------------------- */}
      {metricsError && (
        <div
          className="rounded-lg p-3 flex items-center justify-between"
          style={{ backgroundColor: 'rgba(139, 45, 50, 0.2)', border: '1px solid rgba(139, 45, 50, 0.3)' }}
        >
          <span className="text-sm" style={{ color: '#c97878' }}>
            Failed to load metrics
          </span>
          <button
            onClick={fetchMetrics}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Upload Report + KPI Row */}
      {uploadMessage && (
        <div className={`rounded-lg px-4 py-3 text-sm ${uploadMessage.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
          {uploadMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={hasReport ? 'Inbound Calls' : 'Total Leads'}
          value={displayLeads}
          formattedValue={formatNumber(displayLeads)}
          trendPercent={metrics?.comparisons?.wow?.leads ?? null}
          sparkData={sparkLeads}
          wowPercent={metrics?.comparisons?.wow?.leads ?? null}
          yoyPercent={metrics?.comparisons?.yoy?.leads ?? null}
          isLoading={metricsLoading}
        />
        <KPICard
          title="Revenue"
          value={displayRevenue}
          formattedValue={formatCurrency(displayRevenue)}
          trendPercent={metrics?.comparisons?.wow?.revenue ?? null}
          sparkData={sparkRevenue}
          wowPercent={metrics?.comparisons?.wow?.revenue ?? null}
          yoyPercent={metrics?.comparisons?.yoy?.revenue ?? null}
          isLoading={metricsLoading}
        />
        <KPICard
          title={hasReport ? 'Avg Ticket' : 'Cost Per Lead'}
          value={hasReport ? displayAvgTicket : displayCPL}
          formattedValue={formatCurrency(hasReport ? displayAvgTicket : displayCPL)}
          trendPercent={metrics?.comparisons?.wow?.cpl ?? null}
          sparkData={sparkCPL}
          wowPercent={metrics?.comparisons?.wow?.cpl ?? null}
          yoyPercent={metrics?.comparisons?.yoy?.cpl ?? null}
          isLoading={metricsLoading}
          invertTrend={!hasReport}
        />
        <KPICard
          title={hasReport ? 'Jobs Booked' : 'Booking Rate'}
          value={hasReport ? displayBooked : displayBookingRate}
          formattedValue={hasReport ? formatNumber(displayBooked) : formatPercent(displayBookingRate)}
          trendPercent={metrics?.comparisons?.wow?.bookingRate ?? null}
          sparkData={sparkBooking}
          wowPercent={metrics?.comparisons?.wow?.bookingRate ?? null}
          yoyPercent={metrics?.comparisons?.yoy?.bookingRate ?? null}
          isLoading={metricsLoading}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Channel Performance Table */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Channel Performance
        </h2>

        {metricsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-10 rounded animate-pulse"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              />
            ))}
          </div>
        ) : channelsSorted.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">No channel data. Sync lead sources to see attribution.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left py-2 pr-4 font-medium">Channel</th>
                    <th className="text-right py-2 px-4 font-medium">{hasReport ? 'Calls' : 'Leads'}</th>
                    <th className="text-right py-2 px-4 font-medium">Booked</th>
                    <th className="text-right py-2 px-4 font-medium">Revenue</th>
                    <th className="text-right py-2 px-4 font-medium">Avg Ticket</th>
                    <th className="text-center py-2 pl-4 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {channelsSorted.map((ch) => {
                    const avgTicket = ch.booked > 0 ? ch.revenue / ch.booked : (ch.completed > 0 ? ch.revenue / ch.completed : 0);
                    const grade = getGrade(ch);
                    return (
                      <tr
                        key={ch.source}
                        className="transition-colors"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="py-3 pr-4 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                          {ch.source}
                        </td>
                        <td className="py-3 px-4 text-right" style={{ color: 'var(--christmas-cream)' }}>
                          {formatNumber(ch.leads)}
                        </td>
                        <td className="py-3 px-4 text-right" style={{ color: 'var(--christmas-cream)' }}>
                          {ch.booked > 0 ? formatNumber(ch.booked) : '--'}
                        </td>
                        <td className="py-3 px-4 text-right" style={{ color: 'var(--christmas-cream)' }}>
                          {ch.revenue > 0 ? formatCurrency(ch.revenue) : '--'}
                        </td>
                        <td className="py-3 px-4 text-right" style={{ color: 'var(--christmas-cream)' }}>
                          {avgTicket > 0 ? formatCurrency(avgTicket) : '--'}
                        </td>
                        <td className="py-3 pl-4 text-center">
                          <GradeBadge grade={grade} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="sm:hidden space-y-3">
              {channelsSorted.map((ch) => {
                const avgTicket = ch.booked > 0 ? ch.revenue / ch.booked : (ch.completed > 0 ? ch.revenue / ch.completed : 0);
                const grade = getGrade(ch);
                return (
                  <div
                    key={ch.source}
                    className="rounded-lg p-4"
                    style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {ch.source}
                      </span>
                      <GradeBadge grade={grade} />
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span>{formatNumber(ch.leads)} leads</span>
                      <span>{ch.revenue > 0 ? formatCurrency(ch.revenue) : '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      <span>CPL: {ch.cost > 0 ? formatCurrency(ch.cpa) : '$0'}</span>
                      <span>Avg: {avgTicket > 0 ? formatCurrency(avgTicket) : '--'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Trend Chart */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Lead Trend
        </h2>

        {metricsLoading ? (
          <div
            className="h-64 rounded animate-pulse"
            style={{ backgroundColor: 'var(--border-subtle)' }}
          />
        ) : !metrics?.daily || metrics.daily.length === 0 ? (
          <div className="h-64 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">No trend data yet.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics.daily}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  stroke="var(--border-subtle)"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  stroke="var(--border-subtle)"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--christmas-cream)',
                    fontSize: 12,
                  }}
                  labelFormatter={(label: any) => formatDateShort(String(label))}
                  formatter={(value: any) => [formatNumber(Number(value)), 'Leads']}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#5D8A66"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#5D8A66' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {metrics?.daily && metrics.daily.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5" style={{ backgroundColor: '#5D8A66' }} />
              <span>Leads (current period)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
