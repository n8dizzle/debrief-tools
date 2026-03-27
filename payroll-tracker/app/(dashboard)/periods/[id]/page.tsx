'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePayrollPermissions } from '@/hooks/usePayrollPermissions';
import { formatCurrency, formatHours, formatDate } from '@/lib/payroll-utils';

export default function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canViewPayAmounts } = usePayrollPermissions();
  const [period, setPeriod] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/periods/${id}`);
        if (res.ok) {
          const data = await res.json();
          setPeriod(data.period);
          setEmployees(data.employees || []);
          setAdjustments(data.adjustments || []);
        }
      } catch (err) {
        console.error('Failed to load period:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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

  if (!period) {
    return <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Period not found</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/periods" style={{ color: 'var(--christmas-green-light)' }}>Pay Periods</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {formatDate(period.start_date)} - {formatDate(period.end_date)}
        </span>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Pay Period: {formatDate(period.start_date)} - {formatDate(period.end_date)}
      </h1>

      {/* Employee Breakdown */}
      <div className="card p-0 overflow-hidden mb-6">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Employee Breakdown</h2>
        </div>
        <div className="table-wrapper">
          <table className="pr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Dept</th>
                <th className="text-right">Total Hrs</th>
                <th className="text-right">Regular</th>
                <th className="text-right">OT</th>
                {canViewPayAmounts && <th className="text-right">Pay</th>}
                {canViewPayAmounts && <th className="text-right">Perf. Pay</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.employee_id}>
                  <td>
                    <Link
                      href={`/employees/${emp.employee_id}?start=${period.start_date}&end=${period.end_date}`}
                      style={{ color: 'var(--christmas-green-light)' }}
                      className="font-medium"
                    >
                      {emp.name}
                    </Link>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {emp.department || '-'}
                  </td>
                  <td className="text-right font-medium">{formatHours(emp.total_hours)}</td>
                  <td className="text-right">{formatHours(emp.regular_hours)}</td>
                  <td className="text-right" style={{ color: emp.overtime_hours > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                    {emp.overtime_hours > 0 ? formatHours(emp.overtime_hours) : '-'}
                  </td>
                  {canViewPayAmounts && <td className="text-right">{formatCurrency(emp.total_pay)}</td>}
                  {canViewPayAmounts && (
                    <td className="text-right" style={{ color: emp.performance_pay > 0 ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      {emp.performance_pay > 0 ? formatCurrency(emp.performance_pay) : '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustments */}
      {canViewPayAmounts && adjustments.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>Adjustments</h2>
          </div>
          <div className="table-wrapper">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th>Memo</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj: any) => (
                  <tr key={adj.id}>
                    <td>{adj.employee?.name || 'Unknown'}</td>
                    <td>{adj.adjustment_type || '-'}</td>
                    <td className="text-right" style={{ color: adj.amount >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                      {formatCurrency(Number(adj.amount))}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{adj.memo || '-'}</td>
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
