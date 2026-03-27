'use client';

import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS, ROLE_LABELS, formatDateDisplay, isOverdue, formatRelativeDate } from '@/lib/hr-utils';

interface OnboardingCardProps {
  id: string;
  employee_name: string;
  position_title: string;
  department_name?: string;
  start_date: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  current_phase?: string;
  next_due_task?: { title: string; due_date: string; responsible_role: string } | null;
}

export default function OnboardingCard({
  id,
  employee_name,
  position_title,
  department_name,
  start_date,
  status,
  total_tasks,
  completed_tasks,
  overdue_tasks,
  current_phase,
  next_due_task,
}: OnboardingCardProps) {
  const progress = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.draft;

  return (
    <Link href={`/onboardings/${id}`} className="block">
      <div
        className="card transition-all duration-200 hover:border-[var(--christmas-green-dark)]"
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-base" style={{ color: 'var(--christmas-cream)' }}>
              {employee_name}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {position_title}
              {department_name && ` · ${department_name}`}
            </p>
          </div>
          <span
            className="badge"
            style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
          >
            {STATUS_LABELS[status] || status}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {completed_tasks}/{total_tasks} tasks
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--christmas-green-light)' }}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: overdue_tasks > 0 ? 'var(--status-error)' : 'var(--christmas-green)',
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--text-muted)' }}>
            Start: {formatDateDisplay(start_date)}
          </span>
          {overdue_tasks > 0 && (
            <span style={{ color: 'var(--status-error)' }}>
              {overdue_tasks} overdue
            </span>
          )}
        </div>

        {current_phase && (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Current: {current_phase}
          </div>
        )}

        {next_due_task && (
          <div
            className="mt-2 p-2 rounded-lg text-xs"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>
                Next: {next_due_task.title}
              </span>
              <span style={{ color: isOverdue(next_due_task.due_date) ? 'var(--status-error)' : 'var(--text-muted)' }}>
                {formatRelativeDate(next_due_task.due_date)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
