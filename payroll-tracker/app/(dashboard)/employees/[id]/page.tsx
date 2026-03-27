'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatDate, getCurrentPayWeekRange, getPayPeriodPresets } from '@/lib/payroll-utils';

type Tab = 'daily' | 'jobs';
type DailySortField = 'date' | 'regular' | 'overtime' | 'total' | 'amount' | 'perfPay';
type PaySortField = 'date' | 'hours' | 'amount' | 'pay_type' | 'activity' | 'job_number' | 'business_unit';
type PayTypeFilter = '' | 'Regular' | 'Overtime' | 'PerformancePay' | 'Other';
type ActivityFilter = '' | string;

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { canViewPayAmounts } = usePayrollPermissions();

  const initialStart = searchParams.get('start') || getCurrentPayWeekRange().start;
  const initialEnd = searchParams.get('end') || getCurrentPayWeekRange().end;

  const [employee, setEmployee] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [payItems, setPayItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('daily');
  const [dateRange, setDateRange] = useState({ start: initialStart, end: initialEnd });

  // Daily breakdown sort
  const [dailySortField, setDailySortField] = useState<DailySortField>('date');
  const [dailySortDir, setDailySortDir] = useState<'asc' | 'desc'>('desc');

  // Pay details sort & filters
  const [paySortField, setPaySortField] = useState<PaySortField>('date');
  const [paySortDir, setPaySortDir] = useState<'asc' | 'desc'>('desc');
  const [payTypeFilter, setPayTypeFilter] = useState<PayTypeFilter>('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = `start=${dateRange.start}&end=${dateRange.end}`;

      const [empRes, payRes] = await Promise.all([
        fetch(`/api/employees/${id}?${params}`),
        fetch(`/api/employees/${id}/pay-items?${params}`),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployee(empData.employee);
        setSummary(empData.summary);
      }
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayItems(payData.items || []);
      }
    } catch (err) {
      console.error('Failed to load employee:', err);
    } finally {
      setLoading(false);
    }
  }, [id, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get unique activities for filter dropdown
  const uniqueActivities = useMemo(() => {
    const acts = new Set<string>();
    for (const item of payItems) {
      if (item.activity) acts.add(item.activity);
    }
    return Array.from(acts).sort();
  }, [payItems]);

  // Get unique pay types present in data
  const uniquePayTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of payItems) {
      if (item.pay_type) types.add(item.pay_type);
    }
    return Array.from(types).sort();
  }, [payItems]);

  // Aggregate daily breakdown from pay items
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { regular: number; overtime: number; perfPay: number; total: number; amount: number }>();
    for (const item of payItems) {
      const day = item.date;
      const entry = map.get(day) || { regular: 0, overtime: 0, perfPay: 0, total: 0, amount: 0 };
      entry.total += Number(item.hours) || 0;
      entry.amount += Number(item.amount) || 0;
      if (item.pay_type === 'Regular') entry.regular += Number(item.hours) || 0;
      else if (item.pay_type === 'Overtime') entry.overtime += Number(item.hours) || 0;
      else if (item.pay_type === 'PerformancePay') entry.perfPay += Number(item.amount) || 0;
      map.set(day, entry);
    }
    const rows = Array.from(map.entries()).map(([date, data]) => ({ date, ...data }));

    rows.sort((a, b) => {
      const aVal = a[dailySortField];
      const bVal = b[dailySortField];
      if (typeof aVal === 'string') {
        return dailySortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return dailySortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return rows;
  }, [payItems, dailySortField, dailySortDir]);

  // Filtered and sorted pay items
  const filteredPayItems = useMemo(() => {
    let items = [...payItems];

    if (payTypeFilter) {
      items = items.filter(i => i.pay_type === payTypeFilter);
    }
    if (activityFilter) {
      items = items.filter(i => i.activity === activityFilter);
    }

    items.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (paySortField) {
        case 'date': aVal = a.date || ''; bVal = b.date || ''; break;
        case 'hours': aVal = Number(a.hours) || 0; bVal = Number(b.hours) || 0; break;
        case 'amount': aVal = Number(a.amount) || 0; bVal = Number(b.amount) || 0; break;
        case 'pay_type': aVal = a.pay_type || ''; bVal = b.pay_type || ''; break;
        case 'activity': aVal = a.activity || ''; bVal = b.activity || ''; break;
        case 'job_number': aVal = a.job_number || ''; bVal = b.job_number || ''; break;
        case 'business_unit': aVal = a.business_unit_name || ''; bVal = b.business_unit_name || ''; break;
        default: aVal = a.date || ''; bVal = b.date || '';
      }
      if (typeof aVal === 'string') {
        return paySortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return paySortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return items;
  }, [payItems, payTypeFilter, activityFilter, paySortField, paySortDir]);

  const handleDailySort = (field: DailySortField) => {
    if (dailySortField === field) {
      setDailySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDailySortField(field);
      setDailySortDir('desc');
    }
  };

  const handlePaySort = (field: PaySortField) => {
    if (paySortField === field) {
      setPaySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPaySortField(field);
      setPaySortDir('desc');
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return null;
    return <span className="ml-1">{dir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

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

  if (!employee) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
        Employee not found
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'daily', label: 'Daily Breakdown', count: dailyBreakdown.length },
    { key: 'jobs', label: 'Pay Details', count: filteredPayItems.length },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href={`/employees?start=${dateRange.start}&end=${dateRange.end}`} style={{ color: 'var(--christmas-green-light)' }}>
          Employees
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{employee.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            {employee.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {employee.business_unit_name && (
              <span
                className="badge"
                style={{
                  backgroundColor: 'rgba(107, 124, 110, 0.15)',
                  color: 'var(--text-secondary)',
                }}
              >
                {employee.business_unit_name}
              </span>
            )}
            {employee.role && (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{employee.role}</span>
            )}
          </div>
        </div>
      </div>

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

      {/* Date Range */}
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
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="card">
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Hours</div>
            <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatHours(summary.total_hours)}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Regular</div>
            <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatHours(summary.regular_hours)}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Overtime</div>
            <div className="text-xl font-bold" style={{ color: summary.overtime_hours > 0 ? 'var(--status-warning)' : 'var(--christmas-cream)' }}>
              {formatHours(summary.overtime_hours)}
            </div>
          </div>
          {canViewPayAmounts && (
            <>
              <div className="card">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total Pay</div>
                <div className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>{formatCurrency(summary.total_pay)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Perf. Pay</div>
                <div className="text-xl font-bold" style={{ color: summary.performance_pay > 0 ? 'var(--status-success)' : 'var(--christmas-cream)' }}>
                  {formatCurrency(summary.performance_pay)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{
              color: tab === t.key ? 'var(--christmas-cream)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--christmas-green)' : '2px solid transparent',
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-0 overflow-hidden">
        {tab === 'daily' && (
          <div className="table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => handleDailySort('date')}>
                    Date <SortIcon active={dailySortField === 'date'} dir={dailySortDir} />
                  </th>
                  <th className="text-right cursor-pointer" onClick={() => handleDailySort('regular')}>
                    Regular <SortIcon active={dailySortField === 'regular'} dir={dailySortDir} />
                  </th>
                  <th className="text-right cursor-pointer" onClick={() => handleDailySort('overtime')}>
                    OT <SortIcon active={dailySortField === 'overtime'} dir={dailySortDir} />
                  </th>
                  <th className="text-right cursor-pointer" onClick={() => handleDailySort('total')}>
                    Total Hrs <SortIcon active={dailySortField === 'total'} dir={dailySortDir} />
                  </th>
                  {canViewPayAmounts && (
                    <th className="text-right cursor-pointer" onClick={() => handleDailySort('amount')}>
                      Pay <SortIcon active={dailySortField === 'amount'} dir={dailySortDir} />
                    </th>
                  )}
                  {canViewPayAmounts && (
                    <th className="text-right cursor-pointer" onClick={() => handleDailySort('perfPay')}>
                      Perf. Pay <SortIcon active={dailySortField === 'perfPay'} dir={dailySortDir} />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={canViewPayAmounts ? 6 : 4} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                      No data for this period
                    </td>
                  </tr>
                ) : (
                  dailyBreakdown.map(day => (
                    <tr key={day.date}>
                      <td>{formatDate(day.date)}</td>
                      <td className="text-right">{formatHours(day.regular)}</td>
                      <td className="text-right" style={{ color: day.overtime > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                        {day.overtime > 0 ? formatHours(day.overtime) : '-'}
                      </td>
                      <td className="text-right font-medium">{formatHours(day.total)}</td>
                      {canViewPayAmounts && <td className="text-right">{formatCurrency(day.amount)}</td>}
                      {canViewPayAmounts && (
                        <td className="text-right" style={{ color: day.perfPay > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                          {day.perfPay > 0 ? formatCurrency(day.perfPay) : '-'}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {dailyBreakdown.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                    <td style={{ color: 'var(--text-muted)' }}>Total</td>
                    <td className="text-right">{formatHours(dailyBreakdown.reduce((s, d) => s + d.regular, 0))}</td>
                    <td className="text-right" style={{ color: 'var(--status-warning)' }}>
                      {formatHours(dailyBreakdown.reduce((s, d) => s + d.overtime, 0))}
                    </td>
                    <td className="text-right">{formatHours(dailyBreakdown.reduce((s, d) => s + d.total, 0))}</td>
                    {canViewPayAmounts && <td className="text-right">{formatCurrency(dailyBreakdown.reduce((s, d) => s + d.amount, 0))}</td>}
                    {canViewPayAmounts && (
                      <td className="text-right" style={{ color: 'var(--status-success)' }}>
                        {formatCurrency(dailyBreakdown.reduce((s, d) => s + d.perfPay, 0))}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {tab === 'jobs' && (
          <>
            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Type</label>
                <div className="flex gap-1">
                  {['', ...uniquePayTypes].map(t => (
                    <button
                      key={t}
                      onClick={() => setPayTypeFilter(t as PayTypeFilter)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: payTypeFilter === t ? 'var(--christmas-green)' : 'var(--bg-card)',
                        color: payTypeFilter === t ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                        border: `1px solid ${payTypeFilter === t ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                      }}
                    >
                      {t === '' ? 'All' : t}
                    </button>
                  ))}
                </div>
              </div>
              {uniqueActivities.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Activity</label>
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="input text-xs"
                    style={{ width: 'auto', padding: '4px 8px' }}
                  >
                    <option value="">All Activities</option>
                    {uniqueActivities.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="table-wrapper">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th className="cursor-pointer" onClick={() => handlePaySort('date')}>
                      Date <SortIcon active={paySortField === 'date'} dir={paySortDir} />
                    </th>
                    <th className="cursor-pointer" onClick={() => handlePaySort('job_number')}>
                      Job # <SortIcon active={paySortField === 'job_number'} dir={paySortDir} />
                    </th>
                    <th className="cursor-pointer" onClick={() => handlePaySort('business_unit')}>
                      Business Unit <SortIcon active={paySortField === 'business_unit'} dir={paySortDir} />
                    </th>
                    <th className="cursor-pointer" onClick={() => handlePaySort('pay_type')}>
                      Type <SortIcon active={paySortField === 'pay_type'} dir={paySortDir} />
                    </th>
                    <th className="text-right cursor-pointer" onClick={() => handlePaySort('hours')}>
                      Hours <SortIcon active={paySortField === 'hours'} dir={paySortDir} />
                    </th>
                    {canViewPayAmounts && (
                      <th className="text-right cursor-pointer" onClick={() => handlePaySort('amount')}>
                        Amount <SortIcon active={paySortField === 'amount'} dir={paySortDir} />
                      </th>
                    )}
                    <th className="cursor-pointer" onClick={() => handlePaySort('activity')}>
                      Activity <SortIcon active={paySortField === 'activity'} dir={paySortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayItems.length === 0 ? (
                    <tr>
                      <td colSpan={canViewPayAmounts ? 7 : 6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                        No pay items match filters
                      </td>
                    </tr>
                  ) : (
                    filteredPayItems.map(item => (
                      <tr key={item.id}>
                        <td>{formatDate(item.date)}</td>
                        <td>
                          {item.st_job_id ? (
                            <a
                              href={`https://go.servicetitan.com/#/Job/Index/${item.st_job_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--christmas-green-light)' }}
                            >
                              {item.job_number || item.st_job_id}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.business_unit_name || '-'}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: item.pay_type === 'Overtime' ? 'rgba(234, 179, 8, 0.15)' :
                                item.pay_type === 'PerformancePay' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(93, 138, 102, 0.15)',
                              color: item.pay_type === 'Overtime' ? 'var(--status-warning)' :
                                item.pay_type === 'PerformancePay' ? 'var(--status-success)' : 'var(--christmas-green-light)',
                            }}
                          >
                            {item.pay_type}
                          </span>
                        </td>
                        <td className="text-right">{formatHours(Number(item.hours))}</td>
                        {canViewPayAmounts && <td className="text-right">{formatCurrency(Number(item.amount))}</td>}
                        <td style={{ color: 'var(--text-muted)' }}>{item.activity || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredPayItems.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 'bold' }}>
                      <td style={{ color: 'var(--text-muted)' }}>Total ({filteredPayItems.length})</td>
                      <td />
                      <td />
                      <td />
                      <td className="text-right">{formatHours(filteredPayItems.reduce((s, i) => s + (Number(i.hours) || 0), 0))}</td>
                      {canViewPayAmounts && (
                        <td className="text-right">{formatCurrency(filteredPayItems.reduce((s, i) => s + (Number(i.amount) || 0), 0))}</td>
                      )}
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
