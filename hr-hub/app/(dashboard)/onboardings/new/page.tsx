'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatLocalDate } from '@/lib/hr-utils';

interface TemplateOption {
  id: string;
  name: string;
  workflow_type: string;
  is_base: boolean;
  portal_departments?: { name: string } | null;
}

const TRADES = ['HVAC', 'Plumbing', 'Both', 'N/A'];
const DEPARTMENTS = [
  { id: '', name: 'Select department...' },
  { id: 'hvac-install', name: 'HVAC Install' },
  { id: 'hvac-service', name: 'HVAC Service' },
  { id: 'hvac-maintenance', name: 'HVAC Maintenance' },
  { id: 'plumbing', name: 'Plumbing' },
  { id: 'dispatch', name: 'Dispatch' },
  { id: 'office', name: 'Office' },
  { id: 'management', name: 'Management' },
];

export default function NewOnboardingPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [form, setForm] = useState({
    employee_name: '',
    employee_email: '',
    employee_phone: '',
    position_title: '',
    department_id: '',
    trade: '',
    start_date: formatLocalDate(new Date()),
    template_id: '',
    hiring_manager_id: '',
    recruiter_id: '',
    notes: '',
    status: 'draft' as 'draft' | 'active',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.filter((t: any) => t.is_active));
        }
      } catch (err) {
        console.error('Error loading templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    }
    loadTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employee_name.trim() || !form.position_title.trim() || !form.start_date) {
      setError('Employee name, position title, and start date are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/onboardings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: form.employee_name.trim(),
          employee_email: form.employee_email.trim() || null,
          employee_phone: form.employee_phone.trim() || null,
          position_title: form.position_title.trim(),
          department_id: form.department_id || null,
          trade: form.trade || null,
          start_date: form.start_date,
          template_id: form.template_id || null,
          hiring_manager_id: form.hiring_manager_id.trim() || null,
          recruiter_id: form.recruiter_id.trim() || null,
          notes: form.notes.trim() || null,
          status: form.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create onboarding');
      }

      const onboarding = await res.json();
      router.push(`/onboardings/${onboarding.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Back link */}
      <button
        className="text-sm mb-4 flex items-center gap-1"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => router.push('/')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        New Onboarding
      </h1>

      {error && (
        <div
          className="card mb-4 text-sm"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Info */}
        <div className="card">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Employee Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Employee Name <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                className="input w-full"
                value={form.employee_name}
                onChange={(e) => updateField('employee_name', e.target.value)}
                placeholder="Full name"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="input w-full"
                  value={form.employee_email}
                  onChange={(e) => updateField('employee_email', e.target.value)}
                  placeholder="employee@email.com"
                />
              </div>
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  className="input w-full"
                  value={form.employee_phone}
                  onChange={(e) => updateField('employee_phone', e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Position Info */}
        <div className="card">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Position Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Position Title <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                className="input w-full"
                value={form.position_title}
                onChange={(e) => updateField('position_title', e.target.value)}
                placeholder="e.g., HVAC Service Technician"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Department
                </label>
                <select
                  className="select w-full"
                  value={form.department_id}
                  onChange={(e) => updateField('department_id', e.target.value)}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Trade
                </label>
                <select
                  className="select w-full"
                  value={form.trade}
                  onChange={(e) => updateField('trade', e.target.value)}
                >
                  <option value="">Select trade...</option>
                  {TRADES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Start Date <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                type="date"
                className="input w-full"
                value={form.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Workflow */}
        <div className="card">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
            Workflow & Assignment
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Template
              </label>
              <select
                className="select w-full"
                value={form.template_id}
                onChange={(e) => updateField('template_id', e.target.value)}
              >
                <option value="">No template (blank onboarding)</option>
                {loadingTemplates ? (
                  <option disabled>Loading templates...</option>
                ) : (
                  templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_base ? ' (Base)' : ''}
                      {t.portal_departments ? ` - ${t.portal_departments.name}` : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Selecting a template will auto-generate tasks based on the workflow steps.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Hiring Manager
                </label>
                <input
                  className="input w-full"
                  value={form.hiring_manager_id}
                  onChange={(e) => updateField('hiring_manager_id', e.target.value)}
                  placeholder="User ID or name"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Portal user ID of the hiring manager
                </p>
              </div>
              <div>
                <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Recruiter
                </label>
                <input
                  className="input w-full"
                  value={form.recruiter_id}
                  onChange={(e) => updateField('recruiter_id', e.target.value)}
                  placeholder="User ID or name"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Portal user ID of the recruiter
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Notes
              </label>
              <textarea
                className="input w-full"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                placeholder="Any additional notes about this onboarding..."
              />
            </div>

            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Initial Status
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={form.status === 'draft'}
                    onChange={() => updateField('status', 'draft')}
                  />
                  Draft
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={form.status === 'active'}
                    onChange={() => updateField('status', 'active')}
                  />
                  Active
                </label>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Draft onboardings are not visible in the active dashboard. Activate when ready.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Onboarding'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
