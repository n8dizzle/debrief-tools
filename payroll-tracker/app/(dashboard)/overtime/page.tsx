'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatDate } from '@/lib/payroll-utils';
import DepartmentFilter from '@/components/DepartmentFilter';

interface WeeklyData {
  week: string;
  label: string;
  ot_hours: number;
  ot_amount: number;
  regular_hours: number;
  items: { date: string; job_number: string | null; activity: string | null; hours: number; amount: number }[];
}

interface OTEmployee {
  employee_id: string;
  name: string;
  department: string | null;
  weeks_with_ot: number;
  total_weeks: number;
  frequency: number;
  total_hours: number;
  total_amount: number;
  avg_per_week: number;
  current_streak: number;
  weekly: WeeklyData[];
}

interface WeekInfo {
  start: string;
  label: string;
}

interface OvertimeData {
  employees: OTEmployee[];
  weeks: WeekInfo[];
  total_weeks: number;
  range: { start: string; end: string };
  can_view_pay: boolean;
}

function DeptBadge({ department }: { department: string | null }) {
  if (!department) return null;
  return (
    <span
      className="badge ml-2"
      style={{
        backgroundColor: 'rgba(107, 124, 110, 0.15)',
        color: 'var(--text-secondary)',
      }}
    >
      {department}
    </span>
  );
}

function FrequencyBar({ frequency }: { frequency: number }) {
  const color = frequency >= 75 ? 'var(--status-error, #ef4444)'
    : frequency >= 50 ? 'var(--status-warning)'
    : frequency >= 25 ? 'var(--christmas-gold)'
    : 'var(--christmas-green-light)';

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 rounded-full"
        style={{ width: '60px', backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${frequency}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-medium" style={{ color, minWidth: '36px' }}>
        {frequency}%
      </span>
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 1) return null;
  const color = streak >= 6 ? 'var(--status-error, #ef4444)'
    : streak >= 4 ? 'var(--status-warning)'
    : 'var(--christmas-gold)';

  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {streak}w streak
    </span>
  );
}

function HeatmapCell({ hours, maxHours }: { hours: number; maxHours: number }) {
  if (hours === 0) {
    return (
      <td className="text-center" style={{ padding: '4px 2px' }}>
        <div
          className="w-full h-6 rounded"
          style={{ backgroundColor: 'var(--bg-primary)', minWidth: '28px' }}
        />
      </td>
    );
  }

  const intensity = Math.min(hours / Math.max(maxHours, 1), 1);
  const alpha = 0.2 + intensity * 0.6;

  return (
    <td className="text-center" style={{ padding: '4px 2px' }}>
      <div
        className="w-full h-6 rounded flex items-center justify-center text-xs font-medium"
        style={{
          backgroundColor: `rgba(234, 179, 8, ${alpha})`,
          color: intensity > 0.5 ? '#000' : 'var(--status-warning)',
          minWidth: '28px',
        }}
        title={`${formatHours(hours)} hrs OT`}
      >
        {formatHours(hours)}
      </div>
    </td>
  );
}

export default function OvertimePage() {
  const { canViewPayAmounts, isManager, isOwner, isLoading: permLoading } = usePayrollPermissions();
  const [data, setData] = useState<OvertimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeksBack, setWeeksBack] = useState(12);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'frequency' | 'total_hours' | 'avg' | 'streak'>('frequency');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ weeks: String(weeksBack) });
      if (selectedDepts.length > 0) params.set('departments', selectedDepts.join(','));
      const res = await fetch(`/api/overtime?${params}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        if (result.business_units) {
          setBusinessUnits(result.business_units);
        }
      }
    } catch (err) {
      console.error('Failed to load overtime data:', err);
    } finally {
      setLoading(false);
    }
  }, [weeksBack, selectedDepts]);

  useEffect(() => {
    if (!permLoading && (isManager || isOwner)) loadData();
  }, [loadData, permLoading, isManager, isOwner]);

  if (permLoading) return null;

  if (!isManager && !isOwner) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        You do not have permission to view this page.
      </div>
    );
  }

  const sortedEmployees = data ? [...data.employees].sort((a, b) => {
    switch (sortBy) {
      case 'total_hours': return b.total_hours - a.total_hours;
      case 'avg': return b.avg_per_week - a.avg_per_week;
      case 'streak': return b.current_streak - a.current_streak || b.frequency - a.frequency;
      default: return b.frequency - a.frequency || b.total_hours - a.total_hours;
    }
  }) : [];

  // Max OT hours in any single week (for heatmap scaling)
  const maxWeeklyHours = data
    ? Math.max(...data.employees.flatMap(e => e.weekly.map(w => w.ot_hours)), 1)
    : 1;

  // Summary stats
  const habitualCount = data ? data.employees.filter(e => e.frequency >= 50).length : 0;
  const totalOTHours = data ? data.employees.reduce((s, e) => s + e.total_hours, 0) : 0;
  const totalOTAmount = data ? data.employees.reduce((s, e) => s + e.total_amount, 0) : 0;
  const activeStreaks = data ? data.employees.filter(e => e.current_streak >= 3).length : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Overtime Analysis
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Lookback</label>
          <div className="flex gap-1">
            {[8, 12, 16, 24].map(w => (
              <button
                key={w}
                onClick={() => setWeeksBack(w)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: weeksBack === w ? 'var(--christmas-green)' : 'var(--bg-card)',
                  color: weeksBack === w ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  border: `1px solid ${weeksBack === w ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                }}
              >
                {w}w
              </button>
            ))}
          </div>
        </div>
        <DepartmentFilter
          departments={businessUnits}
          selected={selectedDepts}
          onChange={setSelectedDepts}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="select text-sm"
          >
            <option value="frequency">Frequency</option>
            <option value="total_hours">Total OT Hours</option>
            <option value="avg">Avg OT/Week</option>
            <option value="streak">Current Streak</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : data && data.employees.length === 0 ? (
        <div className="card flex items-center justify-center py-12">
          <div className="flex items-center gap-2" style={{ color: 'var(--status-success)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">No overtime recorded in this period</span>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4">
              <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Habitual OT</div>
              <div className="text-2xl font-bold" style={{ color: habitualCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                {habitualCount}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>employees 50%+ weeks</div>
            </div>
            <div className="card p-4">
              <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Total OT Hours</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                {formatHours(totalOTHours)}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>across {data.total_weeks} weeks</div>
            </div>
            {canViewPayAmounts && (
              <div className="card p-4">
                <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Total OT Cost</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                  {formatCurrency(totalOTAmount)}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>across {data.total_weeks} weeks</div>
              </div>
            )}
            <div className="card p-4">
              <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Active Streaks</div>
              <div className="text-2xl font-bold" style={{ color: activeStreaks > 0 ? 'var(--status-error, #ef4444)' : 'var(--status-success)' }}>
                {activeStreaks}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>3+ consecutive weeks</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="card p-0 overflow-hidden mb-6">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>OT Heatmap</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Weekly overtime hours per employee &middot; Darker = more hours
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: `${200 + data.weeks.length * 44}px` }}>
                <thead>
                  <tr>
                    <th
                      className="text-left text-xs font-medium sticky left-0 z-10 px-4 py-2"
                      style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', minWidth: '160px' }}
                    >
                      Employee
                    </th>
                    {data.weeks.map(w => (
                      <th
                        key={w.start}
                        className="text-center text-xs font-normal px-1 py-2"
                        style={{ color: 'var(--text-muted)', minWidth: '40px' }}
                        title={w.label}
                      >
                        {w.label.split(' - ')[0]}
                      </th>
                    ))}
                    <th
                      className="text-center text-xs font-medium px-3 py-2"
                      style={{ color: 'var(--text-muted)', minWidth: '60px' }}
                    >
                      Freq
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map(emp => (
                    <tr key={emp.employee_id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td
                        className="text-sm font-medium sticky left-0 z-10 px-4 py-1"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-cream)' }}
                      >
                        <Link
                          href={`/employees/${emp.employee_id}`}
                          style={{ color: 'var(--christmas-green-light)' }}
                          className="hover:underline"
                        >
                          {emp.name}
                        </Link>
                        <DeptBadge department={emp.department} />
                      </td>
                      {emp.weekly.map(w => (
                        <HeatmapCell key={w.week} hours={w.ot_hours} maxHours={maxWeeklyHours} />
                      ))}
                      <td className="text-center px-3">
                        <FrequencyBar frequency={emp.frequency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Table */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Employee Breakdown</h2>
            </div>
            <div className="table-wrapper">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th style={{ width: '24px' }}></th>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th className="text-center">Frequency</th>
                    <th className="text-center">Streak</th>
                    <th className="text-right">Total OT Hrs</th>
                    <th className="text-right">Avg OT/Wk</th>
                    {canViewPayAmounts && <th className="text-right">Total OT Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map(emp => (
                    <>
                      <tr
                        key={emp.employee_id}
                        className="cursor-pointer"
                        onClick={() => setExpandedEmployee(expandedEmployee === emp.employee_id ? null : emp.employee_id)}
                        style={{ backgroundColor: expandedEmployee === emp.employee_id ? 'var(--bg-secondary)' : undefined }}
                      >
                        <td>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedEmployee === emp.employee_id ? 'rotate-90' : ''}`}
                            style={{ color: 'var(--text-muted)' }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td>
                          <Link
                            href={`/employees/${emp.employee_id}`}
                            className="font-medium hover:underline"
                            style={{ color: 'var(--christmas-green-light)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {emp.name}
                          </Link>
                        </td>
                        <td><DeptBadge department={emp.department} /></td>
                        <td className="text-center">
                          <FrequencyBar frequency={emp.frequency} />
                        </td>
                        <td className="text-center">
                          <StreakBadge streak={emp.current_streak} />
                          {emp.current_streak <= 1 && (
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {emp.current_streak === 1 ? '1w' : '-'}
                            </span>
                          )}
                        </td>
                        <td className="text-right font-medium" style={{ color: 'var(--status-warning)' }}>
                          {formatHours(emp.total_hours)}
                        </td>
                        <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                          {formatHours(emp.avg_per_week)}
                        </td>
                        {canViewPayAmounts && (
                          <td className="text-right">{formatCurrency(emp.total_amount)}</td>
                        )}
                      </tr>
                      {expandedEmployee === emp.employee_id && (
                        <>
                          {/* Week-by-week breakdown */}
                          <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <td></td>
                            <td colSpan={canViewPayAmounts ? 7 : 6} style={{ padding: 0 }}>
                              <table className="w-full">
                                <thead>
                                  <tr>
                                    <th className="text-left text-xs py-2 px-4" style={{ color: 'var(--text-muted)' }}>Week</th>
                                    <th className="text-right text-xs py-2 px-4" style={{ color: 'var(--text-muted)' }}>Regular Hrs</th>
                                    <th className="text-right text-xs py-2 px-4" style={{ color: 'var(--text-muted)' }}>OT Hrs</th>
                                    {canViewPayAmounts && (
                                      <th className="text-right text-xs py-2 px-4" style={{ color: 'var(--text-muted)' }}>OT Cost</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {emp.weekly.filter(w => w.ot_hours > 0).map(w => (
                                    <tr key={w.week} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                      <td className="text-sm py-1.5 px-4" style={{ color: 'var(--text-secondary)' }}>
                                        {w.label}
                                      </td>
                                      <td className="text-right text-sm py-1.5 px-4" style={{ color: 'var(--text-muted)' }}>
                                        {formatHours(w.regular_hours)}
                                      </td>
                                      <td className="text-right text-sm py-1.5 px-4" style={{ color: 'var(--status-warning)' }}>
                                        {formatHours(w.ot_hours)}
                                      </td>
                                      {canViewPayAmounts && (
                                        <td className="text-right text-sm py-1.5 px-4" style={{ color: 'var(--text-secondary)' }}>
                                          {formatCurrency(w.ot_amount)}
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </>
                      )}
                    </>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                    <td></td>
                    <td style={{ color: 'var(--text-muted)' }}>Total ({sortedEmployees.length} employees)</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="text-right" style={{ color: 'var(--status-warning)' }}>
                      {formatHours(totalOTHours)}
                    </td>
                    <td></td>
                    {canViewPayAmounts && (
                      <td className="text-right">{formatCurrency(totalOTAmount)}</td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
