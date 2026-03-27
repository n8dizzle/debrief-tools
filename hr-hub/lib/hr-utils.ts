import { ResponsibleRole } from './supabase';

export const ROLE_LABELS: Record<ResponsibleRole, string> = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  leadership: 'Leadership',
  hr: 'HR',
  employee: 'Employee',
};

export const ROLE_COLORS: Record<ResponsibleRole, { bg: string; text: string; border: string }> = {
  recruiter: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  hiring_manager: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
  leadership: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
  hr: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.3)' },
  employee: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' },
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af' },
  active: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
  paused: { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15' },
  completed: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
  na: 'N/A',
};

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return getDaysUntil(dateStr) < 0;
}

export function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const days = getDaysUntil(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < -1) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}
