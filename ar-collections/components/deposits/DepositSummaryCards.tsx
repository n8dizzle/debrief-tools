'use client';

import { formatCurrency } from '@/lib/ar-utils';

interface DepositSummary {
  totalUndeposited: number;
  undepositedCount: number;
  needsTracking: number;
  needsTrackingCount: number;
  pendingMatch: number;
  pendingMatchCount: number;
  matchedToday: number;
  matchedTodayCount: number;
  byType: {
    cash: number;
    check: number;
    card: number;
    other: number;
  };
}

interface DepositSummaryCardsProps {
  summary: DepositSummary | null;
  loading: boolean;
}

export default function DepositSummaryCards({ summary, loading }: DepositSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 w-24 bg-gray-700 rounded mb-2"></div>
            <div className="h-8 w-32 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Needs Tracking - ST payments not in QB (critical!) */}
      <div className="card" style={{ borderColor: summary.needsTrackingCount > 0 ? 'var(--status-error)' : undefined }}>
        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Needs Tracking
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: summary.needsTrackingCount > 0 ? 'var(--status-error)' : 'var(--christmas-green)' }}>
          {formatCurrency(summary.needsTracking)}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {summary.needsTrackingCount} collected, not in QB
        </div>
      </div>

      {/* In QB Undeposited Funds */}
      <div className="card">
        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          In QB Undeposited
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: '#f97316' }}>
          {formatCurrency(summary.totalUndeposited)}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {summary.undepositedCount} awaiting bank deposit
        </div>
      </div>

      {/* Matched Today */}
      <div className="card">
        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Matched Today
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--christmas-green)' }}>
          {formatCurrency(summary.matchedToday)}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {summary.matchedTodayCount} reconciled
        </div>
      </div>

      {/* Payment Types Breakdown - Needs Tracking by Type */}
      <div className="card">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          Needs Tracking by Type
        </div>
        <div className="space-y-1 text-sm">
          {summary.byType.cash > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Cash</span>
              <span className="tabular-nums" style={{ color: 'var(--status-error)' }}>
                {formatCurrency(summary.byType.cash)}
              </span>
            </div>
          )}
          {summary.byType.check > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Check</span>
              <span className="tabular-nums" style={{ color: 'var(--status-error)' }}>
                {formatCurrency(summary.byType.check)}
              </span>
            </div>
          )}
          {summary.byType.card > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Card</span>
              <span className="tabular-nums" style={{ color: 'var(--status-error)' }}>
                {formatCurrency(summary.byType.card)}
              </span>
            </div>
          )}
          {summary.byType.other > 0 && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Other</span>
              <span className="tabular-nums" style={{ color: 'var(--status-error)' }}>
                {formatCurrency(summary.byType.other)}
              </span>
            </div>
          )}
          {Object.values(summary.byType).every(v => v === 0) && (
            <span style={{ color: 'var(--christmas-green)' }}>All clear!</span>
          )}
        </div>
      </div>
    </div>
  );
}
