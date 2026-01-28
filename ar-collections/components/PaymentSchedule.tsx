'use client';

import { PaymentSchedule as PaymentScheduleType } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { getDaysUntilNextPayment, formatDaysUntil } from '@/lib/financing-utils';

interface PaymentScheduleProps {
  schedule: PaymentScheduleType;
  compact?: boolean;
}

export default function PaymentSchedule({ schedule, compact = false }: PaymentScheduleProps) {
  if (schedule.upcoming.length === 0) {
    return (
      <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        No upcoming payments
      </div>
    );
  }

  if (compact) {
    const nextPayment = schedule.upcoming[0];
    const daysUntil = getDaysUntilNextPayment(nextPayment.due_date);

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Next payment:
          </span>
          <span
            className="font-medium"
            style={{
              color: nextPayment.is_overdue
                ? 'var(--status-error)'
                : 'var(--christmas-cream)',
            }}
          >
            {formatCurrency(nextPayment.amount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--text-muted)' }}>
            {formatDate(nextPayment.due_date)}
          </span>
          <span
            style={{
              color: nextPayment.is_overdue
                ? 'var(--status-error)'
                : 'var(--text-secondary)',
            }}
          >
            {formatDaysUntil(daysUntil)}
          </span>
        </div>
        {schedule.projected_payoff_date && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Payoff: {formatDate(schedule.projected_payoff_date)} ({schedule.payments_remaining} payments)
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {schedule.projected_payoff_date && (
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Projected Payoff
            </span>
            <span className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
              {formatDate(schedule.projected_payoff_date)}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {schedule.payments_remaining} payments remaining · {formatCurrency(schedule.total_remaining)} total
          </div>
        </div>
      )}

      {/* Upcoming payments list */}
      <div className="space-y-2">
        {schedule.upcoming.map((payment, index) => {
          const daysUntil = getDaysUntilNextPayment(payment.due_date);

          return (
            <div
              key={payment.due_date}
              className="flex items-center gap-3 p-2 rounded"
              style={{
                backgroundColor: payment.is_next
                  ? 'rgba(var(--christmas-green-rgb), 0.1)'
                  : 'transparent',
              }}
            >
              {/* Status indicator */}
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  payment.is_overdue
                    ? 'bg-red-500'
                    : payment.is_next
                    ? 'bg-green-500'
                    : ''
                }`}
                style={{
                  backgroundColor: payment.is_overdue
                    ? 'var(--status-error)'
                    : payment.is_next
                    ? 'var(--christmas-green)'
                    : 'var(--text-muted)',
                  opacity: payment.is_next || payment.is_overdue ? 1 : 0.5,
                }}
              />

              {/* Payment details */}
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span
                    style={{
                      color: payment.is_overdue
                        ? 'var(--status-error)'
                        : 'var(--text-secondary)',
                    }}
                  >
                    {formatDate(payment.due_date)}
                  </span>
                  <span
                    className="font-medium"
                    style={{ color: 'var(--christmas-cream)' }}
                  >
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                {payment.is_next && (
                  <div
                    className="text-xs"
                    style={{
                      color: payment.is_overdue
                        ? 'var(--status-error)'
                        : 'var(--christmas-green)',
                    }}
                  >
                    {formatDaysUntil(daysUntil)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {schedule.payments_remaining > schedule.upcoming.length && (
          <div
            className="text-center text-xs py-2"
            style={{ color: 'var(--text-muted)' }}
          >
            +{schedule.payments_remaining - schedule.upcoming.length} more payments
          </div>
        )}
      </div>
    </div>
  );
}
