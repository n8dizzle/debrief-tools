'use client';

import { useState } from 'react';

interface TaskCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    outcome: string;
    outcome_notes: string;
    followup_required: boolean;
    followup_date: string | null;
  }) => Promise<void>;
}

const OUTCOMES = [
  { value: 'reached', label: 'Reached Customer' },
  { value: 'voicemail', label: 'Left Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'payment_promised', label: 'Payment Promised' },
  { value: 'disputed', label: 'Customer Disputed' },
  { value: 'other', label: 'Other' },
];

export default function TaskCompleteModal({
  isOpen,
  onClose,
  onComplete,
}: TaskCompleteModalProps) {
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [followupRequired, setFollowupRequired] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!outcome) {
      setError('Please select an outcome');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onComplete({
        outcome,
        outcome_notes: outcomeNotes,
        followup_required: followupRequired,
        followup_date: followupDate || null,
      });
      // Reset form
      setOutcome('');
      setOutcomeNotes('');
      setFollowupRequired(false);
      setFollowupDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOutcome('');
    setOutcomeNotes('');
    setFollowupRequired(false);
    setFollowupDate('');
    setError(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg shadow-xl"
          style={{ backgroundColor: 'var(--bg-card)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Complete Task
            </h2>
            <button
              onClick={handleClose}
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

            {/* Outcome */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Outcome *
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <option value="">Select outcome...</option>
                {OUTCOMES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Notes
              </label>
              <textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Add any relevant notes..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg resize-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--christmas-cream)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={followupRequired}
                  onChange={(e) => setFollowupRequired(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Follow-up required
                </span>
              </label>

              {followupRequired && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--christmas-cream)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={handleClose}
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
                {loading ? 'Completing...' : 'Complete Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
