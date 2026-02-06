'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrackerTemplate, Trade, JobType } from '@/lib/supabase';

interface CreateTrackerFormProps {
  templates: TrackerTemplate[];
  userId: string;
}

export default function CreateTrackerForm({ templates, userId }: CreateTrackerFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    job_address: '',
    job_number: '',
    trade: 'hvac' as Trade,
    job_type: 'install' as JobType,
    job_description: '',
    template_id: '',
    scheduled_date: '',
    estimated_completion: '',
    notify_sms: false,
    notify_email: true,
  });

  // Filter templates by trade and job type
  const filteredTemplates = templates.filter(
    (t) => t.trade === formData.trade && t.job_type === formData.job_type
  );

  // Auto-select default template when trade/job_type changes
  function handleTradeChange(trade: Trade) {
    setFormData((prev) => {
      const newFiltered = templates.filter((t) => t.trade === trade && t.job_type === prev.job_type);
      const defaultTemplate = newFiltered.find((t) => t.is_default);
      return {
        ...prev,
        trade,
        template_id: defaultTemplate?.id || newFiltered[0]?.id || '',
      };
    });
  }

  function handleJobTypeChange(jobType: JobType) {
    setFormData((prev) => {
      const newFiltered = templates.filter((t) => t.trade === prev.trade && t.job_type === jobType);
      const defaultTemplate = newFiltered.find((t) => t.is_default);
      return {
        ...prev,
        job_type: jobType,
        template_id: defaultTemplate?.id || newFiltered[0]?.id || '',
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch('/api/trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          created_by: userId,
          notification_phone: formData.notify_sms ? formData.customer_phone : null,
          notification_email: formData.notify_email ? formData.customer_email : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tracker');
      }

      router.push(`/trackers/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tracker');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Customer Info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Customer Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Customer Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.customer_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, customer_name: e.target.value }))}
              className="input"
              placeholder="John Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_email: e.target.value }))}
                className="input"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customer_phone: e.target.value }))}
                className="input"
                placeholder="(512) 555-1234"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Service Address</label>
            <input
              type="text"
              value={formData.job_address}
              onChange={(e) => setFormData((prev) => ({ ...prev, job_address: e.target.value }))}
              className="input"
              placeholder="123 Main St, Austin, TX 78701"
            />
          </div>
        </div>
      </div>

      {/* Job Info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Job Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Number</label>
            <input
              type="text"
              value={formData.job_number}
              onChange={(e) => setFormData((prev) => ({ ...prev, job_number: e.target.value }))}
              className="input"
              placeholder="ST Job Number (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Trade</label>
              <select
                value={formData.trade}
                onChange={(e) => handleTradeChange(e.target.value as Trade)}
                className="select"
              >
                <option value="hvac">HVAC</option>
                <option value="plumbing">Plumbing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Job Type</label>
              <select
                value={formData.job_type}
                onChange={(e) => handleJobTypeChange(e.target.value as JobType)}
                className="select"
              >
                <option value="install">Install</option>
                <option value="repair">Repair</option>
                <option value="maintenance">Maintenance</option>
                <option value="service">Service</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Template</label>
            <select
              value={formData.template_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, template_id: e.target.value }))}
              className="select"
            >
              <option value="">No template (custom milestones)</option>
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.is_default && '(Default)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Job Description</label>
            <textarea
              value={formData.job_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, job_description: e.target.value }))}
              className="input min-h-[80px]"
              placeholder="Brief description of the work to be done..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Scheduled Date</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Est. Completion</label>
              <input
                type="date"
                value={formData.estimated_completion}
                onChange={(e) => setFormData((prev) => ({ ...prev, estimated_completion: e.target.value }))}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Notifications</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notify_email}
              onChange={(e) => setFormData((prev) => ({ ...prev, notify_email: e.target.checked }))}
              className="w-4 h-4 rounded border-border-default bg-bg-card text-christmas-green focus:ring-christmas-green"
            />
            <span className="text-text-secondary">Send email notifications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notify_sms}
              onChange={(e) => setFormData((prev) => ({ ...prev, notify_sms: e.target.checked }))}
              className="w-4 h-4 rounded border-border-default bg-bg-card text-christmas-green focus:ring-christmas-green"
            />
            <span className="text-text-secondary">Send SMS notifications</span>
          </label>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Creating...' : 'Create Tracker'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
