'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ARCollectionTaskExtended, ARSTTaskType, ARSTTaskSource, ARSTEmployee } from '@/lib/supabase';
import { formatDate } from '@/lib/ar-utils';

type StatusTab = 'todo' | 'in_progress' | 'canceled' | 'completed' | 'all';

interface FilterState {
  priorities: string[];
  dueDateFrom: string;
  dueDateTo: string;
  taskTypes: string[];
  assignedTo: string[];
}

interface TaskDetailModalProps {
  task: ARCollectionTaskExtended | null;
  isOpen: boolean;
  onClose: () => void;
  taskTypes: ARSTTaskType[];
  taskSources: ARSTTaskSource[];
  employees: ARSTEmployee[];
}

function TaskDetailModal({ task, isOpen, onClose, taskTypes, taskSources, employees }: TaskDetailModalProps) {
  if (!isOpen || !task) return null;

  // Helper functions to look up names from config
  const getTypeName = () => {
    if (task.task_type?.name) return task.task_type.name;
    if (task.st_type_id) {
      const type = taskTypes.find(t => t.st_type_id === task.st_type_id);
      return type?.name || '-';
    }
    return '-';
  };

  const getSourceName = () => {
    if (task.task_source?.name) return task.task_source.name;
    if (task.st_source_id) {
      const source = taskSources.find(s => s.st_source_id === task.st_source_id);
      return source?.name || '-';
    }
    return '-';
  };

  const getAssigneeName = () => {
    if (task.st_assigned_to) {
      const emp = employees.find(e => e.st_employee_id === task.st_assigned_to);
      return emp?.name || '-';
    }
    return '-';
  };

  const statusLabels: Record<string, string> = {
    pending: 'To Do',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Canceled',
  };

  const statusColors: Record<string, string> = {
    pending: '#3b82f6',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    cancelled: '#6b7280',
  };

  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    normal: '#3b82f6',
    low: '#6b7280',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Slide-out Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Task Details
            </h2>
            {task.st_task_id && (
              <a
                href={`https://go.servicetitan.com/#/TaskManagement/Task/${task.st_task_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--christmas-green)' }}
              >
                ST #{task.st_task_id}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Task Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Task Name
            </label>
            <div className="text-base font-medium" style={{ color: 'var(--christmas-cream)' }}>
              {task.title || '-'}
            </div>
          </div>

          {/* Status & Priority Row */}
          <div className="flex items-center gap-4">
            <span
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                backgroundColor: `${statusColors[task.status]}20`,
                color: statusColors[task.status],
              }}
            >
              {statusLabels[task.status] || task.status}
            </span>
            <span
              className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize"
              style={{
                backgroundColor: `${priorityColors[task.priority]}20`,
                color: priorityColors[task.priority],
              }}
            >
              {task.priority} Priority
            </span>
          </div>

          {/* Two Column Grid for Details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Task Type */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Task Type
              </label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {getTypeName()}
              </div>
            </div>

            {/* Task Source */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Task Source
              </label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {getSourceName()}
              </div>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Assigned To
              </label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {getAssigneeName()}
              </div>
            </div>

            {/* Created By */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Created By
              </label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {task.created_by_user?.name || '-'}
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Description
              </label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {task.description}
              </div>
            </div>
          )}

          {/* Linked Records Section */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Linked Records
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Job */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Job</label>
                {task.st_job_id ? (
                  <a
                    href={`https://go.servicetitan.com/#/Job/Index/${task.st_job_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                    style={{ color: 'var(--christmas-green)' }}
                  >
                    #{task.st_job_id}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>-</span>
                )}
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Customer</label>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {task.invoice?.customer_name || '-'}
                </span>
              </div>

              {/* Invoice */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Invoice</label>
                {task.invoice_id ? (
                  <Link
                    href={`/invoices/${task.invoice_id}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: 'var(--christmas-green)' }}
                  >
                    #{task.invoice?.invoice_number || task.invoice_id}
                  </Link>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>-</span>
                )}
              </div>

              {/* Balance */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Balance</label>
                <span className="text-sm font-medium" style={{ color: 'var(--christmas-red)' }}>
                  {task.invoice?.balance ? `$${task.invoice.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Dates
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Created On */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Created On</label>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {task.created_at ? formatDate(task.created_at) : '-'}
                </span>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Due Date</label>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {task.due_date ? formatDate(task.due_date) : '-'}
                </span>
              </div>

              {/* Completed On */}
              {task.completed_at && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Completed On</label>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(task.completed_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Outcome (if completed) */}
          {task.status === 'completed' && task.outcome && (
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Outcome
              </h3>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {task.outcome}
                {task.outcome_notes && (
                  <p className="mt-2" style={{ color: 'var(--text-muted)' }}>{task.outcome_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Edit in ServiceTitan notice */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              To edit this task, please use{' '}
              <a
                href="https://go.servicetitan.com/#/TaskManagement"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--christmas-green)' }}
              >
                ServiceTitan Task Management
              </a>
            </p>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 border-t" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition-colors btn-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Multi-select dropdown component
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="px-3 py-2 text-sm rounded-lg flex items-center justify-between gap-2 min-w-[140px]"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          color: selected.length > 0 ? 'var(--christmas-cream)' : 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayText}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', minWidth: '160px' }}
        >
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          )}
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<ARCollectionTaskExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>('todo');
  const [filters, setFilters] = useState<FilterState>({
    priorities: [],
    dueDateFrom: '',
    dueDateTo: '',
    taskTypes: [],
    assignedTo: [],
  });
  const [taskTypes, setTaskTypes] = useState<ARSTTaskType[]>([]);
  const [taskSources, setTaskSources] = useState<ARSTTaskSource[]>([]);
  const [employees, setEmployees] = useState<ARSTEmployee[]>([]);
  const [selectedTask, setSelectedTask] = useState<ARCollectionTaskExtended | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();
    fetchConfig();
    fetchLastSync();
  }, [activeTab, filters]);

  async function fetchLastSync() {
    try {
      const response = await fetch('/api/tasks/sync/last', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLastSyncAt(data.last_sync_at);
      }
    } catch (err) {
      console.error('Failed to fetch last task sync:', err);
    }
  }

  async function handleSyncFromST() {
    setSyncing(true);
    try {
      const response = await fetch('/api/tasks/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        await fetchTasks();
        await fetchLastSync();
      }
    } catch (err) {
      console.error('Failed to sync tasks:', err);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    }
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDatePicker]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('include_closed', 'true');
      params.set('limit', '200');

      if (activeTab !== 'all') {
        const statusMap: Record<StatusTab, string> = {
          todo: 'pending',
          in_progress: 'in_progress',
          canceled: 'cancelled',
          completed: 'completed',
          all: '',
        };
        if (statusMap[activeTab]) {
          params.set('status', statusMap[activeTab]);
        }
      }

      // Multi-select filters - use first value for now (API needs update for multiple)
      if (filters.priorities.length > 0) params.set('priority', filters.priorities[0]);
      if (filters.taskTypes.length > 0) params.set('st_type_id', filters.taskTypes[0]);
      if (filters.assignedTo.length > 0) params.set('assigned_to', filters.assignedTo[0]);
      if (filters.dueDateFrom) params.set('due_after', filters.dueDateFrom);
      if (filters.dueDateTo) params.set('due_before', filters.dueDateTo);

      const response = await fetch(`/api/tasks?${params}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        let taskList = data.tasks || [];

        // Client-side filtering for multi-select (until API supports it)
        if (filters.priorities.length > 1) {
          taskList = taskList.filter((t: ARCollectionTaskExtended) => filters.priorities.includes(t.priority));
        }
        if (filters.taskTypes.length > 1) {
          taskList = taskList.filter((t: ARCollectionTaskExtended) =>
            t.st_type_id && filters.taskTypes.includes(t.st_type_id.toString())
          );
        }
        if (filters.assignedTo.length > 1) {
          taskList = taskList.filter((t: ARCollectionTaskExtended) =>
            t.st_assigned_to && filters.assignedTo.includes(t.st_assigned_to.toString())
          );
        }

        setTasks(taskList);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfig() {
    try {
      const response = await fetch('/api/settings/st-task-config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTaskTypes(data.types || []);
        setTaskSources(data.sources || []);
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  const tabs: { id: StatusTab; label: string }[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'canceled', label: 'Canceled' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'View All' },
  ];

  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    normal: '#3b82f6',
    low: '#6b7280',
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pending: { label: 'To Do', color: '#3b82f6' },
      in_progress: { label: 'In Progress', color: '#f59e0b' },
      cancelled: { label: 'Canceled', color: '#6b7280' },
      completed: { label: 'Completed', color: '#22c55e' },
    };
    const config = statusConfig[status] || { label: status, color: '#6b7280' };
    return (
      <span
        className="px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const clearFilters = () => {
    setFilters({
      priorities: [],
      dueDateFrom: '',
      dueDateTo: '',
      taskTypes: [],
      assignedTo: [],
    });
  };

  const hasActiveFilters = filters.priorities.length > 0 || filters.dueDateFrom || filters.dueDateTo || filters.taskTypes.length > 0 || filters.assignedTo.length > 0;

  // Helper functions to look up names from config
  const getTaskTypeName = (task: ARCollectionTaskExtended) => {
    if (task.task_type?.name) return task.task_type.name;
    if (task.st_type_id) {
      const type = taskTypes.find(t => t.st_type_id === task.st_type_id);
      return type?.name || '-';
    }
    return '-';
  };

  const getAssigneeName = (task: ARCollectionTaskExtended) => {
    if (task.st_assigned_to) {
      const emp = employees.find(e => e.st_employee_id === task.st_assigned_to);
      return emp?.name || '-';
    }
    return '-';
  };

  const priorityOptions = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
              Task Management
            </h1>
            <a
              href="https://go.servicetitan.com/#/TaskManagement"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--christmas-green)' }}
              title="Open in ServiceTitan"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            {tasks.length} tasks
            {lastSyncAt && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                • Last synced {new Date(lastSyncAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSyncFromST}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync Tasks'}
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 text-sm font-medium transition-colors relative"
            style={{
              color: activeTab === tab.id ? 'var(--christmas-cream)' : 'var(--text-muted)',
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: 'var(--christmas-green)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority Filter */}
        <MultiSelectDropdown
          label="Priority"
          options={priorityOptions}
          selected={filters.priorities}
          onChange={(values) => setFilters(prev => ({ ...prev, priorities: values }))}
          placeholder="All Priorities"
        />

        {/* Due Date Range */}
        <div className="relative" ref={datePickerRef}>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-2 text-sm rounded-lg flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: filters.dueDateFrom || filters.dueDateTo ? 'var(--christmas-cream)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {filters.dueDateFrom || filters.dueDateTo ? (
              <span>{filters.dueDateFrom || 'Start'} - {filters.dueDateTo || 'End'}</span>
            ) : (
              <span>Due Date</span>
            )}
          </button>
          {showDatePicker && (
            <div
              className="absolute top-full mt-2 p-4 rounded-lg shadow-lg z-50"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>From</label>
                  <input
                    type="date"
                    value={filters.dueDateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dueDateFrom: e.target.value }))}
                    className="px-3 py-2 text-sm rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>To</label>
                  <input
                    type="date"
                    value={filters.dueDateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dueDateTo: e.target.value }))}
                    className="px-3 py-2 text-sm rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, dueDateFrom: '', dueDateTo: '' }));
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-1 text-sm rounded"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-sm rounded btn-primary"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Task Type Filter */}
        <MultiSelectDropdown
          label="Task Type"
          options={taskTypes.map(t => ({ value: t.st_type_id.toString(), label: t.name }))}
          selected={filters.taskTypes}
          onChange={(values) => setFilters(prev => ({ ...prev, taskTypes: values }))}
          placeholder="All Task Types"
        />

        {/* Assigned To Filter */}
        <MultiSelectDropdown
          label="Assigned To"
          options={employees.map(e => ({ value: e.st_employee_id.toString(), label: e.name }))}
          selected={filters.assignedTo}
          onChange={(values) => setFilters(prev => ({ ...prev, assignedTo: values }))}
          placeholder="All Assignees"
        />

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm rounded-lg hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Task Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ar-table" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Priority</th>
                <th style={{ width: '180px' }}>Customer</th>
                <th style={{ width: '100px' }}>Job #</th>
                <th>Name</th>
                <th style={{ width: '100px' }}>Type</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '100px' }}>Due Date</th>
                <th style={{ width: '140px' }}>Assigned To</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No tasks found
                  </td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <td>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                        style={{
                          backgroundColor: `${priorityColors[task.priority]}20`,
                          color: priorityColors[task.priority],
                        }}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm truncate block" style={{ maxWidth: '180px' }}>
                        {task.invoice?.customer_name || '-'}
                      </span>
                    </td>
                    <td>
                      {task.st_job_id ? (
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {task.st_job_id}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className="text-sm font-medium" style={{ color: 'var(--christmas-cream)' }}>
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {getTaskTypeName(task)}
                      </span>
                    </td>
                    <td>{getStatusBadge(task.status)}</td>
                    <td>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {task.due_date ? formatDate(task.due_date) : '-'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {getAssigneeName(task)}
                      </span>
                    </td>
                    <td>
                      {task.st_task_id && (
                        <a
                          href={`https://go.servicetitan.com/#/TaskManagement/Task/${task.st_task_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded hover:bg-white/10 inline-flex"
                          style={{ color: 'var(--christmas-green)' }}
                          title="Open in ServiceTitan"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        taskTypes={taskTypes}
        taskSources={taskSources}
        employees={employees}
      />
    </div>
  );
}
