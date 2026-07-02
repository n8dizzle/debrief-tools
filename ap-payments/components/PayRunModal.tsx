'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '@/lib/ap-utils';

interface EligibleJob { id: string; job_number: string; customer_name: string | null; completed_date: string | null; payment_amount: number; }
interface EligibleContractor { contractor_id: string; contractor_name: string; jobs: EligibleJob[]; total: number; }

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PayRunModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [contractors, setContractors] = useState<EligibleContractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractorId, setContractorId] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amountOverride, setAmountOverride] = useState<string>('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState('');
  const [paidOn, setPaidOn] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pay-runs/eligible');
        const data = res.ok ? await res.json() : { contractors: [] };
        setContractors(data.contractors || []);
        if ((data.contractors || []).length === 1) setContractorId(data.contractors[0].contractor_id);
      } catch { setContractors([]); }
      finally { setLoading(false); }
    })();
  }, []);

  const current = useMemo(() => contractors.find(c => c.contractor_id === contractorId) || null, [contractors, contractorId]);

  // Default every job checked when a contractor is picked.
  useEffect(() => {
    if (current) setChecked(Object.fromEntries(current.jobs.map(j => [j.id, true])));
    setAmountOverride('');
  }, [contractorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedJobs = current ? current.jobs.filter(j => checked[j.id]) : [];
  const summed = selectedJobs.reduce((s, j) => s + (j.payment_amount || 0), 0);
  const total = amountOverride !== '' ? Number(amountOverride) : summed;
  const variance = Math.round((total - summed) * 100) / 100;

  const submit = async () => {
    setError(null);
    if (!contractorId) return setError('Pick a contractor.');
    if (selectedJobs.length === 0) return setError('Select at least one job.');
    if (!code.trim()) return setError('Enter the confirmation code.');
    setSaving(true);
    try {
      const res = await fetch('/api/pay-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          job_ids: selectedJobs.map(j => j.id),
          confirmation_code: code.trim(),
          payment_method: method || null,
          paid_on: paidOn,
          total_amount: amountOverride !== '' ? Number(amountOverride) : undefined,
          notes: notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally { setSaving(false); }
  };

  const inputStyle = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--christmas-cream)' }}>Record Lump Payment</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : contractors.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>No approved contractor jobs are waiting to be paid.</div>
          ) : (
            <>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Contractor</label>
                <select value={contractorId} onChange={e => setContractorId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                  <option value="">Select a contractor…</option>
                  {contractors.map(c => <option key={c.contractor_id} value={c.contractor_id}>{c.contractor_name} — {c.jobs.length} job{c.jobs.length !== 1 ? 's' : ''} · {formatCurrency(c.total)}</option>)}
                </select>
              </div>

              {current && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Jobs in this payment</label>
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => setChecked(Object.fromEntries(current.jobs.map(j => [j.id, true])))} style={{ color: 'var(--christmas-green)' }}>All</button>
                        <button onClick={() => setChecked({})} style={{ color: 'var(--text-muted)' }}>None</button>
                      </div>
                    </div>
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                      {current.jobs.map(j => (
                        <label key={j.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-white/5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <input type="checkbox" checked={!!checked[j.id]} onChange={() => setChecked(s => ({ ...s, [j.id]: !s[j.id] }))} />
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{j.job_number}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{j.customer_name || '—'}</span>
                          <span className="ml-auto tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(j.payment_amount)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Lump amount</label>
                      <input inputMode="decimal" value={amountOverride} onChange={e => setAmountOverride(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={summed.toFixed(2)} className="w-full rounded-lg px-3 py-2 text-sm text-right tabular-nums" style={inputStyle} />
                      <div className="text-[11px] mt-1" style={{ color: variance !== 0 ? '#d29922' : 'var(--text-muted)' }}>
                        Sum of {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}: {formatCurrency(summed)}{variance !== 0 ? ` · ${variance > 0 ? '+' : ''}${formatCurrency(variance)} vs sum` : ''}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Paid on</label>
                      <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Confirmation code <span style={{ color: '#f85149' }}>*</span></label>
                      <input value={code} onChange={e => setCode(e.target.value)} placeholder="Check #, ACH/Zelle ref…" className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Method</label>
                      <select value={method} onChange={e => setMethod(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                        <option value="">—</option>
                        <option value="Check">Check</option>
                        <option value="ACH">ACH</option>
                        <option value="Zelle">Zelle</option>
                        <option value="Wire">Wire</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                  </div>
                </>
              )}
              {error && <div className="rounded-lg p-2.5 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{error}</div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {current ? <>Paying <b style={{ color: 'var(--text-primary)' }}>{formatCurrency(total)}</b> across {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}</> : ''}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn" style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={submit} disabled={saving || !current || selectedJobs.length === 0 || !code.trim()} className="btn btn-primary" style={{ opacity: saving || !current || selectedJobs.length === 0 || !code.trim() ? 0.5 : 1 }}>
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
