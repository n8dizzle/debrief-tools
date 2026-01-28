'use client';

import { ARPayment } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/ar-utils';
import { calculatePaymentHistoryWithBalance, isPaymentLate } from '@/lib/financing-utils';

interface PaymentHistoryProps {
  payments: ARPayment[];
  invoiceTotal: number;
  dueDay?: number | null;
  compact?: boolean;
}

export default function PaymentHistory({
  payments,
  invoiceTotal,
  dueDay,
  compact = false,
}: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        No payments recorded
      </div>
    );
  }

  const paymentsWithBalance = calculatePaymentHistoryWithBalance(payments, invoiceTotal);

  if (compact) {
    return (
      <div className="space-y-2">
        {paymentsWithBalance.slice(0, 3).map((payment) => {
          const isLate = dueDay ? isPaymentLate(payment.payment_date, dueDay) : false;
          return (
            <div
              key={payment.id}
              className="flex justify-between items-center text-sm"
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDate(payment.payment_date)}
              </span>
              <span style={{ color: 'var(--christmas-cream)' }}>
                {formatCurrency(payment.amount)}
              </span>
              {isLate && (
                <span className="text-xs" style={{ color: 'var(--status-warning)' }}>
                  *late
                </span>
              )}
            </div>
          );
        })}
        {paymentsWithBalance.length > 3 && (
          <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            +{paymentsWithBalance.length - 3} more payments
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {paymentsWithBalance.map((payment, index) => {
        const isLate = dueDay ? isPaymentLate(payment.payment_date, dueDay) : false;
        const isFirst = index === 0;

        return (
          <div
            key={payment.id}
            className="flex items-start gap-3"
          >
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: isFirst
                    ? 'var(--christmas-green)'
                    : 'var(--text-muted)',
                }}
              />
              {index < paymentsWithBalance.length - 1 && (
                <div
                  className="w-0.5 h-8 mt-1"
                  style={{ backgroundColor: 'var(--border-color)' }}
                />
              )}
            </div>

            {/* Payment details */}
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="font-medium"
                    style={{ color: 'var(--christmas-cream)' }}
                  >
                    {formatCurrency(payment.amount)}
                  </span>
                  {payment.payment_type && (
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {payment.payment_type}
                    </span>
                  )}
                  {isLate && (
                    <span
                      className="ml-2 text-xs"
                      style={{ color: 'var(--status-warning)' }}
                    >
                      (late)
                    </span>
                  )}
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(payment.payment_date)}
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Balance: {formatCurrency(payment.running_balance)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
