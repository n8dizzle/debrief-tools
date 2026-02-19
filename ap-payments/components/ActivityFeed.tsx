'use client';

import { APActivityLog } from '@/lib/supabase';
import { formatTimestamp } from '@/lib/ap-utils';

interface ActivityFeedProps {
  activities: APActivityLog[];
  isLoading: boolean;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  job_synced: { label: 'Synced', color: 'var(--text-muted)' },
  assigned_inhouse: { label: 'Assigned In-House', color: 'var(--status-info)' },
  assigned_contractor: { label: 'Assigned Contractor', color: '#c084fc' },
  payment_received: { label: 'Invoice Received', color: '#fb923c' },
  payment_pending_approval: { label: 'Pending Approval', color: 'var(--status-warning)' },
  payment_ready_to_pay: { label: 'Ready to Pay', color: 'var(--status-info)' },
  payment_paid: { label: 'Paid', color: 'var(--status-success)' },
  amount_changed: { label: 'Amount Changed', color: 'var(--status-warning)' },
  unassigned: { label: 'Unassigned', color: 'var(--text-muted)' },
};

export default function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: 'var(--border-subtle)' }} />
            <div className="flex-1">
              <div className="h-4 w-48 rounded" style={{ background: 'var(--border-subtle)' }} />
              <div className="h-3 w-32 rounded mt-1" style={{ background: 'var(--border-subtle)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const config = actionLabels[activity.action] || { label: activity.action, color: 'var(--text-secondary)' };
        return (
          <div key={activity.id} className="flex gap-3 items-start">
            <div
              className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: config.color, fontWeight: 500 }}>{config.label}</span>
                {activity.description && (
                  <span style={{ color: 'var(--text-secondary)' }}> — {activity.description}</span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {formatTimestamp(activity.created_at)}
                {activity.performer?.name && ` by ${activity.performer.name}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
