'use client';

import { useState, useEffect } from 'react';

type Flow = 'manager' | 'ap';

const flowStatuses: Record<Flow, { label: string; color: string; bg: string }[]> = {
  manager: [
    { label: 'None', color: '#6B7C6E', bg: 'rgba(107,124,110,0.15)' },
    { label: 'Ready to Pay', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    { label: 'Paid', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  ],
  ap: [
    { label: 'None', color: '#6B7C6E', bg: 'rgba(107,124,110,0.15)' },
    { label: 'Pending Approval', color: '#fcd34d', bg: 'rgba(252,211,77,0.15)' },
    { label: 'Ready to Pay', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    { label: 'Paid', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  ],
};

const flowDetails: Record<Flow, {
  roleLabels: string[];
  steps: {
    from: string;
    to: string;
    fromColor: string;
    toColor: string;
    role: string;
    roleColor: string;
    title: string;
    description: string;
    tip: string;
  }[];
}> = {
  manager: {
    roleLabels: ['Install Manager', 'AP Team'],
    steps: [
      {
        from: 'None',
        to: 'Ready to Pay',
        fromColor: '#6B7C6E',
        toColor: '#60a5fa',
        role: 'Install Manager',
        roleColor: '#fb923c',
        title: 'Invoice Received & Approved',
        description:
          'Contractor texts or emails their invoice directly to the Install Manager. The Install Manager verifies the invoice matches the job scope and rate card, enters the payment amount, and marks it "Ready to Pay."',
        tip: 'Verify the payment amount matches the contractor\'s rate card before marking ready to pay.',
      },
      {
        from: 'Ready to Pay',
        to: 'Paid',
        fromColor: '#60a5fa',
        toColor: '#4ade80',
        role: 'AP Team',
        roleColor: '#60a5fa',
        title: 'Payment Issued',
        description:
          'Once payment has been issued (check, ACH, etc.), AP marks it "Paid" to close it out.',
        tip: 'Record the payment method and check/reference number in the notes.',
      },
    ],
  },
  ap: {
    roleLabels: ['AP Team', 'Install Manager', 'AP Team'],
    steps: [
      {
        from: 'None',
        to: 'Pending Approval',
        fromColor: '#6B7C6E',
        toColor: '#fcd34d',
        role: 'AP Team',
        roleColor: '#60a5fa',
        title: 'Invoice Received — Route to Install Manager',
        description:
          'Contractor emails their invoice to ap@christmasair.com. AP matches it to the correct job, enters the payment amount, and marks it "Pending Approval" to route to the Install Manager for review.',
        tip: 'Let the Install Manager know there\'s an invoice waiting for their review.',
      },
      {
        from: 'Pending Approval',
        to: 'Ready to Pay',
        fromColor: '#fcd34d',
        toColor: '#60a5fa',
        role: 'Install Manager',
        roleColor: '#fb923c',
        title: 'Install Manager Approves',
        description:
          'The Install Manager reviews the invoice, verifies it matches the job scope and rate card, then approves it to "Ready to Pay."',
        tip: 'Check that the payment amount matches the contractor\'s rate card for this job type.',
      },
      {
        from: 'Ready to Pay',
        to: 'Paid',
        fromColor: '#60a5fa',
        toColor: '#4ade80',
        role: 'AP Team',
        roleColor: '#60a5fa',
        title: 'Payment Issued',
        description:
          'Once payment has been issued (check, ACH, etc.), AP marks it "Paid" to close it out.',
        tip: 'Record the payment method and check/reference number in the notes.',
      },
    ],
  },
};

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

function Arrow() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkflowModal({ isOpen, onClose }: WorkflowModalProps) {
  const [activeFlow, setActiveFlow] = useState<Flow>('manager');
  const flow = flowDetails[activeFlow];
  const statuses = flowStatuses[activeFlow];

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl p-6"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>
              Payment Workflow
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              How contractor payments move from invoice to paid
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Flow Selector */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setActiveFlow('manager')}
            className="text-left rounded-lg p-3 transition-all"
            style={{
              backgroundColor: activeFlow === 'manager' ? 'rgba(251,146,60,0.1)' : 'var(--bg-secondary)',
              border: activeFlow === 'manager' ? '2px solid #fb923c' : '2px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <svg className="w-4 h-4" style={{ color: activeFlow === 'manager' ? '#fb923c' : 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-semibold text-xs" style={{ color: activeFlow === 'manager' ? '#fb923c' : 'var(--christmas-cream)' }}>
                Via Install Manager
              </span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Contractor texts/emails manager directly
            </p>
          </button>
          <button
            onClick={() => setActiveFlow('ap')}
            className="text-left rounded-lg p-3 transition-all"
            style={{
              backgroundColor: activeFlow === 'ap' ? 'rgba(96,165,250,0.1)' : 'var(--bg-secondary)',
              border: activeFlow === 'ap' ? '2px solid #60a5fa' : '2px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <svg className="w-4 h-4" style={{ color: activeFlow === 'ap' ? '#60a5fa' : 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-semibold text-xs" style={{ color: activeFlow === 'ap' ? '#60a5fa' : 'var(--christmas-cream)' }}>
                Via ap@christmasair.com
              </span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Contractor emails the AP team
            </p>
          </button>
        </div>

        {/* Status Flow Diagram */}
        <div
          className="rounded-lg p-4 mb-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between gap-1.5">
            {statuses.map((status, i) => (
              <div key={status.label} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                  <div
                    className="w-full py-2 px-2 rounded-lg text-center text-xs font-semibold"
                    style={{ backgroundColor: status.bg, color: status.color, border: `2px solid ${status.color}40` }}
                  >
                    {status.label}
                  </div>
                  {i > 0 && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {flow.roleLabels[i - 1]}
                    </span>
                  )}
                </div>
                {i < statuses.length - 1 && <Arrow />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Cards */}
        <div className="space-y-3">
          {flow.steps.map((step, i) => (
            <div
              key={`${activeFlow}-${i}`}
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: `${step.toColor}20`, color: step.toColor }}
                >
                  {i + 1}
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge label={step.from} color={step.fromColor} />
                  <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <StatusBadge label={step.to} color={step.toColor} />
                </div>
                <span
                  className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: `${step.roleColor}15`, color: step.roleColor, border: `1px solid ${step.roleColor}30` }}
                >
                  {step.role}
                </span>
              </div>

              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
                {step.title}
              </h3>
              <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                {step.description}
              </p>
              <div
                className="flex items-start gap-1.5 text-[11px] rounded-md px-2.5 py-1.5"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{step.tip}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
