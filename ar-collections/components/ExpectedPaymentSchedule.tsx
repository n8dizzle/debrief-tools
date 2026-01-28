'use client';

import { useState } from 'react';
import { FinancingExpectedPayment, FinancingPaymentStatus } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/ar-utils';

interface Props {
  invoiceId: string;
  payments: FinancingExpectedPayment[];
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<FinancingPaymentStatus, { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: 'var(--christmas-green)', bg: 'rgba(34, 197, 94, 0.15)' },
  late: { label: 'Late', color: 'var(--status-warning)', bg: 'rgba(234, 179, 8, 0.15)' },
  missed: { label: 'Missed', color: 'var(--status-error)', bg: 'rgba(239, 68, 68, 0.15)' },
  partial: { label: 'Partial', color: 'var(--status-warning)', bg: 'rgba(234, 179, 8, 0.15)' },
  pending: { label: 'Pending', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' },
};

export default function ExpectedPaymentSchedule({ invoiceId, payments, onUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  async function generateSchedule() {
    setGenerating(true);
    try {
      const response = await fetch(`/api/financing/${invoiceId}/schedule`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        onUpdate();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to generate schedule');
      }
    } catch (err) {
      alert('Failed to generate schedule');
    } finally {
      setGenerating(false);
    }
  }

  async function updatePaymentStatus(paymentId: string, status: FinancingPaymentStatus) {
    setUpdating(paymentId);
    try {
      const response = await fetch(`/api/financing/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(null);
    }
  }

  async function saveNotes(paymentId: string) {
    setUpdating(paymentId);
    try {
      const response = await fetch(`/api/financing/payments/${paymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes: notesValue }),
      });
      if (response.ok) {
        onUpdate();
        setEditingNotes(null);
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setUpdating(null);
    }
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          No payment schedule generated yet.
        </p>
        <button
          className="btn btn-primary"
          onClick={generateSchedule}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Payment Schedule'}
        </button>
      </div>
    );
  }

  const summary = {
    paid: payments.filter((p) => p.status === 'paid').length,
    late: payments.filter((p) => p.status === 'late').length,
    missed: payments.filter((p) => p.status === 'missed').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    partial: payments.filter((p) => p.status === 'partial').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span style={{ color: STATUS_CONFIG.paid.color }}>
            {summary.paid} Paid
          </span>
          {summary.late > 0 && (
            <span style={{ color: STATUS_CONFIG.late.color }}>
              {summary.late} Late
            </span>
          )}
          {summary.missed > 0 && (
            <span style={{ color: STATUS_CONFIG.missed.color }}>
              {summary.missed} Missed
            </span>
          )}
          <span style={{ color: STATUS_CONFIG.pending.color }}>
            {summary.pending} Pending
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={generateSchedule}
          disabled={generating}
          title="Regenerate schedule from ServiceTitan payments"
        >
          {generating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {/* Payment Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th className="text-left py-2 px-2">Due Date</th>
              <th className="text-right py-2 px-2">Amount</th>
              <th className="text-center py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Paid Date</th>
              <th className="text-right py-2 px-2">Paid Amount</th>
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-left py-2 px-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const config = STATUS_CONFIG[payment.status];
              const isUpdating = updating === payment.id;
              const isEditingNotes = editingNotes === payment.id;

              return (
                <tr
                  key={payment.id}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(payment.due_date)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <select
                      value={payment.status}
                      onChange={(e) => updatePaymentStatus(payment.id, e.target.value as FinancingPaymentStatus)}
                      disabled={isUpdating}
                      className="text-xs px-2 py-1 rounded border-0 cursor-pointer"
                      style={{
                        backgroundColor: config.bg,
                        color: config.color,
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="late">Late</option>
                      <option value="missed">Missed</option>
                      <option value="partial">Partial</option>
                    </select>
                  </td>
                  <td className="py-2 px-2" style={{ color: 'var(--text-muted)' }}>
                    {payment.payment_date ? formatDate(payment.payment_date) : '-'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {payment.amount_paid ? formatCurrency(payment.amount_paid) : '-'}
                  </td>
                  <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {payment.payment_type || '-'}
                  </td>
                  <td className="py-2 px-2">
                    {isEditingNotes ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          className="input text-xs py-1 px-2 w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveNotes(payment.id);
                            if (e.key === 'Escape') setEditingNotes(null);
                          }}
                        />
                        <button
                          className="text-xs px-1"
                          onClick={() => saveNotes(payment.id)}
                          style={{ color: 'var(--christmas-green)' }}
                        >
                          Save
                        </button>
                        <button
                          className="text-xs px-1"
                          onClick={() => setEditingNotes(null)}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:underline text-xs"
                        style={{ color: payment.notes ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                        onClick={() => {
                          setEditingNotes(payment.id);
                          setNotesValue(payment.notes || '');
                        }}
                        title="Click to edit notes"
                      >
                        {payment.notes || 'Add note...'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
