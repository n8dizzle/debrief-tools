'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatCurrencyCompact, formatLocalDate, formatHours } from '@/lib/labor-utils';

interface Employee {
  employee_id: number;
  name: string;
  type: string;
  trade: string | null;
  totalPay: number;
  hourlyPay: number;
  overtimePay: number;
  commissions: number;
  totalHours: number;
  avgPerHour: number;
}

type SortField = 'name' | 'type' | 'totalPay' | 'hourlyPay' | 'commissions' | 'overtimePay' | 'totalHours' | 'avgPerHour';
type SortDir = 'asc' | 'desc';
type TradeFilter = 'all' | 'hvac' | 'plumbing';

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setMonth(start.getMonth() - 2);
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(now),
  };
}

export default function EmployeesPage() {
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [trade, setTrade] = useState<TradeFilter>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('totalPay');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      if (trade !== 'all') params.set('trade', trade);

      const res = await fetch(`/api/employees?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, trade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = [...employees].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal) || 0;
    const bNum = Number(bVal) || 0;
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}> {'\u2195'}</span>;
    return <span style={{ color: 'var(--christmas-green)' }}> {sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Employees
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''} with payroll data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Trade filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['all', 'hvac', 'plumbing'] as TradeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTrade(t)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: trade === t ? 'var(--christmas-green)' : 'var(--bg-card)',
                  color: trade === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                }}
              >
                {t === 'all' ? 'All' : t === 'hvac' ? 'HVAC' : 'Plumbing'}
              </button>
            ))}
          </div>

          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: 'var(--christmas-green)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading employees...</p>
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            No employee data for this period
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Run a sync from Settings to pull payroll data from ServiceTitan.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrapper">
            <table className="labor-table">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => handleSort('name')}>
                    Name<SortIcon field="name" />
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('type')}>
                    Type<SortIcon field="type" />
                  </th>
                  <th>Trade</th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('totalPay')}>
                    Total Pay<SortIcon field="totalPay" />
                  </th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('hourlyPay')}>
                    Hourly<SortIcon field="hourlyPay" />
                  </th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('overtimePay')}>
                    OT<SortIcon field="overtimePay" />
                  </th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('commissions')}>
                    Commission<SortIcon field="commissions" />
                  </th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('totalHours')}>
                    Hours<SortIcon field="totalHours" />
                  </th>
                  <th className="cursor-pointer text-right" onClick={() => handleSort('avgPerHour')}>
                    Avg $/hr<SortIcon field="avgPerHour" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {emp.name}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {emp.type}
                    </td>
                    <td>
                      {emp.trade ? (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: emp.trade === 'hvac'
                              ? 'rgba(93, 138, 102, 0.15)'
                              : 'rgba(184, 149, 107, 0.15)',
                            color: emp.trade === 'hvac'
                              ? 'var(--christmas-green-light)'
                              : 'var(--christmas-gold)',
                          }}
                        >
                          {emp.trade === 'hvac' ? 'HVAC' : 'Plumbing'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td className="text-right font-medium" style={{ color: 'var(--christmas-cream)' }}>
                      {formatCurrency(emp.totalPay)}
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatCurrency(emp.hourlyPay)}
                    </td>
                    <td className="text-right" style={{ color: emp.overtimePay > 0 ? 'var(--christmas-gold)' : 'var(--text-muted)' }}>
                      {emp.overtimePay > 0 ? formatCurrency(emp.overtimePay) : '\u2014'}
                    </td>
                    <td className="text-right" style={{ color: emp.commissions > 0 ? 'var(--status-info)' : 'var(--text-muted)' }}>
                      {emp.commissions > 0 ? formatCurrency(emp.commissions) : '\u2014'}
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatHours(emp.totalHours)}
                    </td>
                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                      {emp.avgPerHour > 0 ? formatCurrency(emp.avgPerHour) : '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
