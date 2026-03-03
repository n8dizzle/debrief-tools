'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatDate } from '@/lib/payroll-utils';

interface PeriodRow {
  id: string;
  st_payroll_id: number;
  start_date: string;
  end_date: string;
  check_date: string | null;
  status: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_pay: number;
  performance_pay: number;
  employee_count: number;
}

export default function PeriodsPage() {
  const { canViewPayAmounts } = usePayrollPermissions();
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/periods');
        if (res.ok) {
          const data = await res.json();
          setPeriods(data.periods || []);
        }
      } catch (err) {
        console.error('Failed to load periods:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Pay Periods
      </h1>

      <div className="space-y-3">
        {periods.length === 0 ? (
          <div className="card text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No payroll periods found. Run a sync to pull data from ServiceTitan.
          </div>
        ) : (
          periods.map((period, idx) => {
            const prevPeriod = periods[idx + 1]; // previous period (sorted desc)
            const isExpanded = expandedId === period.id;

            return (
              <div key={period.id} className="card" style={{ padding: 0 }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : period.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatDate(period.start_date)} - {formatDate(period.end_date)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {period.employee_count} employees
                        {period.check_date && ` \u00B7 Check: ${formatDate(period.check_date)}`}
                      </div>
                    </div>
                    {period.status && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: period.status === 'Processed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: period.status === 'Processed' ? 'var(--status-success)' : 'var(--status-info)',
                        }}
                      >
                        {period.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {formatHours(period.total_hours)} hrs
                      </div>
                      {canViewPayAmounts && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(period.total_pay)}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-muted)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-3">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Regular</div>
                        <div className="font-medium">{formatHours(period.regular_hours)} hrs</div>
                      </div>
                      <div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Overtime</div>
                        <div className="font-medium" style={{ color: period.overtime_hours > 0 ? 'var(--status-warning)' : 'inherit' }}>
                          {formatHours(period.overtime_hours)} hrs
                        </div>
                      </div>
                      {canViewPayAmounts && (
                        <>
                          <div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Performance Pay</div>
                            <div className="font-medium" style={{ color: period.performance_pay > 0 ? 'var(--status-success)' : 'inherit' }}>
                              {formatCurrency(period.performance_pay)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Avg $/hr</div>
                            <div className="font-medium">
                              {period.total_hours > 0 ? formatCurrency(period.total_pay / period.total_hours) : '-'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Period-over-period comparison */}
                    {prevPeriod && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                          vs Previous Period
                        </div>
                        <div className="flex gap-4 text-sm">
                          <ComparisonBadge
                            label="Hours"
                            current={period.total_hours}
                            previous={prevPeriod.total_hours}
                            format={(v) => formatHours(v)}
                          />
                          {canViewPayAmounts && (
                            <ComparisonBadge
                              label="Pay"
                              current={period.total_pay}
                              previous={prevPeriod.total_pay}
                              format={(v) => formatCurrency(v)}
                            />
                          )}
                          <ComparisonBadge
                            label="OT"
                            current={period.overtime_hours}
                            previous={prevPeriod.overtime_hours}
                            format={(v) => formatHours(v)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <Link
                        href={`/periods/${period.id}`}
                        className="text-sm font-medium"
                        style={{ color: 'var(--christmas-green-light)' }}
                      >
                        View Full Details →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ComparisonBadge({
  label,
  current,
  previous,
  format,
}: {
  label: string;
  current: number;
  previous: number;
  format: (v: number) => string;
}) {
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(1) : '0';
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex items-center gap-1">
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span
        style={{
          color: isUp ? 'var(--status-success)' : isDown ? 'var(--status-error)' : 'var(--text-secondary)',
        }}
      >
        {isUp ? '+' : ''}{pct}%
      </span>
    </div>
  );
}
