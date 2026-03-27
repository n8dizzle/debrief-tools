'use client';

import { useState } from 'react';
import { ROLE_LABELS, ROLE_COLORS, TASK_STATUS_LABELS, formatDateDisplay, isOverdue, formatRelativeDate } from '@/lib/hr-utils';
import type { ResponsibleRole } from '@/lib/supabase';

interface TaskCardProps {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  guidance_text: string | null;
  responsible_role: ResponsibleRole;
  assigned_user_name?: string | null;
  due_date: string | null;
  status: string;
  is_conditional: boolean;
  condition_label: string | null;
  notes: string | null;
  canComplete: boolean;
  onStatusChange: (taskId: string, status: string, notes?: string) => void;
}

export default function TaskCard({
  id,
  onboarding_id,
  title,
  description,
  guidance_text,
  responsible_role,
  assigned_user_name,
  due_date,
  status,
  is_conditional,
  condition_label,
  notes,
  canComplete,
  onStatusChange,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [taskNotes, setTaskNotes] = useState(notes || '');
  const [saving, setSaving] = useState(false);

  const roleColor = ROLE_COLORS[responsible_role];
  const overdue = isOverdue(due_date) && (status === 'pending' || status === 'in_progress');
  const isDone = status === 'completed' || status === 'skipped' || status === 'na';

  const handleToggleComplete = async () => {
    if (!canComplete) return;
    const newStatus = status === 'completed' ? 'pending' : 'completed';
    onStatusChange(id, newStatus);
  };

  const handleMarkNA = () => {
    if (!canComplete) return;
    onStatusChange(id, 'na');
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await fetch(`/api/onboardings/${onboarding_id}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: taskNotes }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg p-3 transition-all"
      style={{
        backgroundColor: isDone ? 'var(--bg-primary)' : 'var(--bg-card)',
        border: `1px solid ${overdue ? 'var(--status-error)' : 'var(--border-subtle)'}`,
        opacity: isDone ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={handleToggleComplete}
          disabled={!canComplete}
          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: status === 'completed' ? 'var(--christmas-green)' : 'var(--border-default)',
            backgroundColor: status === 'completed' ? 'var(--christmas-green)' : 'transparent',
            cursor: canComplete ? 'pointer' : 'default',
          }}
        >
          {status === 'completed' && (
            <svg className="w-3 h-3" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'na' && (
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-medium text-sm"
              style={{
                color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                textDecoration: isDone ? 'line-through' : 'none',
              }}
            >
              {title}
            </span>

            {/* Role badge */}
            <span
              className="badge text-[10px]"
              style={{ backgroundColor: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}
            >
              {ROLE_LABELS[responsible_role]}
            </span>

            {/* Conditional badge */}
            {is_conditional && (
              <span
                className="badge text-[10px]"
                style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)' }}
              >
                {condition_label || 'Conditional'}
              </span>
            )}
          </div>

          {/* Due date and assignee row */}
          <div className="flex items-center gap-3 mt-1 text-xs">
            {due_date && (
              <span style={{ color: overdue ? 'var(--status-error)' : 'var(--text-muted)' }}>
                {overdue ? `Overdue: ${formatRelativeDate(due_date)}` : `Due: ${formatDateDisplay(due_date)}`}
              </span>
            )}
            {assigned_user_name && (
              <span style={{ color: 'var(--text-muted)' }}>
                Assigned: {assigned_user_name}
              </span>
            )}
          </div>

          {/* Description */}
          {description && !expanded && (
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
          )}
        </div>

        {/* Expand/actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {is_conditional && !isDone && canComplete && (
            <button
              onClick={handleMarkNA}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)' }}
              title="Mark as N/A"
            >
              N/A
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 ml-8 space-y-3">
          {description && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}

          {guidance_text && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(93, 138, 102, 0.08)', border: '1px solid rgba(93, 138, 102, 0.15)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-4 h-4" fill="none" stroke="var(--christmas-green-light)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium" style={{ color: 'var(--christmas-green-light)' }}>Guidance</span>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{guidance_text}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <div className="flex gap-2">
              <textarea
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                className="input text-sm flex-1"
                rows={2}
                placeholder="Add notes..."
              />
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="btn btn-secondary text-xs self-end"
              >
                {saving ? '...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
