'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatDate, formatTimestamp, getCurrentPayWeekRange, getPayPeriodPresets } from '@/lib/payroll-utils';
import DepartmentFilter from '@/components/DepartmentFilter';

interface OTItem {
  date: string;
  st_job_id: number | null;
  job_number: string | null;
  activity: string | null;
  hours: number;
  amount: number;
}

interface OTEmployee {
  employee_id: string;
  name: string;
  total_hours: number;
  total_amount: number;
  items: OTItem[];
}

interface SuspiciousEntry {
  date: string;
  employee_id: string;
  employee_name: string;
  st_job_id: number | null;
  job_number: string | null;
  duration_hours: number;
  clock_in: string | null;
  clock_out: string | null;
  flags: string[];
}

interface PTOItem {
  date: string;
  activity: string | null;
  pay_type: string;
  hours: number;
  amount: number;
}

interface PTOEmployee {
  employee_id: string;
  name: string;
  total_hours: number;
  total_amount: number;
  items: PTOItem[];
}

interface ReviewData {
  overtime: { employees: OTEmployee[]; total_hours: number; total_amount: number; count: number };
  suspicious: { entries: SuspiciousEntry[]; count: number };
  pto: { employees: PTOEmployee[]; total_hours: number; count: number };
  business_units: string[];
  can_view_pay: boolean;
}

function JobLink({ stJobId, jobNumber }: { stJobId: number | null; jobNumber: string | null }) {
  if (!stJobId) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  return (
    <a
      href={`https://go.servicetitan.com/#/Job/Index/${stJobId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--christmas-green-light)' }}
    >
      {jobNumber || stJobId}
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center" style={{ color: 'var(--status-success)' }}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-medium">No {label} found — all clear</span>
    </div>
  );
}

export default function ReviewsPage() {
  const searchParams = useSearchParams();
  const { canViewPayAmounts, isManager, isOwner, isLoading: permLoading } = usePayrollPermissions();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start && end) return { start, end };
    return getCurrentPayWeekRange();
  });
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, Set<string>>>({
    overtime: new Set(),
    pto: new Set(),
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    overtime: false,
    suspicious: false,
    pto: false,
  });

  const toggleExpand = (section: string, id: string) => {
    setExpanded(prev => {
      const s = new Set(prev[section]);
      if (s.has(id)) s.delete(id); else s.add(id);
      return { ...prev, [section]: s };
    });
  };

  const toggleCollapse = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
      if (selectedDepts.length > 0) params.set('departments', selectedDepts.join(','));
      const res = await fetch(`/api/reviews?${params}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setBusinessUnits(result.business_units || []);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedDepts]);

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Payroll Review
      </h1>

      {/* Pay Period Presets */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {getPayPeriodPresets().map(preset => {
          const isActive = dateRange.start === preset.start && dateRange.end === preset.end;
          return (
            <button
              key={preset.label}
              onClick={() => setDateRange({ start: preset.start, end: preset.end })}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: isActive ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--christmas-green)' : 'var(--border-default)'}`,
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Date range + trade filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
        <DepartmentFilter
          departments={businessUnits}
          selected={selectedDepts}
          onChange={setSelectedDepts}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Overtime Section */}
          <div className="card p-0 overflow-hidden">
            <button
              onClick={() => toggleCollapse('overtime')}
              className="w-full flex items-center justify-between p-4 text-left"
              style={{ borderBottom: collapsed.overtime ? 'none' : '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: 'var(--status-warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Overtime</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: data.overtime.count > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: data.overtime.count > 0 ? 'var(--status-warning)' : 'var(--status-success)',
                  }}
                >
                  {data.overtime.count}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {data.overtime.count > 0 && (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatHours(data.overtime.total_hours)} hrs
                    {canViewPayAmounts && <> &middot; {formatCurrency(data.overtime.total_amount)}</>}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 transition-transform ${collapsed.overtime ? '' : 'rotate-180'}`}
                  style={{ color: 'var(--text-muted)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {!collapsed.overtime && (
              data.overtime.count === 0 ? (
                <EmptyState label="overtime" />
              ) : (
                <div className="table-wrapper">
                  <table className="pr-table">
                    <thead>
                      <tr>
                        <th style={{ width: '24px' }}></th>
                        <th>Employee</th>
                        <th className="text-right">OT Hours</th>
                        {canViewPayAmounts && <th className="text-right">OT Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.overtime.employees.map(emp => (
                        <>
                          <tr
                            key={emp.employee_id}
                            className="cursor-pointer"
                            onClick={() => toggleExpand('overtime', emp.employee_id)}
                            style={{ backgroundColor: expanded.overtime.has(emp.employee_id) ? 'var(--bg-secondary)' : undefined }}
                          >
                            <td>
                              <svg
                                className={`w-4 h-4 transition-transform ${expanded.overtime.has(emp.employee_id) ? 'rotate-90' : ''}`}
                                style={{ color: 'var(--text-muted)' }}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </td>
                            <td className="font-medium">{emp.name}</td>
                            <td className="text-right" style={{ color: 'var(--status-warning)' }}>{formatHours(emp.total_hours)}</td>
                            {canViewPayAmounts && <td className="text-right">{formatCurrency(emp.total_amount)}</td>}
                          </tr>
                          {expanded.overtime.has(emp.employee_id) && emp.items.map((item, i) => (
                            <tr
                              key={`${emp.employee_id}-${i}`}
                              style={{ backgroundColor: 'var(--bg-secondary)' }}
                            >
                              <td></td>
                              <td className="text-sm" style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
                                {formatDate(item.date)} &middot; <JobLink stJobId={item.st_job_id} jobNumber={item.job_number} />
                                {item.activity && <span style={{ color: 'var(--text-muted)' }}> &middot; {item.activity}</span>}
                              </td>
                              <td className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatHours(item.hours)}</td>
                              {canViewPayAmounts && <td className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.amount)}</td>}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                        <td></td>
                        <td style={{ color: 'var(--text-muted)' }}>Total ({data.overtime.count} employees)</td>
                        <td className="text-right" style={{ color: 'var(--status-warning)' }}>{formatHours(data.overtime.total_hours)}</td>
                        {canViewPayAmounts && <td className="text-right">{formatCurrency(data.overtime.total_amount)}</td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Suspicious Section */}
          <div className="card p-0 overflow-hidden">
            <button
              onClick={() => toggleCollapse('suspicious')}
              className="w-full flex items-center justify-between p-4 text-left"
              style={{ borderBottom: collapsed.suspicious ? 'none' : '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: 'var(--status-error, #ef4444)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Suspicious Auto-Entries</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: data.suspicious.count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: data.suspicious.count > 0 ? 'var(--status-error, #ef4444)' : 'var(--status-success)',
                  }}
                >
                  {data.suspicious.count}
                </span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform ${collapsed.suspicious ? '' : 'rotate-180'}`}
                style={{ color: 'var(--text-muted)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {!collapsed.suspicious && (
              data.suspicious.count === 0 ? (
                <EmptyState label="suspicious entries" />
              ) : (
                <div className="table-wrapper">
                  <table className="pr-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Job #</th>
                        <th className="text-right">Duration</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.suspicious.entries.map((entry, i) => (
                        <tr key={i}>
                          <td>{formatDate(entry.date)}</td>
                          <td>{entry.employee_name}</td>
                          <td><JobLink stJobId={entry.st_job_id} jobNumber={entry.job_number} /></td>
                          <td className="text-right">{formatHours(entry.duration_hours)} hrs</td>
                          <td style={{ color: entry.clock_in ? 'var(--text-secondary)' : 'var(--status-error, #ef4444)' }}>
                            {entry.clock_in ? formatTimestamp(entry.clock_in) : 'Missing'}
                          </td>
                          <td style={{ color: entry.clock_out ? 'var(--text-secondary)' : 'var(--status-error, #ef4444)' }}>
                            {entry.clock_out ? formatTimestamp(entry.clock_out) : 'Missing'}
                          </td>
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              {entry.flags.map(flag => (
                                <span
                                  key={flag}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: flag === 'Missing Clock' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                    color: flag === 'Missing Clock' ? 'var(--status-error, #ef4444)' : 'var(--status-warning)',
                                  }}
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ color: 'var(--text-muted)' }}>Total ({data.suspicious.count} entries)</td>
                        <td className="text-right">
                          {formatHours(data.suspicious.entries.reduce((s, e) => s + e.duration_hours, 0))} hrs
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}
          </div>

          {/* PTO Section */}
          <div className="card p-0 overflow-hidden">
            <button
              onClick={() => toggleCollapse('pto')}
              className="w-full flex items-center justify-between p-4 text-left"
              style={{ borderBottom: collapsed.pto ? 'none' : '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" style={{ color: 'var(--christmas-green-light)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>PTO / Time Off</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: data.pto.count > 0 ? 'rgba(93, 138, 102, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: data.pto.count > 0 ? 'var(--christmas-green-light)' : 'var(--status-success)',
                  }}
                >
                  {data.pto.count}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {data.pto.count > 0 && (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatHours(data.pto.total_hours)} hrs
                  </span>
                )}
                <svg
                  className={`w-4 h-4 transition-transform ${collapsed.pto ? '' : 'rotate-180'}`}
                  style={{ color: 'var(--text-muted)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {!collapsed.pto && (
              data.pto.count === 0 ? (
                <EmptyState label="PTO / time off" />
              ) : (
                <div className="table-wrapper">
                  <table className="pr-table">
                    <thead>
                      <tr>
                        <th style={{ width: '24px' }}></th>
                        <th>Employee</th>
                        <th className="text-right">Hours</th>
                        {canViewPayAmounts && <th className="text-right">Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.pto.employees.map(emp => (
                        <>
                          <tr
                            key={emp.employee_id}
                            className="cursor-pointer"
                            onClick={() => toggleExpand('pto', emp.employee_id)}
                            style={{ backgroundColor: expanded.pto.has(emp.employee_id) ? 'var(--bg-secondary)' : undefined }}
                          >
                            <td>
                              <svg
                                className={`w-4 h-4 transition-transform ${expanded.pto.has(emp.employee_id) ? 'rotate-90' : ''}`}
                                style={{ color: 'var(--text-muted)' }}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </td>
                            <td className="font-medium">{emp.name}</td>
                            <td className="text-right">{formatHours(emp.total_hours)}</td>
                            {canViewPayAmounts && <td className="text-right">{formatCurrency(emp.total_amount)}</td>}
                          </tr>
                          {expanded.pto.has(emp.employee_id) && emp.items.map((item, i) => (
                            <tr
                              key={`${emp.employee_id}-pto-${i}`}
                              style={{ backgroundColor: 'var(--bg-secondary)' }}
                            >
                              <td></td>
                              <td className="text-sm" style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
                                {formatDate(item.date)}
                                {item.activity && <span> &middot; {item.activity}</span>}
                                {!item.activity && <span style={{ color: 'var(--text-muted)' }}> &middot; {item.pay_type}</span>}
                              </td>
                              <td className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatHours(item.hours)}</td>
                              {canViewPayAmounts && <td className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.amount)}</td>}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                        <td></td>
                        <td style={{ color: 'var(--text-muted)' }}>Total ({data.pto.count} employees)</td>
                        <td className="text-right">{formatHours(data.pto.total_hours)}</td>
                        {canViewPayAmounts && (
                          <td className="text-right">
                            {formatCurrency(data.pto.employees.reduce((s, e) => s + e.total_amount, 0))}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
