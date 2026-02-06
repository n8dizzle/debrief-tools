'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ARCollectionTaskExtended, ARSTTaskType, ARSTTaskSource, ARSTEmployee, ARTaskStatus, ARTaskPriority } from '@/lib/supabase';
import { formatDate } from '@/lib/ar-utils';
import TaskCompleteModal from '@/components/TaskCompleteModal';

type StatusTab = 'todo' | 'in_progress' | 'on_hold' | 'canceled' | 'completed' | 'all';

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
  onUpdate: (taskId: string, updates: Partial<ARCollectionTaskExtended>) => Promise<void>;
  taskTypes: ARSTTaskType[];
  taskSources: ARSTTaskSource[];
  employees: ARSTEmployee[];
}

function TaskDetailModal({ task, isOpen, onClose, onUpdate, taskTypes, taskSources, employees }: TaskDetailModalProps) {
  const [status, setStatus] = useState<ARTaskStatus>('pending');
  const [priority, setPriority] = useState<ARTaskPriority>('normal');
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setPriority(task.priority);
      setAssignedTo(task.st_assigned_to || null);
      setDueDate(task.due_date || '');
      setTitle(task.title || '');
      setDescription(task.description || '');
    }
  }, [task]);

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
    if (task.assignee?.name) return task.assignee.name;
    if (task.st_assigned_to) {
      const emp = employees.find(e => e.st_employee_id === task.st_assigned_to);
      return emp?.name || '-';
    }
    return '-';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(task.id, {
        status,
        priority,
        st_assigned_to: assignedTo,
        due_date: dueDate || null,
        title,
        description,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setSaving(false);
    }
  };

  const statusOptions: { value: ARTaskStatus; label: string }[] = [
    { value: 'pending', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Canceled' },
  ];

  const priorityOptions: { value: ARTaskPriority; label: string }[] = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
  ];

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
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                ST #{task.st_task_id}
              </span>
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
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--christmas-cream)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          </div>

          {/* Two Column Grid for Details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Task Type (Read-only) */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Task Type
              </label>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {getTypeName()}
              </div>
            </div>

            {/* Task Source (Read-only) */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Task Source
              </label>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {getSourceName()}
              </div>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Assigned To
              </label>
              <select
                value={assignedTo || ''}
                onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <option value="">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.st_employee_id} value={emp.st_employee_id}>{emp.name}</option>
                ))}
              </select>
            </div>

            {/* Created By (Read-only) */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Created By
              </label>
              <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {task.created_by_user?.name || '-'}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: status === opt.value ? 'var(--christmas-green)' : 'var(--bg-secondary)',
                    color: status === opt.value ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: priority === opt.value ? priorityColors[opt.value] : 'var(--bg-secondary)',
                    color: priority === opt.value ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${priority === opt.value ? priorityColors[opt.value] : 'var(--border-subtle)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--christmas-cream)',
                border: '1px solid var(--border-subtle)',
              }}
              placeholder="Add task description..."
            />
          </div>

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
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Created On (Read-only) */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Created On</label>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {task.created_at ? formatDate(task.created_at) : '-'}
                </span>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
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
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();
    fetchConfig();
  }, [activeTab, filters]);

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
          on_hold: 'on_hold',
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

  async function handleUpdateTask(taskId: string, updates: Partial<ARCollectionTaskExtended>) {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update task');
    }

    fetchTasks();
  }

  const tabs: { id: StatusTab; label: string }[] = [
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'on_hold', label: 'On Hold' },
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
      on_hold: { label: 'On Hold', color: '#8b5cf6' },
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
    if (task.assignee?.name) return task.assignee.name;
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
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Task Management
        </h1>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
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
        onUpdate={handleUpdateTask}
        taskTypes={taskTypes}
        taskSources={taskSources}
        employees={employees}
      />
    </div>
  );
}
