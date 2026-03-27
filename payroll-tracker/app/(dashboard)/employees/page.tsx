'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, getCurrentPayWeekRange, getPayPeriodPresets } from '@/lib/payroll-utils';
import DepartmentFilter from '@/components/DepartmentFilter';

interface EmployeeRow {
  id: string;
  name: string;
  trade: string | null;
  role: string | null;
  business_unit_name: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  performance_pay: number;
  total_pay: number;
}

export default function EmployeesPage() {
  const searchParams = useSearchParams();
  const { canViewPayAmounts, isLoading: permLoading } = usePayrollPermissions();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (start && end) return { start, end };
    return getCurrentPayWeekRange();
  });
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof EmployeeRow>('total_hours');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'' | 'hasOT' | 'hasPerf' | 'noHours'>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start,
        end: dateRange.end,
      });
      if (selectedDepts.length > 0) params.set('departments', selectedDepts.join(','));

      const res = await fetch(`/api/employees?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        setBusinessUnits(data.business_units || []);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedDepts]);

  useEffect(() => {
    if (!permLoading) loadData();
  }, [loadData, permLoading]);

  const handleSort = (field: keyof EmployeeRow) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...employees];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }

    if (quickFilter === 'hasOT') {
      list = list.filter(e => e.overtime_hours > 0);
    } else if (quickFilter === 'hasPerf') {
      list = list.filter(e => e.performance_pay > 0);
    } else if (quickFilter === 'noHours') {
      list = list.filter(e => e.total_hours === 0);
    }

    return list;
  }, [employees, search, quickFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === 'string') {
        return sortDir === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filtered, sortField, sortDir]);

  const SortIcon = ({ field }: { field: keyof EmployeeRow }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Employees
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
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Search & Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-sm"
              style={{ width: '200px' }}
            />
            <div className="flex gap-1">
              {([
                { key: '', label: 'All' },
                { key: 'hasOT', label: 'Has OT' },
                { key: 'hasPerf', label: 'Has Perf. Pay' },
                { key: 'noHours', label: 'No Hours' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setQuickFilter(f.key)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: quickFilter === f.key ? 'var(--christmas-green)' : 'var(--bg-card)',
                    color: quickFilter === f.key ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                    border: `1px solid ${quickFilter === f.key ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {sorted.length} of {employees.length} employees
            </span>
          </div>

          <div className="table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => handleSort('name')}>
                    Name <SortIcon field="name" />
                  </th>
                  <th>Department</th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('total_hours')}>
                    Total Hrs <SortIcon field="total_hours" />
                  </th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('regular_hours')}>
                    Regular <SortIcon field="regular_hours" />
                  </th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('overtime_hours')}>
                    OT <SortIcon field="overtime_hours" />
                  </th>
                  {canViewPayAmounts && (
                    <>
                      <th className="text-right cursor-pointer" onClick={() => handleSort('performance_pay')}>
                        Perf. Pay <SortIcon field="performance_pay" />
                      </th>
                      <th className="text-right cursor-pointer" onClick={() => handleSort('total_pay')}>
                        Total Pay <SortIcon field="total_pay" />
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={canViewPayAmounts ? 7 : 5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No employee data for this date range
                    </td>
                  </tr>
                ) : (
                  sorted.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <Link
                          href={`/employees/${emp.id}?start=${dateRange.start}&end=${dateRange.end}`}
                          style={{ color: 'var(--christmas-green-light)' }}
                          className="font-medium"
                        >
                          {emp.name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {emp.business_unit_name || (emp.role ? <span style={{ color: 'var(--text-muted)' }}>{emp.role}</span> : '-')}
                      </td>
                      <td className="text-right font-medium">{formatHours(emp.total_hours)}</td>
                      <td className="text-right">{formatHours(emp.regular_hours)}</td>
                      <td
                        className="text-right"
                        style={{ color: emp.overtime_hours > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}
                      >
                        {emp.overtime_hours > 0 ? formatHours(emp.overtime_hours) : '-'}
                      </td>
                      {canViewPayAmounts && (
                        <>
                          <td
                            className="text-right"
                            style={{ color: emp.performance_pay > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}
                          >
                            {emp.performance_pay > 0 ? formatCurrency(emp.performance_pay) : '-'}
                          </td>
                          <td className="text-right font-medium">{formatCurrency(emp.total_pay)}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {sorted.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                    <td style={{ color: 'var(--text-muted)' }}>Total ({sorted.length})</td>
                    <td />
                    <td className="text-right">{formatHours(sorted.reduce((s, e) => s + e.total_hours, 0))}</td>
                    <td className="text-right">{formatHours(sorted.reduce((s, e) => s + e.regular_hours, 0))}</td>
                    <td className="text-right" style={{ color: 'var(--status-warning)' }}>
                      {formatHours(sorted.reduce((s, e) => s + e.overtime_hours, 0))}
                    </td>
                    {canViewPayAmounts && (
                      <>
                        <td className="text-right" style={{ color: 'var(--status-success)' }}>
                          {formatCurrency(sorted.reduce((s, e) => s + e.performance_pay, 0))}
                        </td>
                        <td className="text-right">{formatCurrency(sorted.reduce((s, e) => s + e.total_pay, 0))}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
