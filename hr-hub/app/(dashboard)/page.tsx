'use client';

import { useState, useEffect, useCallback } from 'react';
import OnboardingCard from '@/components/OnboardingCard';
import { formatLocalDate, isOverdue } from '@/lib/hr-utils';

interface DashboardData {
  active_onboardings: number;
  overdue_tasks: number;
  due_this_week: number;
  completed_this_month: number;
  recent_activity: Array<{
    id: string;
    action: string;
    details: Record<string, any>;
    created_at: string;
    actor?: { id: string; name: string } | null;
  }>;
  active_onboardings_list: Array<{
    id: string;
    employee_name: string;
    position_title: string;
    start_date: string;
    status: string;
    task_count: number;
    completed_count: number;
    overdue_count: number;
    portal_departments?: { id: string; name: string; slug: string } | null;
    tasks?: Array<{
      id: string;
      status: string;
      due_date: string | null;
      phase_name: string;
      phase_sort_order?: number;
      title: string;
      responsible_role: string;
    }>;
  }>;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionDescription(action: string, details: Record<string, any>): string {
  switch (action) {
    case 'onboarding_created':
      return `created onboarding for ${details.employee_name || 'an employee'}`;
    case 'onboarding_activated':
      return `activated onboarding for ${details.employee_name || 'an employee'}`;
    case 'onboarding_paused':
      return `paused onboarding for ${details.employee_name || 'an employee'}`;
    case 'onboarding_completed':
      return `completed onboarding for ${details.employee_name || 'an employee'}`;
    case 'onboarding_cancelled':
      return `cancelled onboarding for ${details.employee_name || 'an employee'}`;
    case 'task_status_changed':
      return `marked "${details.task_title || 'task'}" as ${details.to_status || 'updated'}`;
    default:
      return action.replace(/_/g, ' ');
  }
}

const STAT_CARDS = [
  { key: 'active_onboardings', label: 'Active Onboardings', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.5)', icon: 'users' },
  { key: 'overdue_tasks', label: 'Overdue Tasks', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.5)', icon: 'alert' },
  { key: 'due_this_week', label: 'Due This Week', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.5)', icon: 'clock' },
  { key: 'completed_this_month', label: 'Completed This Month', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.5)', icon: 'check' },
] as const;

function StatIcon({ type, color }: { type: string; color: string }) {
  const props = { className: 'w-6 h-6', fill: 'none', stroke: color, viewBox: '0 0 24 24' };
  switch (type) {
    case 'users':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      setData(await res.json());
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => { setLoading(true); setError(null); loadData(); }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Compute onboarding card data from the active_onboardings_list
  const todayStr = formatLocalDate(new Date());
  const onboardingCards = data.active_onboardings_list.map((ob) => {
    const tasks = ob.tasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const overdueTasks = tasks.filter(
      (t) =>
        ['pending', 'in_progress'].includes(t.status) &&
        t.due_date &&
        t.due_date < todayStr
    ).length;

    // Find current phase: first phase with incomplete tasks
    const phaseMap = new Map<string, { sort: number; incomplete: number }>();
    for (const t of tasks) {
      const key = t.phase_name;
      if (!phaseMap.has(key)) {
        phaseMap.set(key, { sort: t.phase_sort_order || 0, incomplete: 0 });
      }
      if (t.status !== 'completed' && t.status !== 'skipped' && t.status !== 'na') {
        phaseMap.get(key)!.incomplete++;
      }
    }
    const sortedPhases = [...phaseMap.entries()].sort((a, b) => a[1].sort - b[1].sort);
    const currentPhase = sortedPhases.find(([, v]) => v.incomplete > 0)?.[0];

    // Find next due task
    const pendingTasks = tasks
      .filter((t) => ['pending', 'in_progress'].includes(t.status) && t.due_date)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    const nextDueTask = pendingTasks[0]
      ? { title: pendingTasks[0].title, due_date: pendingTasks[0].due_date!, responsible_role: pendingTasks[0].responsible_role }
      : null;

    return {
      id: ob.id,
      employee_name: ob.employee_name,
      position_title: ob.position_title,
      department_name: ob.portal_departments?.name,
      start_date: ob.start_date,
      status: ob.status,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: overdueTasks,
      current_phase: currentPhase,
      next_due_task: nextDueTask,
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Onboarding overview and task status
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="card"
            style={{ borderLeft: `3px solid ${card.borderColor}` }}
          >
            <div className="flex items-center gap-3">
              <StatIcon type={card.icon} color={card.color} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {card.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: card.color }}>
                  {data[card.key as keyof DashboardData] as number}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main content: onboardings + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Onboardings */}
        <div className="xl:col-span-2">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Active Onboardings
          </h2>
          {onboardingCards.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>No active onboardings</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {onboardingCards.map((ob) => (
                <OnboardingCard key={ob.id} {...ob} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Recent Activity
          </h2>
          <div className="card" style={{ padding: 0 }}>
            {data.recent_activity.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No recent activity</p>
              </div>
            ) : (
              <div>
                {data.recent_activity.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="px-4 py-3"
                    style={{
                      borderBottom: i < data.recent_activity.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          <span className="font-medium" style={{ color: 'var(--christmas-green-light)' }}>
                            {entry.actor?.name || 'System'}
                          </span>{' '}
                          {getActionDescription(entry.action, entry.details)}
                        </p>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {getTimeAgo(entry.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
