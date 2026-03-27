'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import PhaseProgress from '@/components/PhaseProgress';
import TaskCard from '@/components/TaskCard';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  ROLE_LABELS,
  formatDateDisplay,
  formatLocalDate,
  isOverdue,
} from '@/lib/hr-utils';
import type { HROnboarding, HROnboardingTask, HRActivityLog, ResponsibleRole } from '@/lib/supabase';

interface OnboardingDetail extends HROnboarding {
  tasks: HROnboardingTask[];
  activity_log: HRActivityLog[];
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
      return `Created onboarding for ${details.employee_name || 'employee'}`;
    case 'onboarding_activated':
      return `Activated onboarding`;
    case 'onboarding_paused':
      return `Paused onboarding`;
    case 'onboarding_completed':
      return `Completed onboarding`;
    case 'onboarding_cancelled':
      return `Cancelled onboarding`;
    case 'onboarding_reverted_to_draft':
      return `Reverted onboarding to draft`;
    case 'task_status_changed':
      return `Marked "${details.task_title || 'task'}" as ${details.to_status || 'updated'}`;
    default:
      return action.replace(/_/g, ' ');
  }
}

export default function OnboardingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const onboardingId = params.id as string;
  const { userId, isOwner, canCompleteAnyTask } = useHRPermissions();

  const [data, setData] = useState<OnboardingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  // Track expanded phase sections
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboardings/${onboardingId}`);
      if (!res.ok) throw new Error('Onboarding not found');
      const result = await res.json();
      setData(result);
      // Expand all phases by default
      const phaseNames = new Set(
        (result.tasks || []).map((t: HROnboardingTask) => t.phase_name)
      );
      setExpandedPhases(phaseNames as Set<string>);
    } catch (err) {
      console.error('Error loading onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to load onboarding');
    } finally {
      setLoading(false);
    }
  }, [onboardingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusUpdate = async (newStatus: string) => {
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/onboardings/${onboardingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setStatusChanging(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    try {
      const res = await fetch(`/api/onboardings/${onboardingId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const togglePhase = (phaseName: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseName)) next.delete(phaseName);
      else next.add(phaseName);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: '1rem' }}>{error || 'Not found'}</p>
        <button className="btn btn-secondary" onClick={() => router.push('/')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const tasks = data.tasks || [];
  const todayStr = formatLocalDate(new Date());

  // Task stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const overdueTasks = tasks.filter(
    (t) => ['pending', 'in_progress'].includes(t.status) && t.due_date && t.due_date < todayStr
  ).length;
  const remainingTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'skipped' && t.status !== 'na'
  ).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group tasks by phase_name (ordered by phase_sort_order)
  const phaseGroups: { name: string; sortOrder: number; tasks: HROnboardingTask[] }[] = [];
  const phaseMap = new Map<string, { sortOrder: number; tasks: HROnboardingTask[] }>();
  for (const task of tasks) {
    if (!phaseMap.has(task.phase_name)) {
      phaseMap.set(task.phase_name, { sortOrder: task.phase_sort_order, tasks: [] });
    }
    phaseMap.get(task.phase_name)!.tasks.push(task);
  }
  for (const [name, value] of phaseMap.entries()) {
    phaseGroups.push({ name, sortOrder: value.sortOrder, tasks: value.tasks });
  }
  phaseGroups.sort((a, b) => a.sortOrder - b.sortOrder);

  // Phase progress data
  const phaseProgressData = phaseGroups.map((group) => {
    const total = group.tasks.length;
    const completed = group.tasks.filter((t) => t.status === 'completed').length;
    const hasOverdue = group.tasks.some(
      (t) => ['pending', 'in_progress'].includes(t.status) && t.due_date && t.due_date < todayStr
    );
    const hasIncomplete = group.tasks.some(
      (t) => t.status !== 'completed' && t.status !== 'skipped' && t.status !== 'na'
    );
    // Current phase = first phase with incomplete tasks
    const isCurrent = hasIncomplete && phaseGroups.findIndex((g) => {
      return g.tasks.some((t) => t.status !== 'completed' && t.status !== 'skipped' && t.status !== 'na');
    }) === phaseGroups.indexOf(group);

    return {
      name: group.name,
      total,
      completed,
      hasOverdue,
      isCurrent,
    };
  });

  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.draft;

  // Status action buttons
  const statusActions: { label: string; status: string; color: string }[] = [];
  if (data.status === 'draft') {
    statusActions.push({ label: 'Activate', status: 'active', color: '#22c55e' });
  }
  if (data.status === 'active') {
    statusActions.push({ label: 'Pause', status: 'paused', color: '#eab308' });
    statusActions.push({ label: 'Complete', status: 'completed', color: '#3b82f6' });
    statusActions.push({ label: 'Cancel', status: 'cancelled', color: '#ef4444' });
  }
  if (data.status === 'paused') {
    statusActions.push({ label: 'Resume', status: 'active', color: '#22c55e' });
    statusActions.push({ label: 'Cancel', status: 'cancelled', color: '#ef4444' });
  }

  return (
    <div>
      {/* Back link */}
      <button
        className="text-sm mb-4 flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => router.push('/')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
                {data.employee_name}
              </h1>
              <span
                className="badge"
                style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
              >
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {data.position_title}
              {data.portal_departments && ` · ${data.portal_departments.name}`}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Start date: {formatDateDisplay(data.start_date)}
            </p>
          </div>
          {isOwner && statusActions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusActions.map((action) => (
                <button
                  key={action.status}
                  className="btn text-xs"
                  style={{
                    backgroundColor: `${action.color}15`,
                    color: action.color,
                    border: `1px solid ${action.color}30`,
                  }}
                  onClick={() => handleStatusUpdate(action.status)}
                  disabled={statusChanging}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase Progress */}
      {phaseProgressData.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Phase Progress
          </h2>
          <PhaseProgress phases={phaseProgressData} />
        </div>
      )}

      {/* Main content: tasks + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Tasks (3 cols) */}
        <div className="xl:col-span-3 space-y-4">
          {phaseGroups.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>No tasks yet. Create this onboarding with a template to generate tasks.</p>
            </div>
          ) : (
            phaseGroups.map((group) => {
              const isExpanded = expandedPhases.has(group.name);
              const phaseCompleted = group.tasks.filter((t) => t.status === 'completed').length;

              // Sub-group tasks by responsible_role
              const roleGroups = new Map<ResponsibleRole, HROnboardingTask[]>();
              for (const task of group.tasks) {
                const role = task.responsible_role;
                if (!roleGroups.has(role)) roleGroups.set(role, []);
                roleGroups.get(role)!.push(task);
              }

              return (
                <div key={group.name} className="card" style={{ padding: 0 }}>
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                    onClick={() => togglePhase(group.name)}
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="var(--text-muted)"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                        {group.name}
                      </h3>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {phaseCompleted}/{group.tasks.length} complete
                    </span>
                  </button>

                  {isExpanded && (
                    <div
                      className="px-4 pb-4 space-y-4"
                      style={{ borderTop: '1px solid var(--border-subtle)' }}
                    >
                      {[...roleGroups.entries()].map(([role, roleTasks]) => (
                        <div key={role} className="mt-3">
                          <p
                            className="text-xs font-medium mb-2 uppercase tracking-wide"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {ROLE_LABELS[role]}
                          </p>
                          <div className="space-y-2">
                            {roleTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                id={task.id}
                                onboarding_id={task.onboarding_id}
                                title={task.title}
                                description={task.description}
                                guidance_text={task.guidance_text}
                                responsible_role={task.responsible_role}
                                assigned_user_name={task.assigned_user?.name || null}
                                due_date={task.due_date}
                                status={task.status}
                                is_conditional={task.is_conditional}
                                condition_label={task.condition_label}
                                notes={task.notes}
                                canComplete={
                                  canCompleteAnyTask || task.assigned_to === userId
                                }
                                onStatusChange={handleTaskStatusChange}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar (1 col) */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Progress
            </h3>
            <div className="flex items-center justify-center mb-3">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke="var(--bg-primary)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke={overdueTasks > 0 ? 'var(--status-error)' : 'var(--christmas-green)'}
                    strokeWidth="3"
                    strokeDasharray={`${progressPct} ${100 - progressPct}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
                    {progressPct}%
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Total</span>
                <span style={{ color: 'var(--text-primary)' }}>{totalTasks}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                <span style={{ color: '#4ade80' }}>{completedTasks}</span>
              </div>
              {overdueTasks > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Overdue</span>
                  <span style={{ color: 'var(--status-error)' }}>{overdueTasks}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
                <span style={{ color: 'var(--text-primary)' }}>{remainingTasks}</span>
              </div>
            </div>
          </div>

          {/* Employee Details */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Employee Details
            </h3>
            <div className="space-y-2 text-sm">
              {data.employee_email && (
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</span>
                  <p style={{ color: 'var(--text-primary)' }}>{data.employee_email}</p>
                </div>
              )}
              {data.employee_phone && (
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Phone</span>
                  <p style={{ color: 'var(--text-primary)' }}>{data.employee_phone}</p>
                </div>
              )}
              <div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Start Date</span>
                <p style={{ color: 'var(--text-primary)' }}>{formatDateDisplay(data.start_date)}</p>
              </div>
              {data.trade && (
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Trade</span>
                  <p style={{ color: 'var(--text-primary)' }}>{data.trade}</p>
                </div>
              )}
            </div>
          </div>

          {/* Assigned People */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Assigned People
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hiring Manager</span>
                <p style={{ color: 'var(--text-primary)' }}>
                  {data.hiring_manager?.name || 'Not assigned'}
                </p>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Recruiter</span>
                <p style={{ color: 'var(--text-primary)' }}>
                  {data.recruiter?.name || 'Not assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="card">
              <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Notes
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {data.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      {data.activity_log && data.activity_log.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Activity Log
          </h2>
          <div className="card" style={{ padding: 0 }}>
            {data.activity_log.map((entry, i) => (
              <div
                key={entry.id}
                className="px-4 py-3"
                style={{
                  borderBottom: i < data.activity_log.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
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
        </div>
      )}
    </div>
  );
}
