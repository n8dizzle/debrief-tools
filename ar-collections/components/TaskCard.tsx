'use client';

import { ARCollectionTaskExtended, ARTaskStatus, ARTaskPriority, ARTaskSyncStatus } from '@/lib/supabase';
import { formatDate } from '@/lib/ar-utils';
import Link from 'next/link';

interface TaskCardProps {
  task: ARCollectionTaskExtended;
  onStatusChange?: (taskId: string, status: ARTaskStatus) => void;
  onComplete?: (taskId: string) => void;
  showInvoiceLink?: boolean;
  compact?: boolean;
}

// Generic task icon
function TaskIcon(): JSX.Element {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function getPriorityColor(priority: ARTaskPriority): string {
  switch (priority) {
    case 'urgent': return 'var(--status-error)';
    case 'high': return '#f97316';
    case 'normal': return 'var(--text-secondary)';
    case 'low': return 'var(--text-muted)';
  }
}

function getStatusColor(status: ARTaskStatus): string {
  switch (status) {
    case 'completed': return 'var(--status-success)';
    case 'in_progress': return '#60a5fa';
    case 'pending': return 'var(--text-muted)';
    case 'cancelled': return 'var(--status-error)';
  }
}

function getSyncStatusBadge(syncStatus: ARTaskSyncStatus): JSX.Element | null {
  const baseClass = "text-xs px-1.5 py-0.5 rounded";

  switch (syncStatus) {
    case 'synced':
      return (
        <span className={baseClass} style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
          ST Synced
        </span>
      );
    case 'pending_push':
      return (
        <span className={baseClass} style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' }}>
          Pending Sync
        </span>
      );
    case 'push_failed':
      return (
        <span className={baseClass} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
          Sync Failed
        </span>
      );
    case 'from_st':
      return (
        <span className={baseClass} style={{ backgroundColor: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' }}>
          From ST
        </span>
      );
    default:
      return null;
  }
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export default function TaskCard({
  task,
  onStatusChange,
  onComplete,
  showInvoiceLink = true,
  compact = false,
}: TaskCardProps) {
  const overdue = task.status !== 'completed' && task.status !== 'cancelled' && isOverdue(task.due_date);
  const taskTypeName = task.task_type?.name || 'Task';

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 p-2 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div style={{ color: 'var(--christmas-green-light)' }}>
          <TaskIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate" style={{ color: 'var(--christmas-cream)' }}>
            {task.title}
          </div>
          <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            {task.due_date && (
              <span style={{ color: overdue ? 'var(--status-error)' : 'inherit' }}>
                Due: {formatDate(task.due_date)}
              </span>
            )}
            {task.assignee && <span>{task.assignee.name}</span>}
          </div>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded capitalize"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: getStatusColor(task.status),
          }}
        >
          {task.status.replace('_', ' ')}
        </span>
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: overdue ? 'var(--status-error)' : 'var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--christmas-green-light)' }}
          >
            <TaskIcon />
          </div>
          <div>
            <div className="font-medium" style={{ color: 'var(--christmas-cream)' }}>
              {task.title}
            </div>
            <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
              <span>{taskTypeName}</span>
              <span style={{ color: getPriorityColor(task.priority) }}>
                {task.priority !== 'normal' && `${task.priority} priority`}
              </span>
              {getSyncStatusBadge(task.sync_status)}
            </div>
          </div>
        </div>
        <span
          className="text-xs px-2 py-1 rounded capitalize whitespace-nowrap"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: getStatusColor(task.status),
          }}
        >
          {task.status.replace('_', ' ')}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {task.description}
        </p>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        {task.due_date && (
          <div className="flex items-center gap-1" style={{ color: overdue ? 'var(--status-error)' : 'inherit' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{overdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}</span>
          </div>
        )}
        {task.assignee && (
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{task.assignee.name}</span>
          </div>
        )}
        {showInvoiceLink && task.invoice && (
          <Link
            href={`/invoices/${task.invoice.id}`}
            className="flex items-center gap-1 hover:underline"
            style={{ color: 'var(--christmas-green-light)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>#{task.invoice.invoice_number}</span>
          </Link>
        )}
      </div>

      {/* Outcome (if completed) */}
      {task.status === 'completed' && task.outcome && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Outcome
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {task.outcome}
            {task.outcome_notes && ` - ${task.outcome_notes}`}
          </div>
        </div>
      )}

      {/* Actions */}
      {task.status === 'pending' || task.status === 'in_progress' ? (
        <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
          {task.status === 'pending' && onStatusChange && (
            <button
              onClick={() => onStatusChange(task.id, 'in_progress')}
              className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
              style={{ backgroundColor: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' }}
            >
              Start Task
            </button>
          )}
          {onComplete && (
            <button
              onClick={() => onComplete(task.id)}
              className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
            >
              Complete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
