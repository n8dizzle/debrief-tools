'use client';

import { useState } from 'react';
import { APInstallJob } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';

interface ApproveModalProps {
  job: APInstallJob;
  onClose: () => void;
  onApprove: (data: { payment_notes?: string; payment_amount?: number }) => Promise<void>;
}

export default function ApproveModal({ job, onClose, onApprove }: ApproveModalProps) {
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState<string>(
    job.payment_amount != null ? String(job.payment_amount) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount);
  const amountValid = amount !== '' && !isNaN(parsedAmount);
  const amountChanged = amountValid && parsedAmount !== (job.payment_amount ?? 0);

  const notesRequired = amountChanged;
  const canSubmit = (!notesRequired || notes.trim().length > 0) && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onApprove({
        payment_notes: notes.trim() || undefined,
        payment_amount: amountChanged ? parsedAmount : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve payment');
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
            Approve Payment
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

        <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
          <div><strong>Job #{job.job_number}</strong> — {job.customer_name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {job.trade.toUpperCase()} — {job.job_type_name || 'Install'}
          </div>
          {job.payment_amount != null && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Current amount: {formatCurrency(job.payment_amount)}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Payment Amount
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              $
            </span>
            <input
              type="number"
              className="input pl-7"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Approval Notes{' '}
            {notesRequired ? (
              <span style={{ color: 'var(--status-warning)' }}>* required (amount changed)</span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(optional)</span>
            )}
          </label>
          <textarea
            className="input"
            style={{ minHeight: '80px', resize: 'vertical' }}
            placeholder={
              notesRequired
                ? 'Why is the amount being changed? (required for audit trail)'
                : 'Optional note for the audit trail'
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>

        {error && (
          <div
            className="mb-4 p-2.5 rounded-lg text-xs"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
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
            disabled={!canSubmit}
            className="btn btn-primary"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {saving ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
