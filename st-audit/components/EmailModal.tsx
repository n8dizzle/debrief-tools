'use client';

import { useState, useRef, useEffect } from 'react';

interface OpenJob {
  id: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName: string;
  jobTypeName: string;
  createdOn: string;
  hoursOpen: number;
  severity: 'warning' | 'critical';
}

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: OpenJob[];
}

export default function EmailModal({ isOpen, onClose, jobs }: EmailModalProps) {
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSent(false);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const critical = jobs.filter(j => j.severity === 'critical').length;
  const warning = jobs.length - critical;

  const handleSend = async () => {
    const emails = recipients
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      setError('Enter at least one email address');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emails, jobs, message: message.trim() }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send email');
      }
    } catch {
      setError('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
              Email Open Jobs Report
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {jobs.length} job{jobs.length !== 1 ? 's' : ''} selected
              {critical > 0 && <span style={{ color: '#f87171' }}> ({critical} critical)</span>}
              {warning > 0 && <span style={{ color: '#fcd34d' }}> ({warning} warning)</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.15)' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="#4ade80" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium" style={{ color: 'var(--christmas-cream)' }}>Email sent</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Report sent to {recipients.split(/[,;\s]+/).filter(e => e.includes('@')).length} recipient{recipients.split(/[,;\s]+/).filter(e => e.includes('@')).length !== 1 ? 's' : ''}
              </p>
              <button onClick={onClose} className="btn btn-primary mt-6">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Recipients
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  className="select"
                  style={{ width: '100%' }}
                  placeholder="email@christmasair.com, another@christmasair.com"
                  value={recipients}
                  onChange={e => setRecipients(e.target.value)}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Separate multiple emails with commas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Message <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  className="select"
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder="These jobs need to be reviewed and closed out..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              {/* Preview */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Preview: Jobs included</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {jobs.sort((a, b) => b.hoursOpen - a.hoursOpen).map(job => (
                    <div key={job.id} className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-primary)' }}>
                        <span className="font-mono">{job.jobNumber}</span>
                        <span style={{ color: 'var(--text-muted)' }}> &middot; {job.businessUnitName}</span>
                      </span>
                      <span style={{ color: job.severity === 'critical' ? '#f87171' : '#fcd34d' }}>
                        {Math.floor(job.hoursOpen / 24)}d open
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              onClick={handleSend}
              disabled={sending || !recipients.trim()}
              className="btn btn-primary"
              style={{ opacity: sending || !recipients.trim() ? 0.5 : 1 }}
            >
              {sending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Email
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
