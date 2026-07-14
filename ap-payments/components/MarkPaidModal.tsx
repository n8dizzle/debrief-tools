'use client';

import { useState } from 'react';
import { APInstallJob } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';

interface MarkPaidModalProps {
  job: APInstallJob;
  onClose: () => void;
  onConfirm: (data: { payment_notes?: string }) => Promise<void>;
}

export default function MarkPaidModal({ job, onClose, onConfirm }: MarkPaidModalProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onConfirm({ payment_notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as paid');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={saving ? undefined : onClose} />
      <div
        className="relative w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Mark as Paid
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="mb-5 p-3 rounded-lg text-sm"
          style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
        >
          <div>
            <strong>Job #{job.job_number}</strong> — {job.customer_name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {job.trade.toUpperCase()} — {job.job_type_name || 'Install'}
          </div>
          {job.contractor?.name && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Contractor: {job.contractor.name}
            </div>
          )}
          <div className="text-base mt-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(job.payment_amount ?? 0)}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Payment Notes{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>
              (optional · check #, ACH ref, etc.)
            </span>
          </label>
          <textarea
            className="input"
            style={{ minHeight: '70px', resize: 'vertical' }}
            placeholder="e.g. Check #1234 mailed Apr 28"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && (
          <div
            className="mb-4 p-2.5 rounded-lg text-xs"
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
            style={{ backgroundColor: '#2f81f7', color: 'white' }}
          >
            {saving ? 'Marking…' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}
