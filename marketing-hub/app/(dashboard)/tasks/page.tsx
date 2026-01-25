'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly' | 'monthly' | 'one_time';
  category: 'social' | 'gbp' | 'reviews' | 'reporting' | 'other' | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  due_date: string | null;
  recurrence_day: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_user?: { id: string; name: string; email: string } | null;
  completed_by_user?: { id: string; name: string; email: string } | null;
  created_by_user?: { id: string; name: string; email: string } | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  social: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
  gbp: { bg: 'rgba(52, 102, 67, 0.2)', text: '#4ADE80' },
  reviews: { bg: 'rgba(250, 204, 21, 0.15)', text: '#FACC15' },
  reporting: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7' },
  other: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', label: 'Pending' },
  in_progress: { bg: 'rgba(250, 204, 21, 0.15)', text: '#FACC15', label: 'In Progress' },
  completed: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ADE80', label: 'Completed' },
  skipped: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', label: 'Skipped' },
};

const TASK_TYPE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  one_time: 'One-time',
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

export default function TasksPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: 'one_time' as const,
    category: '' as string,
    due_date: '',
  });

  const canManageTasks = session?.user
    ? hasPermission(
        session.user.role as 'employee' | 'manager' | 'owner',
        session.user.permissions,
        'marketing_hub',
        'can_manage_tasks'
      )
    : false;

  const fetchTasks = async () => {
    try {
      let url = '/api/tasks?limit=100';
      if (filter === 'pending') {
        url += '&status=pending';
      } else if (filter === 'completed') {
        url += '&status=completed';
      }

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setTasks(data.tasks || []);
      } else {
        setError(data.error || 'Failed to load tasks');
      }
    } catch {
      setError('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageTasks) {
      setIsLoading(false);
      return;
    }
    fetchTasks();
  }, [canManageTasks, filter]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchTasks();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update task');
      }
    } catch {
      setError('Failed to update task');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || null,
          task_type: newTask.task_type,
          category: newTask.category || null,
          due_date: newTask.due_date || null,
        }),
      });

      if (response.ok) {
        setNewTask({
          title: '',
          description: '',
          task_type: 'one_time',
          category: '',
          due_date: '',
        });
        setIsCreating(false);
        fetchTasks();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create task');
      }
    } catch {
      setError('Failed to create task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTasks();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete task');
      }
    } catch {
      setError('Failed to delete task');
    }
  };

  if (!canManageTasks) {
    return (
      <div className="p-6">
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
            Access Restricted
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You don&apos;t have permission to manage tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Marketing Tasks
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage recurring and one-time marketing tasks
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'all', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: filter === f ? 'var(--christmas-green)' : 'var(--bg-card)',
              color: filter === f ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              border: filter === f ? 'none' : '1px solid var(--border-subtle)',
            }}
          >
            {f === 'pending' ? 'To Do' : f === 'all' ? 'All' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Create Task Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsCreating(false)}
          />
          <div
            className="relative w-full max-w-md rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
              Create New Task
            </h3>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title"
                  className="w-full rounded-lg px-4 py-2"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full rounded-lg px-4 py-2 resize-none"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Type
                  </label>
                  <select
                    value={newTask.task_type}
                    onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value as any })}
                    className="w-full rounded-lg px-4 py-2"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--christmas-cream)',
                    }}
                  >
                    <option value="one_time">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full rounded-lg px-4 py-2"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--christmas-cream)',
                    }}
                  >
                    <option value="">None</option>
                    <option value="social">Social</option>
                    <option value="gbp">GBP</option>
                    <option value="reviews">Reviews</option>
                    <option value="reporting">Reporting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full rounded-lg px-4 py-2"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--christmas-cream)',
                  }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--christmas-green)',
                    color: 'var(--christmas-cream)',
                  }}
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <svg
            className="w-8 h-8 animate-spin"
            style={{ color: 'var(--christmas-green)' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tasks.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>
            {filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {filter === 'completed'
              ? 'Complete some tasks to see them here.'
              : 'Create your first task to get started.'}
          </p>
          {filter !== 'completed' && (
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Task
            </button>
          )}
        </div>
      )}

      {/* Tasks List */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl p-4 transition-colors"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() =>
                    handleStatusChange(
                      task.id,
                      task.status === 'completed' ? 'pending' : 'completed'
                    )
                  }
                  className="flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 transition-colors"
                  style={{
                    borderColor:
                      task.status === 'completed' ? 'var(--christmas-green)' : 'var(--border-subtle)',
                    backgroundColor:
                      task.status === 'completed' ? 'var(--christmas-green)' : 'transparent',
                  }}
                >
                  {task.status === 'completed' && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3
                      className="text-sm font-medium"
                      style={{
                        color: 'var(--christmas-cream)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        opacity: task.status === 'completed' ? 0.6 : 1,
                      }}
                    >
                      {task.title}
                    </h3>
                    <CategoryBadge category={task.category} />
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                    >
                      {TASK_TYPE_LABELS[task.task_type]}
                    </span>
                  </div>

                  {task.description && (
                    <p
                      className="text-xs mb-2"
                      style={{
                        color: 'var(--text-muted)',
                        opacity: task.status === 'completed' ? 0.6 : 1,
                      }}
                    >
                      {task.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(task.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {task.assigned_to_user && (
                      <span>Assigned to {task.assigned_to_user.name || task.assigned_to_user.email}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
