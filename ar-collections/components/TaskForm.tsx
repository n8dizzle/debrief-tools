'use client';

import { useState, useEffect } from 'react';
import { ARTaskPriority, ARSTTaskType, ARSTEmployee } from '@/lib/supabase';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskFormData) => Promise<void>;
  initialData?: Partial<TaskFormData>;
  invoiceId?: string;
  customerId?: string;
  mode?: 'create' | 'edit';
}

export interface TaskFormData {
  title: string;
  description: string;
  st_type_id: number | null;
  priority: ARTaskPriority;
  st_assigned_to: number | null;
  due_date: string | null;
  push_to_st: boolean;
}

const PRIORITIES: { value: ARTaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TaskForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode = 'create',
}: TaskFormProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    st_type_id: null,
    priority: 'normal',
    st_assigned_to: null,
    due_date: null,
    push_to_st: false,
  });
  const [taskTypes, setTaskTypes] = useState<ARSTTaskType[]>([]);
  const [employees, setEmployees] = useState<ARSTEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: initialData?.title || '',
        description: initialData?.description || '',
        st_type_id: initialData?.st_type_id || null,
        priority: initialData?.priority || 'normal',
        st_assigned_to: initialData?.st_assigned_to || null,
        due_date: initialData?.due_date || null,
        push_to_st: initialData?.push_to_st || false,
      });
      setError(null);
      fetchSTConfig();
    }
  }, [isOpen, initialData]);

  async function fetchSTConfig() {
    try {
      const response = await fetch('/api/settings/st-task-config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTaskTypes(data.types || []);
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Failed to fetch ST config:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-lg shadow-xl"
          style={{ backgroundColor: 'var(--bg-card)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              {mode === 'create' ? 'Create Task' : 'Edit Task'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)' }}
              >
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Follow up on payment"
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Type
                </label>
                <select
                  value={formData.st_type_id || ''}
                  onChange={(e) => setFormData({ ...formData, st_type_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <option value="">Select type...</option>
                  {taskTypes.map(type => (
                    <option key={type.st_type_id} value={type.st_type_id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as ARTaskPriority })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add notes or details..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg resize-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>

            {/* Assignee and Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Assign To
                </label>
                <select
                  value={formData.st_assigned_to || ''}
                  onChange={(e) => setFormData({ ...formData, st_assigned_to: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg"
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
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--christmas-cream)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>
            </div>

            {/* Push to ServiceTitan option (only for create mode) */}
            {mode === 'create' && (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input
                  type="checkbox"
                  id="push_to_st"
                  checked={formData.push_to_st}
                  onChange={(e) => setFormData({ ...formData, push_to_st: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="push_to_st" className="text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  Also create in ServiceTitan
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
