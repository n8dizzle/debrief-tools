'use client';

import { APDashboardStats } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';

interface StatsCardsProps {
  stats: APDashboardStats | null;
  isLoading: boolean;
}

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-24 rounded" style={{ background: 'var(--border-subtle)' }} />
            <div className="h-8 w-16 rounded mt-2" style={{ background: 'var(--border-subtle)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: 'Unassigned Jobs',
      value: String(stats.unassigned_jobs),
      color: stats.unassigned_jobs > 0 ? 'var(--status-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Contractor Usage',
      value: (stats.contractor_jobs + stats.in_house_jobs) > 0 ? `${stats.contractor_usage_pct}%` : 'N/A',
      subtext: `${stats.contractor_jobs} of ${stats.contractor_jobs + stats.in_house_jobs} assigned`,
      color: 'var(--text-primary)',
    },
    {
      label: 'Contractor %',
      value: stats.contractor_jobs > 0 ? `${stats.contractor_pct}%` : 'N/A',
      subtext: 'pay / job total',
      color: 'var(--text-primary)',
    },
    {
      label: 'Payments Outstanding',
      value: formatCurrency(stats.total_outstanding),
      subtext: `${stats.payments_pending_approval} pending approval, ${stats.payments_ready_to_pay} ready to pay`,
      color: stats.total_outstanding > 0 ? 'var(--status-warning)' : 'var(--status-success)',
    },
    {
      label: 'Total Paid',
      value: formatCurrency(stats.total_paid),
      color: 'var(--status-success)',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="card">
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {card.label}
          </div>
          <div className="text-2xl font-bold mt-1" style={{ color: card.color }}>
            {card.value}
          </div>
          {card.subtext && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {card.subtext}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
