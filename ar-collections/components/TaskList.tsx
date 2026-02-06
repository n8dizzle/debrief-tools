'use client';

import { useState, useEffect } from 'react';
import { ARCollectionTaskExtended, ARTaskStatus, ARTaskPriority, PortalUser, ARSTTaskType } from '@/lib/supabase';
import { formatDate } from '@/lib/ar-utils';
import TaskCard from './TaskCard';
import TaskForm, { TaskFormData } from './TaskForm';
import TaskCompleteModal from './TaskCompleteModal';
import Link from 'next/link';

interface TaskListProps {
  invoiceId?: string;
  customerId?: string;
  showFilters?: boolean;
  showCreateButton?: boolean;
  compact?: boolean;
  maxItems?: number;
  defaultFilter?: 'all' | 'due_today' | 'overdue';
}

type FilterTab = 'all' | 'due_today' | 'overdue' | 'pending' | 'completed';

export default function TaskList({
  invoiceId,
  customerId,
  showFilters = true,
  showCreateButton = true,
  compact = false,
  maxItems,
  defaultFilter = 'all',
}: TaskListProps) {
  const [tasks, setTasks] = useState<ARCollectionTaskExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>(defaultFilter);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<ARTaskPriority | ''>('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [taskTypes, setTaskTypes] = useState<ARSTTaskType[]>([]);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    fetchTaskTypes();
  }, [invoiceId, customerId, activeTab, typeFilter, priorityFilter, includeClosed]);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  async function fetchTaskTypes() {
    try {
      const response = await fetch('/api/settings/st-task-config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTaskTypes(data.types || []);
      }
    } catch (err) {
      console.error('Failed to fetch task types:', err);
    }
  }

  async function fetchTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (invoiceId) params.set('invoice_id', invoiceId);
      if (customerId) params.set('customer_id', customerId);
      if (typeFilter) params.set('st_type_id', typeFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (maxItems) params.set('limit', maxItems.toString());
      if (includeClosed) params.set('include_closed', 'true');

      // Apply tab-based filters
      const today = new Date().toISOString().split('T')[0];
      switch (activeTab) {
        case 'due_today':
          params.set('due_before', today);
          params.set('due_after', today);
          params.set('status', 'pending');
          break;
        case 'overdue':
          params.set('due_before', today);
          params.set('status', 'pending');
          break;
        case 'pending':
          params.set('status', 'pending');
          break;
        case 'completed':
          params.set('status', 'completed');
          break;
      }

      const response = await fetch(`/api/tasks?${params}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(formData: TaskFormData) {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...formData,
        invoice_id: invoiceId,
        customer_id: customerId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create task');
    }

    fetchTasks();
  }

  async function handleStatusChange(taskId: string, status: ARTaskStatus) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  }

  async function handleCompleteTask(data: {
    outcome: string;
    outcome_notes: string;
    followup_required: boolean;
    followup_date: string | null;
  }) {
    if (!taskToComplete) return;

    const response = await fetch(`/api/tasks/${taskToComplete}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to complete task');
    }

    setTaskToComplete(null);
    fetchTasks();
  }

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'due_today', label: 'Due Today' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
  ];

  // For compact view in invoice details
  if (compact) {
    return (
      <div className="space-y-3">
        {showCreateButton && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-sm"
            >
              + Add Task
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tasks yet
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                compact
                showInvoiceLink={false}
                onStatusChange={handleStatusChange}
                onComplete={(id) => setTaskToComplete(id)}
              />
            ))}
          </div>
        )}

        <TaskForm
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
          invoiceId={invoiceId}
          customerId={customerId}
        />

        <TaskCompleteModal
          isOpen={!!taskToComplete}
          onClose={() => setTaskToComplete(null)}
          onComplete={handleCompleteTask}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Tab filters */}
          <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: activeTab === tab.id ? 'var(--christmas-green)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type and priority filters + Create button */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--christmas-cream)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <option value="">All Types</option>
              {taskTypes.map(type => (
                <option key={type.st_type_id} value={type.st_type_id}>{type.name}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as ARTaskPriority | '')}
              className="px-2 py-1.5 text-sm rounded-lg"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--christmas-cream)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={(e) => setIncludeClosed(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{
                  accentColor: 'var(--christmas-green)',
                }}
              />
              Show closed AR
            </label>

            {showCreateButton && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-sm"
              >
                + Create Task
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 card">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p style={{ color: 'var(--text-muted)' }}>No tasks found</p>
          {showCreateButton && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary mt-4"
            >
              Create Your First Task
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onComplete={(id) => setTaskToComplete(id)}
              showInvoiceLink={!invoiceId}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <TaskForm
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTask}
        invoiceId={invoiceId}
        customerId={customerId}
      />

      <TaskCompleteModal
        isOpen={!!taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onComplete={handleCompleteTask}
      />
    </div>
  );
}
