'use client';

import { useState, useRef, useEffect } from 'react';
import type { LeaderboardEntry } from '@/lib/supabase';
import DrillDownModal from './DrillDownModal';

type SortKey = 'rank' | 'name' | 'gross_sales' | 'tgls' | 'options_per_opportunity' | 'reviews' | 'memberships_sold' | 'attendance_points' | 'score';
type Metric = 'gross_sales' | 'tgls' | 'options_per_opportunity' | 'reviews' | 'memberships_sold' | 'attendance';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="rank-1 font-bold text-lg">1st</span>;
  }
  if (rank === 2) {
    return <span className="rank-2 font-bold text-lg">2nd</span>;
  }
  if (rank === 3) {
    return <span className="rank-3 font-bold text-lg">3rd</span>;
  }
  return <span style={{ color: 'var(--text-secondary)' }}>{rank}</span>;
}

function TradeBadge({ trade }: { trade: 'hvac' | 'plumbing' }) {
  return (
    <span className={trade === 'hvac' ? 'badge badge-hvac' : 'badge badge-plumbing'}>
      {trade === 'hvac' ? 'HVAC' : 'Plumbing'}
    </span>
  );
}

function ScoringInfoPopover({ weights, onClose }: { weights: Record<string, number>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const w = {
    revenue: Math.round((weights.gross_sales ?? 0.25) * 100),
    tgls: Math.round((weights.tgls ?? 0.15) * 100),
    opts: Math.round((weights.options_per_opportunity ?? 0.15) * 100),
    memberships: Math.round((weights.memberships_sold ?? 0.15) * 100),
    reviews: Math.round((weights.reviews ?? 0.15) * 100),
    attendance: Math.round((weights.attendance ?? 0.15) * 100),
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg p-4 text-left text-sm shadow-xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>How Scoring Works</p>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }} className="p-1 rounded hover:bg-[var(--bg-card-hover)]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3" style={{ color: 'var(--text-secondary)' }}>
        <p>
          Each technician is <strong style={{ color: 'var(--text-primary)' }}>ranked</strong> in every category. Rankings are converted to a percentile score:
        </p>
        <div className="rounded-md p-2 font-mono text-xs" style={{ background: 'var(--bg-secondary)' }}>
          1st of 10 = 100 &middot; 5th of 10 = 60 &middot; 10th of 10 = 10
        </div>
        <p>
          The overall score is the <strong style={{ color: 'var(--text-primary)' }}>weighted average</strong> of those percentiles:
        </p>
        <div className="space-y-1">
          <WeightRow label="Sales" pct={w.revenue} />
          <WeightRow label="Leads Set" pct={w.tgls} />
          <WeightRow label="Opts/Opp" pct={w.opts} />
          <WeightRow label="Memberships" pct={w.memberships} />
          <WeightRow label="Reviews" pct={w.reviews} />
          <WeightRow label="Attendance" pct={w.attendance} />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Weights are configurable in Settings. Click any row to see the score breakdown.
        </p>
      </div>
    </div>
  );
}

function WeightRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: 'var(--christmas-green-light)' }}
          />
        </div>
        <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
      </div>
    </div>
  );
}

interface DrillDownState {
  techName: string;
  stTechId: number;
  metric: Metric;
}

interface Props {
  data: LeaderboardEntry[];
  weights: Record<string, number>;
  startDate: string;
  endDate: string;
}

export default function LeaderboardTable({ data, weights, startDate, endDate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank' || key === 'name');
    }
  };

  const sorted = [...data].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else {
      cmp = (a[sortKey] as number) - (b[sortKey] as number);
    }
    return sortAsc ? cmp : -cmp;
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="ml-1 opacity-30">&#8597;</span>;
    return <span className="ml-1">{sortAsc ? '&#9650;' : '&#9660;'}</span>;
  };

  const openDrillDown = (entry: LeaderboardEntry, metric: Metric, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrillDown({
      techName: entry.name,
      stTechId: entry.st_technician_id,
      metric,
    });
  };

  if (data.length === 0) {
    return (
      <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
        <p className="text-lg mb-2">No data for this period</p>
        <p className="text-sm">Try selecting a different date range or run a sync.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card p-0 overflow-hidden">
        <div className="table-wrapper">
          <table className="lb-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('rank')} style={{ width: '60px' }}>
                  Rank <SortIcon column="rank" />
                </th>
                <th onClick={() => handleSort('name')}>
                  Technician <SortIcon column="name" />
                </th>
                <th onClick={() => handleSort('gross_sales')} className="text-right">
                  Sales <SortIcon column="gross_sales" />
                </th>
                <th onClick={() => handleSort('tgls')} className="text-right">
                  Leads Set <SortIcon column="tgls" />
                </th>
                <th onClick={() => handleSort('options_per_opportunity')} className="text-right">
                  Opts/Opp <SortIcon column="options_per_opportunity" />
                </th>
                <th onClick={() => handleSort('reviews')} className="text-right">
                  Reviews <SortIcon column="reviews" />
                </th>
                <th onClick={() => handleSort('memberships_sold')} className="text-right">
                  Memberships <SortIcon column="memberships_sold" />
                </th>
                <th onClick={() => handleSort('attendance_points')} className="text-right">
                  Attendance <SortIcon column="attendance_points" />
                </th>
                <th className="text-right relative">
                  <span className="inline-flex items-center gap-1">
                    <span onClick={() => handleSort('score')} className="cursor-pointer">
                      Score <SortIcon column="score" />
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                      className="p-0.5 rounded hover:bg-[var(--bg-card-hover)] transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      title="How scoring works"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </span>
                  {showInfo && <ScoringInfoPopover weights={weights} onClose={() => setShowInfo(false)} />}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <>
                  <tr
                    key={entry.technician_id}
                    onClick={() => setExpandedRow(expandedRow === entry.technician_id ? null : entry.technician_id)}
                    className="cursor-pointer"
                    style={{
                      background: entry.rank <= 3 ? `rgba(${entry.rank === 1 ? '255,215,0' : entry.rank === 2 ? '192,192,192' : '205,127,50'}, 0.05)` : undefined,
                    }}
                  >
                    <td className="text-center">
                      <RankBadge rank={entry.rank} />
                    </td>
                    <td>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {entry.name}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'gross_sales', e)}
                        className="font-mono metric-link"
                        title="View sold estimates"
                      >
                        {formatCurrency(entry.gross_sales)}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'tgls', e)}
                        className="font-mono metric-link"
                        title="View leads set"
                      >
                        {entry.tgls}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'options_per_opportunity', e)}
                        className="font-mono metric-link"
                        title="View options per opportunity"
                      >
                        {entry.options_per_opportunity.toFixed(2)}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'reviews', e)}
                        className="font-mono metric-link"
                        title="View reviews"
                      >
                        {entry.reviews}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'memberships_sold', e)}
                        className="font-mono metric-link"
                        title="View memberships sold"
                      >
                        {entry.memberships_sold}
                      </button>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={(e) => openDrillDown(entry, 'attendance', e)}
                        className="font-mono metric-link"
                        title="View attendance records"
                        style={{
                          color: entry.attendance_points === 0
                            ? 'var(--status-success)'
                            : entry.attendance_points >= 3
                              ? 'var(--status-error)'
                              : 'var(--christmas-gold)',
                        }}
                      >
                        {entry.attendance_points}
                      </button>
                    </td>
                    <td className="text-right">
                      <span
                        className="font-bold text-lg"
                        style={{ color: 'var(--christmas-green-light)' }}
                      >
                        {(entry.score * 100).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                  {expandedRow === entry.technician_id && (
                    <tr key={`${entry.technician_id}-detail`}>
                      <td colSpan={9} style={{ background: 'var(--bg-secondary)', padding: '1rem 1.5rem' }}>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Score Breakdown</p>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Sales</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.gross_sales_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.gross_sales || 0.25) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Leads Set</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.tgls_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.tgls || 0.15) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Opts/Opp</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.options_per_opportunity_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.options_per_opportunity || 0.15) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Reviews</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.reviews_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.reviews || 0.15) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Memberships</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.memberships_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.memberships_sold || 0.15) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Attendance</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono">{(entry.score_breakdown.attendance_score * 100).toFixed(1)}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>x {((weights.attendance || 0.15) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drillDown && (
        <DrillDownModal
          techName={drillDown.techName}
          stTechId={drillDown.stTechId}
          metric={drillDown.metric}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setDrillDown(null)}
        />
      )}
    </>
  );
}
