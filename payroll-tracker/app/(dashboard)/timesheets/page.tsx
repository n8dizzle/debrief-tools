'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatHours, formatDate, formatTimestamp, getMonthToDateRange } from '@/lib/payroll-utils';

interface TimesheetRow {
  id: string;
  type: 'job' | 'nonjob';
  description: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  duration_hours: number | null;
  employee?: { id: string; name: string; trade: string | null };
  job_number?: string;
  st_job_id?: number;
  timesheet_code_name?: string;
}

export default function TimesheetsPage() {
  const { isLoading: permLoading } = usePayrollPermissions();
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getMonthToDateRange);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  // Load employees for filter dropdown
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch(`/api/employees?start=${dateRange.start}&end=${dateRange.end}`);
        if (res.ok) {
          const data = await res.json();
          setEmployees((data.employees || []).map((e: any) => ({ id: e.id, name: e.name })));
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
      }
    }
    loadEmployees();
  }, [dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start,
        end: dateRange.end,
      });
      if (typeFilter) params.set('type', typeFilter);
      if (employeeFilter) params.set('employee', employeeFilter);

      const res = await fetch(`/api/timesheets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data.timesheets || []);
      }
    } catch (err) {
      console.error('Failed to load timesheets:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, typeFilter, employeeFilter]);

  useEffect(() => {
    if (!permLoading) loadData();
  }, [loadData, permLoading]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Timesheets
      </h1>

      {/* Filters */}
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
        <div className="flex gap-1">
          {['', 'job', 'nonjob'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: typeFilter === t ? 'var(--christmas-green)' : 'var(--bg-card)',
                color: typeFilter === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                border: `1px solid ${typeFilter === t ? 'var(--christmas-green)' : 'var(--border-default)'}`,
              }}
            >
              {t === '' ? 'All' : t === 'job' ? 'Job' : 'Non-Job'}
            </button>
          ))}
        </div>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="select"
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th className="text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No timesheets for this date range
                    </td>
                  </tr>
                ) : (
                  timesheets.map(ts => (
                    <tr key={`${ts.type}-${ts.id}`}>
                      <td>{formatDate(ts.date)}</td>
                      <td>
                        {ts.employee ? (
                          <a
                            href={`/employees/${ts.employee.id}`}
                            style={{ color: 'var(--christmas-green-light)' }}
                          >
                            {ts.employee.name}
                          </a>
                        ) : 'Unknown'}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: ts.type === 'job' ? 'rgba(93, 138, 102, 0.15)' : 'rgba(107, 124, 110, 0.15)',
                            color: ts.type === 'job' ? 'var(--christmas-green-light)' : 'var(--text-secondary)',
                          }}
                        >
                          {ts.type === 'job' ? 'Job' : 'Non-Job'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{ts.description}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatTimestamp(ts.clock_in)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{ts.clock_out ? formatTimestamp(ts.clock_out) : '-'}</td>
                      <td className="text-right font-medium">
                        {ts.duration_hours ? formatHours(Number(ts.duration_hours)) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {timesheets.length > 0 && (
            <div className="p-3 text-sm text-center" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
              Showing {timesheets.length} timesheets
            </div>
          )}
        </div>
      )}
    </div>
  );
}
