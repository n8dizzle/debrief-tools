'use client';

import { APPaymentStatus } from '@/lib/supabase';

const statusConfig: Record<APPaymentStatus, { bg: string; text: string; label: string }> = {
  none: { bg: 'rgba(107, 124, 110, 0.15)', text: '#6B7C6E', label: 'None' },
  received: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', label: 'Received' },
  pending_approval: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fcd34d', label: 'Pending Approval' },
  ready_to_pay: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Ready to Pay' },
  paid: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', label: 'Paid' },
};

interface PaymentStatusBadgeProps {
  status: APPaymentStatus;
}

export default function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.none;

  return (
    <span
      className="badge"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}
