'use client';

import { useState } from 'react';
import { ARNoteType, ARContactResult } from '@/lib/supabase';
import TaskForm, { TaskFormData } from './TaskForm';

interface QuickLogButtonsProps {
  invoiceId: string;
  onLogSaved?: () => void;
  compact?: boolean;
}

interface LogModalState {
  isOpen: boolean;
  noteType: ARNoteType;
}

const CONTACT_RESULTS: { value: ARContactResult; label: string }[] = [
  { value: 'reached', label: 'Reached' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'left_message', label: 'Left Message' },
];

export default function QuickLogButtons({ invoiceId, onLogSaved, compact = false }: QuickLogButtonsProps) {
  const [modal, setModal] = useState<LogModalState>({ isOpen: false, noteType: 'call' });
  const [contactResult, setContactResult] = useState<ARContactResult>('reached');
  const [spokeWith, setSpokeWith] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const openModal = (noteType: ARNoteType) => {
    setModal({ isOpen: true, noteType });
    setContactResult('reached');
    setSpokeWith('');
    setNote('');
    setError(null);
  };

  const closeModal = () => {
    setModal({ isOpen: false, noteType: 'call' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: note || getDefaultNote(modal.noteType, contactResult),
          note_type: modal.noteType,
          contact_result: modal.noteType === 'call' ? contactResult : undefined,
          spoke_with: spokeWith || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      closeModal();
      onLogSaved?.();
    } catch (err) {
      console.error('Failed to log activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const getDefaultNote = (type: ARNoteType, result: ARContactResult): string => {
    switch (type) {
      case 'call':
        return result === 'reached' ? 'Spoke with customer' : `Called - ${result}`;
      case 'email':
        return 'Sent email';
      case 'text':
        return 'Sent text message';
      default:
        return '';
    }
  };

  const getModalTitle = (type: ARNoteType): string => {
    switch (type) {
      case 'call': return 'Log Call';
      case 'email': return 'Log Email';
      case 'text': return 'Log Text';
      case 'note': return 'Add Note';
      default: return 'Log Activity';
    }
  };

  const handleCreateTask = async (formData: TaskFormData) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...formData,
        invoice_id: invoiceId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create task');
    }

    onLogSaved?.();
  };

  const buttonClass = compact
    ? 'p-1.5 rounded transition-colors hover:bg-white/10'
    : 'p-2 rounded-lg transition-colors hover:bg-white/10';

  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <>
      {/* Quick Log Buttons */}
      <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        <button
          type="button"
          onClick={() => openModal('call')}
          className={buttonClass}
          style={{ color: 'var(--text-secondary)' }}
          title="Log Call"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openModal('email')}
          className={buttonClass}
          style={{ color: 'var(--text-secondary)' }}
          title="Log Email"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openModal('text')}
          className={buttonClass}
          style={{ color: 'var(--text-secondary)' }}
          title="Log Text"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openModal('note')}
          className={buttonClass}
          style={{ color: 'var(--text-secondary)' }}
          title="Add Note"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowTaskModal(true)}
          className={buttonClass}
          style={{ color: 'var(--text-secondary)' }}
          title="Create Task"
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>

      {/* Modal */}
      {modal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-lg p-6"
            style={{ backgroundColor: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                {getModalTitle(modal.noteType)}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Contact Result (only for calls) */}
              {modal.noteType === 'call' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Result
                  </label>
                  <select
                    className="select w-full"
                    value={contactResult}
                    onChange={(e) => setContactResult(e.target.value as ARContactResult)}
                  >
                    {CONTACT_RESULTS.map((result) => (
                      <option key={result.value} value={result.value}>
                        {result.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Spoke With (not shown for generic notes) */}
              {modal.noteType !== 'note' && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Spoke with (optional)
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Name of person contacted"
                    value={spokeWith}
                    onChange={(e) => setSpokeWith(e.target.value)}
                  />
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {modal.noteType === 'note' ? 'Note' : 'Note (optional)'}
                </label>
                <textarea
                  className="input w-full"
                  rows={3}
                  placeholder={modal.noteType === 'note' ? 'Enter your note...' : 'Add details about this contact...'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-2 rounded text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (modal.noteType === 'note' && !note.trim())}
                className="btn btn-primary"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      <TaskForm
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSubmit={handleCreateTask}
        invoiceId={invoiceId}
      />
    </>
  );
}
