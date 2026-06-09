'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine, Cell,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const fmt$ = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtN = (n: number) => n.toLocaleString();
const fmtPct = (n: number) => `${n.toFixed(0)}%`;

type StatusType = 'on' | 'warn' | 'off' | 'neutral';
const getStatus = (actual: number, target: number, lowerIsBetter = false): StatusType => {
  if (!target) return 'neutral';
  const ratio = actual / target;
  if (lowerIsBetter) {
    if (ratio <= 1.05) return 'on';
    if (ratio <= 1.2) return 'warn';
    return 'off';
  }
  if (ratio >= 0.95) return 'on';
  if (ratio >= 0.80) return 'warn';
  return 'off';
};

const STATUS_COLORS: Record<StatusType, string> = {
  on: 'var(--christmas-green)',
  warn: 'var(--christmas-gold)',
  off: '#EF4444',
  neutral: 'var(--text-muted)',
};
const STATUS_LABELS: Record<StatusType, string> = {
  on: 'ON TRACK',
  warn: 'WATCH',
  off: 'OFF TRACK',
  neutral: '---',
};

// Mini sparkline component
function Sparkline({ data, color = 'var(--christmas-green)', width = 80, height = 22 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const vals = data.filter(v => v > 0);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const points = vals.map((v, i) =>
    `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label, prefix = '$' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: 'var(--christmas-cream)', marginBottom: 3 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: '1px 0', color: p.color || 'var(--text-secondary)' }}>
          {p.name}: {prefix === '$' ? fmt$(p.value) : fmtN(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ScorecardPage() {
  const [tab, setTab] = useState<'scorecard' | 'trends' | 'memberships'>('scorecard');
  const { data, error, isLoading } = useSWR('/api/scorecard', fetcher);

  const {
    currentWeek,
    prevWeek,
    trailing13,
    priorYear13,
    targets,
    weeklyTargets,
    ytd,
    annualRevTarget,
    expectedYtdRevenue,
    year,
    week,
  } = data || {};

  type ScorecardRow = {
    label: string; actual: number; target: number; format: string;
    prev: number; key: string; section: string; lowerIsBetter?: boolean;
  };
  type ScorecardGroup = { section: string; rows: ScorecardRow[] };

  // Build scorecard rows from current week data
  const scorecardRows: ScorecardGroup[] = useMemo(() => {
    if (!currentWeek) return [];
    const cw = currentWeek;
    const pw = prevWeek;

    const getVal = (section: string, field: string): number => {
      const src = (cw as any)?.[section];
      return Number(src?.[field]) || 0;
    };
    const getPrevVal = (section: string, field: string): number => {
      const src = (pw as any)?.[section];
      return Number(src?.[field]) || 0;
    };
    const wow = (curr: number, prev: number): string => {
      if (!prev) return '';
      const delta = ((curr - prev) / prev * 100).toFixed(0);
      return `${Number(delta) >= 0 ? '+' : ''}${delta}%`;
    };
    const wowColor = (curr: number, prev: number, lowerIsBetter = false): string => {
      if (!prev) return 'var(--text-muted)';
      const up = curr >= prev;
      return (lowerIsBetter ? !up : up) ? 'var(--christmas-green)' : '#EF4444';
    };

    const weeklyRevTarget = targets?.['TOTAL'] || 0;
    const hvacTarget = (targets?.['HVAC Install'] || 0) + (targets?.['HVAC Service'] || 0) + (targets?.['HVAC Maintenance'] || 0);
    const plumbingTarget = targets?.['Plumbing'] || 0;

    return [
      {
        section: 'COMPANY',
        rows: [
          { label: 'Revenue', actual: getVal('company', 'revenue'), target: weeklyRevTarget, format: '$', prev: getPrevVal('company', 'revenue'), key: 'revenue', section: 'company' },
          { label: 'Sales', actual: getVal('company', 'sales'), target: 0, format: '$', prev: getPrevVal('company', 'sales'), key: 'sales', section: 'company' },
          { label: 'Avg Ticket', actual: getVal('company', 'avg_ticket'), target: 857, format: '$', prev: getPrevVal('company', 'avg_ticket'), key: 'avg_ticket', section: 'company' },
          { label: 'Jobs Ran', actual: getVal('company', 'jobs_ran'), target: 0, format: '#', prev: getPrevVal('company', 'jobs_ran'), key: 'jobs_ran', section: 'company' },
        ],
      },
      {
        section: 'HVAC INSTALL',
        rows: [
          { label: 'Revenue', actual: getVal('hvac_install', 'revenue'), target: targets?.['HVAC Install'] || 0, format: '$', prev: getPrevVal('hvac_install', 'revenue'), key: 'revenue', section: 'hvac_install' },
          { label: 'Avg Ticket', actual: getVal('hvac_install', 'avg_ticket'), target: 0, format: '$', prev: getPrevVal('hvac_install', 'avg_ticket'), key: 'avg_ticket', section: 'hvac_install' },
          { label: 'Jobs Ran', actual: getVal('hvac_install', 'jobs_ran'), target: 0, format: '#', prev: getPrevVal('hvac_install', 'jobs_ran'), key: 'jobs_ran', section: 'hvac_install' },
        ],
      },
      {
        section: 'HVAC SERVICE',
        rows: [
          { label: 'Revenue', actual: getVal('hvac_service', 'revenue'), target: targets?.['HVAC Service'] || 0, format: '$', prev: getPrevVal('hvac_service', 'revenue'), key: 'revenue', section: 'hvac_service' },
          { label: 'Sales', actual: getVal('hvac_service', 'sales'), target: 0, format: '$', prev: getPrevVal('hvac_service', 'sales'), key: 'sales', section: 'hvac_service' },
          { label: 'Avg Ticket', actual: getVal('hvac_service', 'avg_ticket'), target: 0, format: '$', prev: getPrevVal('hvac_service', 'avg_ticket'), key: 'avg_ticket', section: 'hvac_service' },
          { label: 'Jobs Ran', actual: getVal('hvac_service', 'jobs_ran'), target: 0, format: '#', prev: getPrevVal('hvac_service', 'jobs_ran'), key: 'jobs_ran', section: 'hvac_service' },
        ],
      },
      {
        section: 'HVAC MAINTENANCE',
        rows: [
          { label: 'Revenue', actual: getVal('hvac_maintenance', 'revenue'), target: targets?.['HVAC Maintenance'] || 0, format: '$', prev: getPrevVal('hvac_maintenance', 'revenue'), key: 'revenue', section: 'hvac_maintenance' },
          { label: 'Sales', actual: getVal('hvac_maintenance', 'sales'), target: 0, format: '$', prev: getPrevVal('hvac_maintenance', 'sales'), key: 'sales', section: 'hvac_maintenance' },
          { label: 'Avg Ticket', actual: getVal('hvac_maintenance', 'avg_ticket'), target: 0, format: '$', prev: getPrevVal('hvac_maintenance', 'avg_ticket'), key: 'avg_ticket', section: 'hvac_maintenance' },
          { label: 'Jobs Ran', actual: getVal('hvac_maintenance', 'jobs_ran'), target: 0, format: '#', prev: getPrevVal('hvac_maintenance', 'jobs_ran'), key: 'jobs_ran', section: 'hvac_maintenance' },
        ],
      },
      {
        section: 'PLUMBING',
        rows: [
          { label: 'Revenue', actual: getVal('plumbing', 'revenue'), target: plumbingTarget, format: '$', prev: getPrevVal('plumbing', 'revenue'), key: 'revenue', section: 'plumbing' },
          { label: 'Sales', actual: getVal('plumbing', 'sales'), target: 0, format: '$', prev: getPrevVal('plumbing', 'sales'), key: 'sales', section: 'plumbing' },
          { label: 'Avg Ticket', actual: getVal('plumbing', 'avg_ticket'), target: 0, format: '$', prev: getPrevVal('plumbing', 'avg_ticket'), key: 'avg_ticket', section: 'plumbing' },
          { label: 'Jobs Ran', actual: getVal('plumbing', 'jobs_ran'), target: 0, format: '#', prev: getPrevVal('plumbing', 'jobs_ran'), key: 'jobs_ran', section: 'plumbing' },
        ],
      },
      {
        section: 'MEMBERSHIPS',
        rows: [
          { label: 'Active at End', actual: getVal('company', 'memberships_active_end'), target: 0, format: '#', prev: getPrevVal('company', 'memberships_active_end'), key: 'memberships_active_end', section: 'company' },
          { label: 'Sold', actual: getVal('company', 'memberships_sold'), target: 0, format: '#', prev: getPrevVal('company', 'memberships_sold'), key: 'memberships_sold', section: 'company' },
          { label: 'Expired', actual: getVal('company', 'memberships_expired'), target: 0, format: '#', prev: getPrevVal('company', 'memberships_expired'), key: 'memberships_expired', section: 'company', lowerIsBetter: true },
          { label: 'Cancelled', actual: getVal('company', 'memberships_cancelled'), target: 0, format: '#', prev: getPrevVal('company', 'memberships_cancelled'), key: 'memberships_cancelled', section: 'company', lowerIsBetter: true },
          { label: 'Net Change', actual: getVal('company', 'memberships_sold') + getVal('company', 'memberships_renewed') + getVal('company', 'memberships_reactivated') - getVal('company', 'memberships_expired') - getVal('company', 'memberships_cancelled') - getVal('company', 'memberships_deleted'), target: 0, format: '#', prev: 0, key: 'net', section: 'company' },
        ],
      },
    ];
  }, [currentWeek, prevWeek, targets]);

  // Format week ending date as "Mon D" (e.g., "Jun 7")
  const fmtWeekDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  // Build chart data for 13-week trends (per department)
  const trendData = useMemo(() => {
    if (!trailing13?.length) return [];
    return trailing13.map((w: any, idx: number) => {
      const wt = weeklyTargets?.[idx] || {};
      return {
      week: fmtWeekDate(w.week_ending),
      weekNum: w.week_number,
      date: w.week_ending,
      // Revenue targets for this week (from the month it falls in)
      targetTotal: wt['TOTAL'] || 0,
      targetHvacInstall: wt['HVAC Install'] || 0,
      targetHvacService: wt['HVAC Service'] || 0,
      targetHvacMaint: wt['HVAC Maintenance'] || 0,
      targetPlumbing: wt['Plumbing'] || 0,
      // Sales targets = revenue target * 1.05
      salesTargetTotal: Math.round((wt['TOTAL'] || 0) * 1.05),
      salesTargetHvacInstall: Math.round((wt['HVAC Install'] || 0) * 1.05),
      salesTargetHvacService: Math.round((wt['HVAC Service'] || 0) * 1.05),
      salesTargetHvacMaint: Math.round((wt['HVAC Maintenance'] || 0) * 1.05),
      salesTargetPlumbing: Math.round((wt['Plumbing'] || 0) * 1.05),
      // Company
      revenue: Number(w.company?.revenue) || 0,
      sales: Number(w.company?.sales) || 0,
      avgTicket: Number(w.company?.avg_ticket) || 0,
      jobsRan: w.company?.jobs_ran || 0,
      // HVAC departments
      hvacRev: Number(w.hvac?.revenue) || 0,
      hvacSales: Number(w.hvac?.sales) || 0,
      hvacInstallRev: Number(w.hvac_install?.revenue) || 0,
      hvacInstallSales: Number(w.hvac_install?.sales) || 0,
      hvacServiceRev: Number(w.hvac_service?.revenue) || 0,
      hvacServiceSales: Number(w.hvac_service?.sales) || 0,
      hvacMaintRev: Number(w.hvac_maintenance?.revenue) || 0,
      hvacMaintSales: Number(w.hvac_maintenance?.sales) || 0,
      // HVAC Sales (sales only, no revenue)
      hvacSalesDeptSales: Number(w.hvac_sales?.hvac_lead_sales) || 0,
      // Plumbing (all depts combined)
      plumbingRev: Number(w.plumbing?.revenue) || 0,
      plumbingSales: Number(w.plumbing?.sales) || 0,
      // Memberships
      membershipsActive: w.company?.memberships_active_end || 0,
      membershipsSold: w.company?.memberships_sold || 0,
      membershipsExpired: w.company?.memberships_expired || 0,
      membershipsNet: (w.company?.memberships_sold || 0) + (w.company?.memberships_renewed || 0) + (w.company?.memberships_reactivated || 0) - (w.company?.memberships_expired || 0) - (w.company?.memberships_cancelled || 0) - (w.company?.memberships_deleted || 0),
    };});
  }, [trailing13, weeklyTargets]);

  // Prior year data for YoY overlay (per department)
  const priorYearTrendData = useMemo(() => {
    if (!priorYear13?.length) return [];
    return priorYear13.map((w: any) => ({
      weekNum: w.week_number,
      revenue: Number(w.company?.revenue) || 0,
      sales: Number(w.company?.sales) || 0,
      avgTicket: Number(w.company?.avg_ticket) || 0,
      jobsRan: w.company?.jobs_ran || 0,
      hvacInstallRev: Number(w.hvac_install?.revenue) || 0,
      hvacInstallSales: Number(w.hvac_install?.sales) || 0,
      hvacServiceRev: Number(w.hvac_service?.revenue) || 0,
      hvacServiceSales: Number(w.hvac_service?.sales) || 0,
      hvacMaintRev: Number(w.hvac_maintenance?.revenue) || 0,
      hvacMaintSales: Number(w.hvac_maintenance?.sales) || 0,
      hvacSalesDeptSales: Number(w.hvac_sales?.hvac_lead_sales) || 0,
      plumbingRev: Number(w.plumbing?.revenue) || 0,
      plumbingSales: Number(w.plumbing?.sales) || 0,
    }));
  }, [priorYear13]);

  // Merge current + prior year for YoY charts
  const yoyChartData = useMemo(() => {
    return trendData.map((d: any) => {
      const py = priorYearTrendData.find((p: any) => p.weekNum === d.weekNum);
      return {
        ...d,
        priorRevenue: py?.revenue || 0,
        priorSales: py?.sales || 0,
        priorAvgTicket: py?.avgTicket || 0,
        priorJobsRan: py?.jobsRan || 0,
        priorHvacInstallRev: py?.hvacInstallRev || 0,
        priorHvacInstallSales: py?.hvacInstallSales || 0,
        priorHvacServiceRev: py?.hvacServiceRev || 0,
        priorHvacServiceSales: py?.hvacServiceSales || 0,
        priorHvacMaintRev: py?.hvacMaintRev || 0,
        priorHvacMaintSales: py?.hvacMaintSales || 0,
        priorHvacSalesDeptSales: py?.hvacSalesDeptSales || 0,
        priorPlumbingRev: py?.plumbingRev || 0,
        priorPlumbingSales: py?.plumbingSales || 0,
      };
    });
  }, [trendData, priorYearTrendData]);

  // Sparkline data extractor
  const getSparkData = (section: string, field: string): number[] => {
    if (!trailing13?.length) return [];
    return trailing13.map((w: any) => Number(w[section]?.[field]) || 0);
  };

  // IDS items: off-track revenue metrics
  const idsItems = useMemo(() => {
    return scorecardRows.flatMap(g =>
      g.rows.filter(r => r.target > 0 && getStatus(r.actual, r.target) === 'off')
        .map(r => ({ ...r, sectionName: g.section }))
    );
  }, [scorecardRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>Loading scorecard...</div>
      </div>
    );
  }

  if (error || !data || data.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: '#EF4444' }}>Failed to load scorecard data</div>
      </div>
    );
  }

  const ytdRevPacing = expectedYtdRevenue > 0 ? ((ytd?.revenue || 0) / expectedYtdRevenue * 100).toFixed(0) : '0';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Weekly Scorecard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Week {week} (ending {currentWeek?.week_ending}) / {year}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['scorecard', 'trends', 'memberships'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: tab === t ? 'var(--christmas-green)' : 'var(--text-muted)',
              border: tab === t ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-subtle)',
            }}
          >
            {t === 'scorecard' ? 'Scorecard' : t === 'trends' ? '13-Week Trends' : 'Memberships'}
          </button>
        ))}
      </div>

      {/* YTD Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'YTD Revenue', val: fmt$(ytd?.revenue || 0), sub: `${ytdRevPacing}% of pace`, color: Number(ytdRevPacing) >= 95 ? 'var(--christmas-green)' : 'var(--christmas-gold)' },
          { label: 'YTD Sales', val: fmt$(ytd?.sales || 0), sub: `${fmtN(ytd?.jobs_ran || 0)} jobs ran`, color: 'var(--christmas-green)' },
          { label: 'YTD Reviews', val: fmtN(ytd?.reviews || 0), sub: 'of 1,250 target', color: 'var(--christmas-green)' },
          { label: 'Active Members', val: fmtN(ytd?.memberships_active || 0), sub: `${fmtN(ytd?.memberships_sold || 0)} sold YTD`, color: 'var(--christmas-green)' },
          { label: 'Annual Target', val: fmt$(annualRevTarget || 0), sub: `${fmt$(expectedYtdRevenue || 0)} expected YTD`, color: 'var(--text-muted)' },
        ].map((c, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${c.color}` }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--christmas-cream)' }}>{c.val}</p>
            <p className="text-xs mt-1" style={{ color: c.color }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ══ SCORECARD TAB ══ */}
      {tab === 'scorecard' && (
        <>
          {scorecardRows.map((group, gi) => (
            <div key={gi} className="mb-4">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {group.section}
                </h3>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
              </div>

              {/* Table */}
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['', 'Metric', 'Actual', 'Target', 'Status', 'WoW', '13-Wk'].map(h => (
                        <th
                          key={h}
                          className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                          style={{
                            color: 'var(--text-muted)',
                            textAlign: h === 'Metric' || h === '' ? 'left' : 'right',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, ri) => {
                      const st = row.target > 0 ? getStatus(row.actual, row.target, row.lowerIsBetter) : 'neutral';
                      const formatVal = (v: number) => row.format === '$' ? fmt$(v) : fmtN(v);
                      const wowVal = row.prev ? ((row.actual - row.prev) / row.prev * 100).toFixed(0) : '';
                      const wowPrefix = wowVal && Number(wowVal) >= 0 ? '+' : '';
                      const wowC = row.prev
                        ? (row.lowerIsBetter
                          ? (row.actual <= row.prev ? 'var(--christmas-green)' : '#EF4444')
                          : (row.actual >= row.prev ? 'var(--christmas-green)' : '#EF4444'))
                        : 'var(--text-muted)';
                      const sparkData = getSparkData(row.section, row.key);

                      return (
                        <tr
                          key={ri}
                          style={{
                            borderBottom: ri < group.rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                          }}
                        >
                          <td className="pl-3 w-4">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[st] }}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--christmas-cream)' }}>
                            {row.label}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                            {formatVal(row.actual)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                            {row.target > 0 ? formatVal(row.target) : '---'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-xs font-bold uppercase" style={{ color: STATUS_COLORS[st] }}>
                              {STATUS_LABELS[st]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: wowC }}>
                            {wowVal ? `${wowPrefix}${wowVal}%` : '---'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Sparkline data={sparkData} color={STATUS_COLORS[st]} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Flagged for IDS */}
          {idsItems.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#EF4444' }}>
                  Flagged for IDS
                </h3>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
              </div>
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                {idsItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2"
                    style={{ borderBottom: i < idsItems.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#EF4444' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {item.sectionName} {item.label}
                    </span>
                    <span className="text-xs ml-auto font-mono" style={{ color: 'var(--text-muted)' }}>
                      {item.format === '$' ? fmt$(item.actual) : fmtN(item.actual)} vs {item.format === '$' ? fmt$(item.target) : fmtN(item.target)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TRENDS TAB ══ */}
      {tab === 'trends' && (() => {
        // Department chart config: label, current rev key, prior rev key, current sales key, prior sales key, bar color
        const deptCharts: { label: string; revKey: string; priorRevKey: string; salesKey: string; priorSalesKey: string; targetKey: string; salesTargetKey: string; color: string; showRevenue: boolean }[] = [
          { label: 'Company Total', revKey: 'revenue', priorRevKey: 'priorRevenue', salesKey: 'sales', priorSalesKey: 'priorSales', targetKey: 'targetTotal', salesTargetKey: 'salesTargetTotal', color: 'var(--christmas-green)', showRevenue: true },
          { label: 'HVAC Install', revKey: 'hvacInstallRev', priorRevKey: 'priorHvacInstallRev', salesKey: 'hvacInstallSales', priorSalesKey: 'priorHvacInstallSales', targetKey: 'targetHvacInstall', salesTargetKey: 'salesTargetHvacInstall', color: '#3b82f6', showRevenue: true },
          { label: 'HVAC Service', revKey: 'hvacServiceRev', priorRevKey: 'priorHvacServiceRev', salesKey: 'hvacServiceSales', priorSalesKey: 'priorHvacServiceSales', targetKey: 'targetHvacService', salesTargetKey: 'targetHvacService', color: '#8b5cf6', showRevenue: true },
          { label: 'HVAC Maintenance', revKey: 'hvacMaintRev', priorRevKey: 'priorHvacMaintRev', salesKey: 'hvacMaintSales', priorSalesKey: 'priorHvacMaintSales', targetKey: 'targetHvacMaint', salesTargetKey: 'salesTargetHvacMaint', color: '#06b6d4', showRevenue: true },
          { label: 'HVAC Sales', revKey: '', priorRevKey: '', salesKey: 'hvacSalesDeptSales', priorSalesKey: 'priorHvacSalesDeptSales', targetKey: '', salesTargetKey: '', color: '#f59e0b', showRevenue: false },
          { label: 'Plumbing', revKey: 'plumbingRev', priorRevKey: 'priorPlumbingRev', salesKey: 'plumbingSales', priorSalesKey: 'priorPlumbingSales', targetKey: 'targetPlumbing', salesTargetKey: 'salesTargetPlumbing', color: 'var(--christmas-gold)', showRevenue: true },
        ];

        return (
          <>
            {deptCharts.map((dept, di) => (
              <div key={di} className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    {dept.label}
                  </h3>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Revenue chart */}
                  {dept.showRevenue && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Revenue — {year} vs {year - 1}</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={yoyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey={dept.revKey} name={`${year}`} radius={[3, 3, 0, 0]} fillOpacity={0.85}>
                            {yoyChartData.map((d: any, i: number) => (
                              <Cell key={i} fill={(d[dept.revKey] || 0) >= (d[dept.priorRevKey] || 0) ? dept.color : '#EF4444'} />
                            ))}
                          </Bar>
                          <Line type="monotone" dataKey={dept.priorRevKey} name={`${year - 1}`} stroke="var(--christmas-gold)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                          {dept.targetKey && <Line type="stepAfter" dataKey={dept.targetKey} name="Target" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Sales chart */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Sales — {year} vs {year - 1}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={yoyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey={dept.salesKey} name={`${year}`} radius={[3, 3, 0, 0]} fillOpacity={0.85}>
                          {yoyChartData.map((d: any, i: number) => (
                            <Cell key={i} fill={(d[dept.salesKey] || 0) >= (d[dept.priorSalesKey] || 0) ? dept.color : '#EF4444'} />
                          ))}
                        </Bar>
                        <Line type="monotone" dataKey={dept.priorSalesKey} name={`${year - 1}`} stroke="var(--christmas-gold)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                          {dept.salesTargetKey && <Line type="stepAfter" dataKey={dept.salesTargetKey} name="Target" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ))}
          </>
        );
      })()}

      {/* ══ MEMBERSHIPS TAB ══ */}
      {tab === 'memberships' && (
        <>
          {/* Membership summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Active Members', val: fmtN(currentWeek?.company?.memberships_active_end || 0), color: 'var(--christmas-green)' },
              { label: 'Sold This Week', val: fmtN(currentWeek?.company?.memberships_sold || 0), color: 'var(--christmas-green)' },
              { label: 'Expired This Week', val: fmtN(currentWeek?.company?.memberships_expired || 0), color: '#EF4444' },
              {
                label: 'Net Change',
                val: fmtN(
                  (currentWeek?.company?.memberships_sold || 0) +
                  (currentWeek?.company?.memberships_renewed || 0) +
                  (currentWeek?.company?.memberships_reactivated || 0) -
                  (currentWeek?.company?.memberships_expired || 0) -
                  (currentWeek?.company?.memberships_cancelled || 0) -
                  (currentWeek?.company?.memberships_deleted || 0)
                ),
                color: 'var(--christmas-gold)',
              },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${c.color}` }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--christmas-cream)' }}>{c.val}</p>
              </div>
            ))}
          </div>

          {/* Active members trend */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Active Membership Count (13 Weeks)
            </h3>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" domain={['dataMin - 50', 'dataMax + 50']} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip prefix="#" />} />
                  <Line yAxisId="left" type="monotone" dataKey="membershipsActive" name="Active Members" stroke="var(--christmas-green)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--christmas-green)' }} />
                  <Bar yAxisId="right" dataKey="membershipsSold" name="Sold" fill="var(--christmas-green)" fillOpacity={0.3} radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gross adds vs losses (the leaky bucket chart) */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Membership Adds vs Losses (The Leaky Bucket)
            </h3>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip prefix="#" />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="membershipsSold" name="Sold" fill="var(--christmas-green)" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="membershipsExpired" name="Expired" fill="#EF4444" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="membershipsNet" name="Net Change" stroke="var(--christmas-gold)" strokeWidth={2} dot={{ r: 3, fill: 'var(--christmas-gold)' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
