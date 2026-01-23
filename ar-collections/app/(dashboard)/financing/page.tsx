'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { ARPaymentPlan, ARPaymentPlanMonth, PortalUser, ARCustomer } from '@/lib/supabase';
import { useARPermissions } from '@/hooks/useARPermissions';

interface PaymentPlanWithDetails extends ARPaymentPlan {
  customer: ARCustomer;
  months: ARPaymentPlanMonth[];
  owner: PortalUser | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FinancingPage() {
  const [plans, setPlans] = useState<PaymentPlanWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const { canCreatePaymentPlan, canRecordPayment } = useARPermissions();

  useEffect(() => {
    fetchPlans();
  }, [filterStatus]);

  async function fetchPlans() {
    try {
      const response = await fetch(`/api/payment-plans?status=${filterStatus}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleMonthPayment(planId: string, year: number, month: number, isPaid: boolean) {
    try {
      const response = await fetch(`/api/payment-plans/${planId}/months`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ year, month, paid: isPaid }),
      });
      if (!response.ok) throw new Error('Failed to update');
      fetchPlans();
    } catch (err) {
      console.error('Error:', err);
    }
  }

  const totalBalance = plans.reduce((sum, p) => sum + Number(p.total_balance), 0);
  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div style={{ color: 'var(--text-muted)' }}>Loading payment plans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            In-House Financing
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {plans.length} active plans · {formatCurrency(totalBalance)} total balance
          </p>
        </div>
        {canCreatePaymentPlan && (
          <Link href="/financing/new" className="btn btn-primary">
            + New Payment Plan
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Status
            </label>
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="defaulted">Defaulted</option>
              <option value="">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payment Plans Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Customer</th>
                <th>Balance</th>
                <th>Monthly</th>
                <th>Due Day</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-center">{m}</th>
                ))}
                <th>Est. End</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No payment plans found
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="text-sm">
                      {plan.owner?.name?.split(' ')[0] || '-'}
                    </td>
                    <td>
                      <Link
                        href={`/customers/${plan.customer_id}`}
                        className="font-medium hover:underline"
                      >
                        {plan.customer?.name || 'Unknown'}
                      </Link>
                    </td>
                    <td className="font-medium" style={{ color: 'var(--status-error)' }}>
                      {formatCurrency(plan.total_balance)}
                    </td>
                    <td>{formatCurrency(plan.monthly_payment_amount)}</td>
                    <td className="text-center">{plan.payment_due_day}</td>
                    {MONTHS.map((_, monthIndex) => {
                      const monthData = plan.months?.find(
                        m => m.year === currentYear && m.month === monthIndex + 1
                      );
                      const isPaid = monthData?.status === 'paid';
                      const isLate = monthData?.status === 'late';
                      const isMissed = monthData?.status === 'missed';

                      return (
                        <td key={monthIndex} className="text-center">
                          {canRecordPayment ? (
                            <input
                              type="checkbox"
                              checked={isPaid}
                              onChange={(e) => toggleMonthPayment(
                                plan.id,
                                currentYear,
                                monthIndex + 1,
                                e.target.checked
                              )}
                              className="w-4 h-4"
                              style={{
                                accentColor: isLate || isMissed ? 'var(--status-error)' : 'var(--christmas-green)',
                              }}
                            />
                          ) : (
                            <span className={`text-xs ${isPaid ? 'text-green-500' : isLate ? 'text-yellow-500' : isMissed ? 'text-red-500' : 'text-gray-500'}`}>
                              {isPaid ? '✓' : isLate ? '!' : isMissed ? 'X' : '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {plan.estimated_end_date ? formatDate(plan.estimated_end_date) : '-'}
                    </td>
                    <td className="text-xs max-w-[150px] truncate" title={plan.notes || ''}>
                      {plan.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
