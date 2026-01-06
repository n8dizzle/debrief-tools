'use client';

import { useState, useEffect } from 'react';
import { HuddleHistoricalResponse, HuddleKPIStatus } from '@/lib/supabase';
import { formatKPIValue, formatDateForDisplay, statusBackgrounds, statusColors } from '@/lib/huddle-utils';

interface HistoricalTableProps {
  days?: number;
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
        // Expand all departments by default
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

  // Reverse dates for display (most recent first)
  const displayDates = [...data.dates].reverse();

  return (
    <div className="space-y-4">
      {data.departments.map((dept) => (
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
            <h3
              className="font-semibold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              {dept.name}
            </h3>
            <svg
              className={`w-5 h-5 transition-transform ${
                expandedDepts.has(dept.id) ? 'rotate-180' : ''
              }`}
              style={{ color: 'var(--text-secondary)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Historical Table */}
          {expandedDepts.has(dept.id) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th
                      className="text-left py-2 px-3 font-medium sticky left-0"
                      style={{
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-secondary)',
                        minWidth: '180px',
                      }}
                    >
                      KPI
                    </th>
                    {displayDates.map((date) => (
                      <th
                        key={date}
                        className="text-center py-2 px-3 font-medium"
                        style={{
                          color: 'var(--text-muted)',
                          minWidth: '90px',
                        }}
                      >
                        <div className="text-xs">
                          {formatDateForDisplay(date).split(',')[0]}
                        </div>
                        <div className="text-xs opacity-60">
                          {date.split('-').slice(1).join('/')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dept.kpis.map((kpi) => (
                    <tr
                      key={kpi.id}
                      className="border-t"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <td
                        className="py-2 px-3 sticky left-0"
                        style={{
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-card)',
                        }}
                      >
                        {kpi.name}
                      </td>
                      {displayDates.map((date) => {
                        const value = kpi.values.find((v) => v.date === date);
                        const status = value?.status || 'pending';
                        const actual = value?.actual;
                        const formatted = formatKPIValue(
                          actual,
                          kpi.format as any,
                          kpi.unit
                        );

                        return (
                          <td
                            key={date}
                            className="py-2 px-3 text-center font-medium"
                            style={{
                              backgroundColor: statusBackgrounds[status as HuddleKPIStatus],
                              color: actual !== null
                                ? statusColors[status as HuddleKPIStatus]
                                : 'var(--text-muted)',
                            }}
                            title={value?.note || undefined}
                          >
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-4">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusBackgrounds.met }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Met/Exceeded
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusBackgrounds.close }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Close (85-99%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded"
            style={{ backgroundColor: statusBackgrounds.missed }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Missed (&lt;85%)
          </span>
        </div>
      </div>
    </div>
  );
}
