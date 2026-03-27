'use client';

import { useState, useEffect, useCallback } from 'react';
import TaskCard from '@/components/TaskCard';
import { useHRPermissions } from '@/hooks/useHRPermissions';
import { isOverdue, formatLocalDate } from '@/lib/hr-utils';
import type { ResponsibleRole } from '@/lib/supabase';

interface MyTask {
  id: string;
  onboarding_id: string;
  title: string;
  description: string | null;
  guidance_text: string | null;
  responsible_role: ResponsibleRole;
  assigned_to: string | null;
  due_date: string | null;
  status: string;
  is_conditional: boolean;
  condition_label: string | null;
  notes: string | null;
  sort_order: number;
  phase_name: string;
  phase_sort_order: number;
  assigned_user?: { id: string; name: string; email: string } | null;
  hr_onboardings: {
    id: string;
    employee_name: string;
    position_title: string;
    start_date: string;
    status: string;
  };
}

export default function MyTasksPage() {
  const { userId, canCompleteAnyTask } = useHRPermissions();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/my-tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      setTasks(await res.json());
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusChange = async (taskId: string, status: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      const res = await fetch(`/api/onboardings/${task.onboarding_id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        // Refresh tasks
        await loadTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // Group tasks by onboarding (employee_name)
  const grouped = tasks.reduce<Record<string, { employee_name: string; position_title: string; onboarding_id: string; tasks: MyTask[] }>>((acc, task) => {
    const key = task.onboarding_id;
    if (!acc[key]) {
      acc[key] = {
        employee_name: task.hr_onboardings.employee_name,
        position_title: task.hr_onboardings.position_title,
        onboarding_id: task.onboarding_id,
        tasks: [],
      };
    }
    acc[key].tasks.push(task);
    return acc;
  }, {});

  // Sort tasks within each group by due_date
  for (const group of Object.values(grouped)) {
    group.tasks.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }

  const overdueCount = tasks.filter((t) => isOverdue(t.due_date) && ['pending', 'in_progress'].includes(t.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--christmas-green)' }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => { setLoading(true); setError(null); loadTasks(); }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          My Tasks
        </h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you
          </span>
          {overdueCount > 0 && (
            <span
              className="badge"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
            >
              {overdueCount} overdue
            </span>
          )}
        </div>
      </div>

      {/* Task groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>No tasks assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(grouped).map((group) => (
            <div key={group.onboarding_id}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                  {group.employee_name}
                </h2>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {group.position_title}
                </span>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    id={task.id}
                    onboarding_id={task.onboarding_id}
                    title={task.title}
                    description={task.description}
                    guidance_text={task.guidance_text}
                    responsible_role={task.responsible_role}
                    assigned_user_name={null}
                    due_date={task.due_date}
                    status={task.status}
                    is_conditional={task.is_conditional}
                    condition_label={task.condition_label}
                    notes={task.notes}
                    canComplete={canCompleteAnyTask || task.assigned_to === userId}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
