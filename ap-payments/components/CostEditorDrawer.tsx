'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/ap-utils';
import type { MarginRow } from './MarginGrid';

const BUCKETS: { key: string; label: string }[] = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'material', label: 'Material' },
  { key: 'labor', label: 'Labor' },
  { key: 'soft_cost', label: 'Soft cost' },
  { key: 'overhead', label: 'Overhead' },
];

const bucketLabel = (k: string) => BUCKETS.find((b) => b.key === k)?.label || k;

interface Props {
  row: MarginRow | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function CostEditorDrawer({ row, canEdit, onClose, onChanged }: Props) {
  const [bucket, setBucket] = useState('soft_cost');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!row) return null;

  const reset = () => {
    setBucket('soft_cost');
    setAmount('');
    setLabel('');
    setNote('');
    setError(null);
  };

  const add = async () => {
    const amt = Number(amount);
    if (!isFinite(amt) || amt === 0) {
      setError('Enter a non-zero amount (negative to subtract a cost).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/margin/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: row.id, bucket, amount: amt, label: label.trim() || null, note: note.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to add adjustment');
      }
      reset();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add adjustment');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/margin/adjustments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to remove adjustment');
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove adjustment');
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ label: l, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) => (
    <div className="flex items-center justify-between py-1.5">
      <span style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 600 : 400 }} className="text-sm">
        {l}
        {sub && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </span>
      <span className="text-sm tabular-nums" style={{ color: strong ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: strong ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );

  const pct = (f: number | null) => (f == null ? '—' : `${(f * 100).toFixed(1)}%`);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 h-screen w-full max-w-md z-50 flex flex-col overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-subtle)' }}
      >
        <div className="p-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{row.customer_name || 'Customer'}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Job #{row.job_number} · {row.job_type || '—'} · {row.assignment_type}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {row.cost_status === 'pending' ? (
          <div className="p-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            ServiceTitan cost data hasn&apos;t synced for this job yet. Margin will appear after the next cost sync.
          </div>
        ) : (
          <div className="p-4">
            {/* Cost breakdown */}
            <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <Row label="Revenue" value={formatCurrency(row.revenue)} strong />
              <div className="h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <Row label="Equipment" value={formatCurrency(row.equipmentCost)} />
              <Row label="Material" value={formatCurrency(row.materialCost)} />
              <Row
                label="Labor"
                sub={row.contractorLabor > 0 ? `incl. ${formatCurrency(row.contractorLabor)} contractor` : undefined}
                value={formatCurrency(row.laborCost)}
              />
              {row.stOtherCost !== 0 && <Row label="Other ST cost" sub="PO / returns" value={formatCurrency(row.stOtherCost)} />}
              {row.softCost !== 0 && <Row label="Soft cost" value={formatCurrency(row.softCost)} />}
              {row.overheadCost !== 0 && <Row label="Overhead" value={formatCurrency(row.overheadCost)} />}
              <div className="h-px my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
              <Row label="Adjusted total cost" value={formatCurrency(row.adjustedTotalCost)} strong />
              <Row label="Adjusted gross margin" value={`${formatCurrency(row.adjustedGrossMargin)} (${pct(row.adjustedGrossMarginPct)})`} strong />
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                ServiceTitan reported {pct(row.stGrossMarginPct)} ({formatCurrency(row.stGrossMargin)})
              </div>
            </div>

            {/* Existing adjustments */}
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Manual adjustments</div>
            {row.adjustments.length === 0 ? (
              <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>None yet.</div>
            ) : (
              <div className="space-y-1 mb-3">
                {row.adjustments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {bucketLabel(a.bucket)}{a.label ? ` · ${a.label}` : ''}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums" style={{ color: Number(a.amount) < 0 ? '#4ade80' : 'var(--text-primary)' }}>
                        {Number(a.amount) < 0 ? '−' : '+'}{formatCurrency(Math.abs(Number(a.amount)))}
                      </span>
                      {canEdit && (
                        <button onClick={() => remove(a.id)} disabled={saving} className="p-0.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Remove">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add adjustment */}
            {canEdit && (
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Add cost adjustment</div>
                <div className="flex gap-2 mb-2">
                  <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="flex-1 rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
                  </select>
                  <input
                    type="number" inputMode="decimal" placeholder="Amount" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-28 rounded px-2 py-1.5 text-sm tabular-nums" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
                <input
                  type="text" placeholder="Label (e.g. permit, crane rental)" value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full rounded px-2 py-1.5 text-sm mb-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
                <input
                  type="text" placeholder="Note (optional)" value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded px-2 py-1.5 text-sm mb-2" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Positive adds cost. Negative subtracts (e.g. correct an over-counted ST cost down).
                </div>
                {error && <div className="text-xs mb-2" style={{ color: '#f85149' }}>{error}</div>}
                <button
                  onClick={add} disabled={saving}
                  className="w-full rounded px-3 py-2 text-sm font-medium"
                  style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Add adjustment'}
                </button>
              </div>
            )}
            {!canEdit && error && <div className="text-xs mt-2" style={{ color: '#f85149' }}>{error}</div>}
          </div>
        )}
      </aside>
    </>
  );
}
