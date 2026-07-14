'use client';

import { useState, useEffect } from 'react';
import { HuddleHistoricalResponse, HuddleKPIStatus } from '@/lib/supabase';
import {
  formatKPIValue,
  formatCurrencyCompact,
  formatDateForDisplay,
  statusBackgrounds,
  statusColors,
  getStatusFromPercentage,
} from '@/lib/huddle-utils';

interface HistoricalTableProps {
  days?: number;
}

// Helper: get a KPI's actual value for a date
function getKPIValue(
  kpis: HuddleHistoricalResponse['departments'][0]['kpis'],
  slug: string,
  date: string
): number | null {
  const kpi = kpis.find((k) => k.slug === slug);
  if (!kpi) return null;
  const val = kpi.values.find((v) => v.date === date);
  return val?.actual ?? null;
}

// Helper: get the first non-null value for a KPI across dates (for stable target display)
function getFirstValue(
  kpis: HuddleHistoricalResponse['departments'][0]['kpis'],
  slug: string,
  dates: string[]
): number | null {
  const kpi = kpis.find((k) => k.slug === slug);
  if (!kpi) return null;
  for (const date of dates) {
    const val = kpi.values.find((v) => v.date === date);
    if (val?.actual !== null && val?.actual !== undefined) return val.actual;
  }
  return null;
}

// Pacing row definition
interface PacingRow {
  label: string;
  targetLabel?: string; // e.g. "of $459K"
  type: 'pacing' | 'utility';
  getValue: (date: string) => number | null;
  getPercent?: (date: string) => number | null;
}

export default function HistoricalTable({ days = 7 }: HistoricalTableProps) {
  const [data, setData] = useState<HuddleHistoricalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/huddle/snapshots?days=${days}`);
        if (!response.ok) throw new Error('Failed to fetch historical data');
        const result = await response.json();
        setData(result);
        setExpandedDepts(new Set(result.departments.map((d: any) => d.id)));
      } catch (err) {
        setError('Failed to load historical data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [days]);

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
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
          <span style={{ color: 'var(--text-secondary)' }}>Loading history...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
        }}
      >
        <p style={{ color: '#dc2626' }}>{error || 'No data available'}</p>
      </div>
    );
  }

  const displayDates = [...data.dates].reverse();

  // Find christmas-overall department for daily revenue cross-reference
  const overallDept = data.departments.find((d) => d.slug === 'christmas-overall');

  return (
    <div className="space-y-4">
      {data.departments.map((dept) => {
        const isPacingDept = dept.slug === 'christmas-pacing';

        return (
          <div
            key={dept.id}
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Department Header */}
            <button
              onClick={() => toggleDept(dept.id)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {dept.name}
              </h3>
              <svg
                className={`w-5 h-5 transition-transform ${expandedDepts.has(dept.id) ? 'rotate-180' : ''}`}
                style={{ color: 'var(--text-secondary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Table Content */}
            {expandedDepts.has(dept.id) && (
              <div className="overflow-x-auto">
                {isPacingDept ? (
                  <PacingTable
                    dept={dept}
                    overallDept={overallDept}
                    displayDates={displayDates}
                  />
                ) : (
                  <GenericTable dept={dept} displayDates={displayDates} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-4">
        {(['met', 'close', 'missed'] as const).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: statusBackgrounds[status] }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {status === 'met' ? 'Met/Exceeded' : status === 'close' ? 'Close (90-99%)' : 'Missed (<90%)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Generic table (unchanged behavior for all other departments)
// ============================================
function GenericTable({
  dept,
  displayDates,
}: {
  dept: HuddleHistoricalResponse['departments'][0];
  displayDates: string[];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <th
            className="text-left py-2 px-3 font-medium sticky left-0"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', minWidth: '180px' }}
          >
            KPI
          </th>
          {displayDates.map((date) => (
            <th key={date} className="text-center py-2 px-3 font-medium" style={{ color: 'var(--text-muted)', minWidth: '90px' }}>
              <div className="text-xs">{formatDateForDisplay(date).split(',')[0]}</div>
              <div className="text-xs opacity-60">{date.split('-').slice(1).join('/')}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dept.kpis.map((kpi) => (
          <tr key={kpi.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <td className="py-2 px-3 sticky left-0" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}>
              {kpi.name}
            </td>
            {displayDates.map((date) => {
              const value = kpi.values.find((v) => v.date === date);
              const status = value?.status || 'pending';
              const actual = value?.actual;
              const formatted = formatKPIValue(actual, kpi.format as any, kpi.unit);

              return (
                <td
                  key={date}
                  className="py-2 px-3 text-center font-medium relative group"
                  style={{
                    backgroundColor: statusBackgrounds[status as HuddleKPIStatus],
                    color: actual !== null ? statusColors[status as HuddleKPIStatus] : 'var(--text-muted)',
                  }}
                >
                  {formatted}
                  {value?.note && (
                    <>
                      <svg className="w-3 h-3 absolute top-1 right-1 opacity-40 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <div
                        className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs text-left whitespace-normal max-w-[200px] hidden group-hover:block"
                        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                      >
                        {value.note}
                      </div>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================
// Custom compact Christmas Pacing table
// ============================================
function PacingTable({
  dept,
  overallDept,
  displayDates,
}: {
  dept: HuddleHistoricalResponse['departments'][0];
  overallDept?: HuddleHistoricalResponse['departments'][0];
  displayDates: string[];
}) {
  const kpis = dept.kpis;
  const overallKpis = overallDept?.kpis || [];

  // Get stable target values (first non-null across dates)
  const weeklyTarget = getFirstValue(kpis, 'weekly-target', displayDates);
  const monthlyTarget = getFirstValue(kpis, 'monthly-target', displayDates);
  const dailyTarget = weeklyTarget ? weeklyTarget / 5.5 : null;

  // Format target labels
  const fmtTarget = (val: number | null, prefix: string = 'of') =>
    val ? `${prefix} ${formatCurrencyCompact(val)}` : '';

  // Build row definitions
  const rows: PacingRow[] = [
    {
      label: 'Daily',
      targetLabel: fmtTarget(dailyTarget),
      type: 'pacing',
      getValue: (date) => getKPIValue(overallKpis, 'total-revenue', date),
      getPercent: (date) => {
        const actual = getKPIValue(overallKpis, 'total-revenue', date);
        if (actual === null || !dailyTarget) return null;
        return (actual / dailyTarget) * 100;
      },
    },
    {
      label: 'Weekly',
      targetLabel: fmtTarget(weeklyTarget),
      type: 'pacing',
      getValue: (date) => getKPIValue(kpis, 'weekly-to-date', date),
      getPercent: (date) => {
        const actual = getKPIValue(kpis, 'weekly-to-date', date);
        if (actual === null || !weeklyTarget) return null;
        return (actual / weeklyTarget) * 100;
      },
    },
    {
      label: 'Monthly',
      targetLabel: fmtTarget(monthlyTarget),
      type: 'pacing',
      getValue: (date) => getKPIValue(kpis, 'monthly-to-date', date),
      getPercent: (date) => {
        const actual = getKPIValue(kpis, 'monthly-to-date', date);
        if (actual === null || !monthlyTarget) return null;
        return (actual / monthlyTarget) * 100;
      },
    },
    {
      label: 'Pacing',
      targetLabel: fmtTarget(monthlyTarget, 'vs'),
      type: 'pacing',
      getValue: (date) => getKPIValue(kpis, 'current-pacing', date),
      getPercent: (date) => {
        const actual = getKPIValue(kpis, 'current-pacing', date);
        if (actual === null || !monthlyTarget) return null;
        return (actual / monthlyTarget) * 100;
      },
    },
    {
      label: 'Biz Days Left',
      type: 'utility',
      getValue: (date) => getKPIValue(kpis, 'business-days-remaining', date),
    },
    {
      label: 'Daily Pace',
      type: 'utility',
      getValue: (date) => getKPIValue(kpis, 'daily-pace-needed', date),
    },
    {
      label: 'Adj. Revenue',
      type: 'utility',
      getValue: (date) => getKPIValue(kpis, 'adj-revenue', date),
    },
  ];

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <th
            className="text-left py-2 px-3 font-medium sticky left-0"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', minWidth: '150px' }}
          >
            KPI
          </th>
          {displayDates.map((date) => (
            <th key={date} className="text-center py-2 px-3 font-medium" style={{ color: 'var(--text-muted)', minWidth: '90px' }}>
              <div className="text-xs">{formatDateForDisplay(date).split(',')[0]}</div>
              <div className="text-xs opacity-60">{date.split('-').slice(1).join('/')}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isPacing = row.type === 'pacing';

          return (
            <tr
              key={row.label}
              className="border-t"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              {/* KPI name cell with optional target sub-label */}
              <td
                className="py-2 px-3 sticky left-0"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.label}
                </div>
                {row.targetLabel && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {row.targetLabel}
                  </div>
                )}
              </td>

              {/* Date cells */}
              {displayDates.map((date) => {
                const actual = row.getValue(date);
                const pct = isPacing && row.getPercent ? row.getPercent(date) : null;
                const status: HuddleKPIStatus = pct !== null
                  ? getStatusFromPercentage(pct, true)
                  : 'pending';

                if (isPacing) {
                  return (
                    <td
                      key={date}
                      className="py-2 px-3 text-center"
                      style={{
                        backgroundColor: statusBackgrounds[status],
                      }}
                    >
                      <div className="font-semibold" style={{
                        color: actual !== null ? statusColors[status] : 'var(--text-muted)',
                      }}>
                        {actual !== null ? formatCurrencyCompact(actual) : '-'}
                      </div>
                      {pct !== null && (
                        <div className="text-xs mt-0.5" style={{ color: statusColors[status], opacity: 0.8 }}>
                          {Math.round(pct)}%
                        </div>
                      )}
                    </td>
                  );
                }

                // Utility rows: simple single-line
                const isNegative = actual !== null && actual < 0;
                const isCurrency = row.label === 'Daily Pace' || row.label === 'Adj. Revenue';
                let formatted: string;
                if (actual === null) {
                  formatted = '-';
                } else if (isCurrency) {
                  formatted = formatCurrencyCompact(actual);
                } else {
                  formatted = actual.toLocaleString('en-US', { maximumFractionDigits: 1 });
                }

                return (
                  <td
                    key={date}
                    className="py-2 px-3 text-center font-medium"
                    style={{
                      color: isNegative ? '#dc2626' : 'var(--text-secondary)',
                    }}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
