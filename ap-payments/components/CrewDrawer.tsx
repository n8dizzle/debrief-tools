'use client';

import { useState, useEffect } from 'react';
import { computeTechPay, payBasisLabel, PayMethod, TechPayInput } from '@/lib/techpay';
import { formatCurrency } from '@/lib/ap-utils';

export interface Assignment {
  id: string;
  type: 'technician' | 'subcontractor';
  technician_id: string | null;
  contractor_id: string | null;
  name: string | null;
  pay_amount?: number | null;
  pay_type_id?: string | null;
  pay_basis?: { hours?: number | null; [k: string]: unknown } | null;
}
export interface TechPayConfig {
  pay_type_id: string;
  name: string;
  method: PayMethod;
  percent: number | null;
  flat_amount: number | null;
  default_job_types: string[];
  hourly_rate: number | null;
}
export interface SubRate {
  trade: string;
  job_type_name: string;
  rate_amount: number;
  rate_type: 'flat' | 'percent';
}
export interface InstallJobRow {
  id: string;
  st_job_id: number | null;
  job_number: string;
  customer_name: string | null;
  trade: string | null;
  job_type: string | null;
  business_unit: string | null;
  completed_date: string | null;
  invoice_amount: number | null;
  assignments: Assignment[];
}
interface Opt { id: string; name: string }
type PayState = { payTypeId: string; hours: string; amount: string };

function initials(name: string | null): string {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}
function sameCI(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}
function cfgHint(c: TechPayConfig): string {
  switch (c.method) {
    case 'percent': return c.percent != null ? `${c.percent}%` : '% — not set';
    case 'hourly': return c.hourly_rate != null ? `${formatCurrency(c.hourly_rate)}/hr` : 'hourly — no rate';
    case 'combo': return `${c.percent ?? '—'}% + ${c.hourly_rate != null ? formatCurrency(c.hourly_rate) + '/hr' : 'hourly'}`;
    case 'flat': return c.flat_amount != null ? formatCurrency(c.flat_amount) : 'flat — not set';
    default: return '';
  }
}
function needsHours(method: PayMethod | undefined): boolean {
  return method === 'hourly' || method === 'combo';
}
// Find a sub's rate: prefer an exact job-type rate, else fall back to the trade-wide
// default ('*'). Lets a sub have one "12% on all HVAC jobs" rate plus per-type overrides.
function findSubRate(rates: SubRate[], trade: string | null, jobType: string | null): SubRate | undefined {
  const tradeRates = rates.filter(r => sameCI(r.trade, trade));
  return tradeRates.find(r => r.job_type_name !== '*' && sameCI(r.job_type_name, jobType))
      || tradeRates.find(r => r.job_type_name === '*');
}
// A subcontractor rate maps onto the same compute fn as a percent/flat pay type.
function rateToInput(r: SubRate, revenue: number | null): TechPayInput {
  return r.rate_type === 'percent'
    ? { method: 'percent', percent: r.rate_amount, flat_amount: null, hourly_rate: null, hours: null, revenue }
    : { method: 'flat', percent: null, flat_amount: r.rate_amount, hourly_rate: null, hours: null, revenue };
}

export default function CrewDrawer({
  job, technicians, contractors, payConfigsByTech, subRatesByContractor, canEdit, onClose, onChanged,
}: {
  job: InstallJobRow | null;
  technicians: Opt[];
  contractors: Opt[];
  payConfigsByTech: Record<string, TechPayConfig[]>;
  subRatesByContractor: Record<string, SubRate[]>;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [techSel, setTechSel] = useState('');
  const [subSel, setSubSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<Record<string, PayState>>({});

  // Initialize / merge pay state when the job (or its assignments) changes.
  // Merge by assignment id so add/remove + reload never wipes in-progress edits.
  useEffect(() => {
    if (!job) { setPay({}); return; }
    setPay(prev => {
      const next: Record<string, PayState> = {};
      for (const a of job.assignments) {
        if (prev[a.id]) { next[a.id] = prev[a.id]; continue; }
        if (a.type === 'technician') {
          const configs = payConfigsByTech[a.technician_id || ''] || [];
          if (a.pay_type_id) {
            next[a.id] = {
              payTypeId: a.pay_type_id,
              hours: a.pay_basis?.hours != null ? String(a.pay_basis.hours) : '',
              amount: a.pay_amount != null ? String(a.pay_amount) : '',
            };
          } else {
            const def = configs.find(c => job.job_type && c.default_job_types.includes(job.job_type));
            const chosen = def || (configs.length === 1 ? configs[0] : null);
            if (!chosen) { next[a.id] = { payTypeId: '', hours: '', amount: '' }; continue; }
            const res = computeTechPay({
              method: chosen.method, percent: chosen.percent, flat_amount: chosen.flat_amount,
              hourly_rate: chosen.hourly_rate, hours: null, revenue: job.invoice_amount,
            });
            next[a.id] = { payTypeId: chosen.pay_type_id, hours: '', amount: res.amount != null ? String(res.amount) : '' };
          }
        } else {
          // Subcontractor — match rate card by trade + job type.
          if (a.pay_amount != null) {
            next[a.id] = { payTypeId: '', hours: '', amount: String(a.pay_amount) };
          } else {
            const rates = subRatesByContractor[a.contractor_id || ''] || [];
            const r = findSubRate(rates, job.trade, job.job_type);
            const res = r ? computeTechPay(rateToInput(r, job.invoice_amount)) : { amount: null };
            next[a.id] = { payTypeId: '', hours: '', amount: res.amount != null ? String(res.amount) : '' };
          }
        }
      }
      return next;
    });
  }, [job, payConfigsByTech, subRatesByContractor]);

  if (!job) return null;
  const theJob = job;

  const assignedTechIds = new Set(theJob.assignments.filter(a => a.type === 'technician').map(a => a.technician_id));
  const assignedSubIds = new Set(theJob.assignments.filter(a => a.type === 'subcontractor').map(a => a.contractor_id));
  const availTechs = technicians.filter(t => !assignedTechIds.has(t.id));
  const availSubs = contractors.filter(c => !assignedSubIds.has(c.id));

  const calc = (cfg: TechPayConfig | undefined, hoursStr: string): string => {
    if (!cfg) return '';
    const h = parseFloat(hoursStr);
    const res = computeTechPay({
      method: cfg.method, percent: cfg.percent, flat_amount: cfg.flat_amount,
      hourly_rate: cfg.hourly_rate, hours: isNaN(h) ? null : h, revenue: theJob.invoice_amount,
    });
    return res.amount != null ? String(res.amount) : '';
  };
  const configsFor = (a: Assignment) => payConfigsByTech[a.technician_id || ''] || [];
  const matchSubRate = (a: Assignment): SubRate | undefined =>
    findSubRate(subRatesByContractor[a.contractor_id || ''] || [], theJob.trade, theJob.job_type);
  const subCalc = (r: SubRate | undefined): string => {
    if (!r) return '';
    const res = computeTechPay(rateToInput(r, theJob.invoice_amount));
    return res.amount != null ? String(res.amount) : '';
  };

  const onPickType = (a: Assignment, payTypeId: string) => {
    const cfg = configsFor(a).find(c => c.pay_type_id === payTypeId);
    setPay(p => ({ ...p, [a.id]: { ...p[a.id], payTypeId, amount: calc(cfg, p[a.id]?.hours || '') } }));
  };
  const onHours = (a: Assignment, hours: string) => {
    const cfg = configsFor(a).find(c => c.pay_type_id === pay[a.id]?.payTypeId);
    setPay(p => ({ ...p, [a.id]: { ...p[a.id], hours, amount: calc(cfg, hours) } }));
  };
  const onAmount = (a: Assignment, amount: string) =>
    setPay(p => ({ ...p, [a.id]: { ...p[a.id], amount } }));
  const setAmount = (a: Assignment, amount: string) =>
    setPay(p => ({ ...p, [a.id]: { ...p[a.id], amount } }));

  const add = async (assignee_type: 'technician' | 'subcontractor', personId: string) => {
    if (!personId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/install-jobs/${theJob.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          assignee_type === 'technician'
            ? { assignee_type, technician_id: personId }
            : { assignee_type, contractor_id: personId }
        ),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to add'); }
      setTechSel(''); setSubSel('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally { setBusy(false); }
  };

  const remove = async (assignmentId: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/install-jobs/${theJob.id}/assignments/${assignmentId}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to remove'); }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally { setBusy(false); }
  };

  const techRows = theJob.assignments.filter(a => a.type === 'technician');
  const subRows = theJob.assignments.filter(a => a.type === 'subcontractor');

  const rowDirty = (a: Assignment): boolean => {
    const st = pay[a.id]; if (!st) return false;
    const typeChanged = a.type === 'technician' && (a.pay_type_id ?? '') !== (st.payTypeId ?? '');
    const amountChanged = String(a.pay_amount ?? '') !== (st.amount ?? '');
    return typeChanged || amountChanged;
  };
  const dirty = theJob.assignments.some(rowDirty);
  const crewTotal = theJob.assignments.reduce((s, a) => {
    const n = parseFloat(pay[a.id]?.amount || '');
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  const savePay = async () => {
    setBusy(true); setError(null);
    try {
      for (const a of theJob.assignments) {
        const st = pay[a.id]; if (!st || !rowDirty(a)) continue;
        let payTypeId: string | null = null;
        let basis: Record<string, unknown> | null = null;
        if (a.type === 'technician') {
          const cfg = configsFor(a).find(c => c.pay_type_id === st.payTypeId);
          const h = parseFloat(st.hours);
          payTypeId = st.payTypeId || null;
          basis = cfg ? {
            method: cfg.method, percent: cfg.percent, flat_amount: cfg.flat_amount,
            hourly_rate: cfg.hourly_rate, hours: isNaN(h) ? null : h,
            revenue: theJob.invoice_amount, computed_at: new Date().toISOString(),
          } : null;
        } else {
          const r = matchSubRate(a);
          basis = r ? {
            source: 'rate_card', rate_type: r.rate_type, rate_amount: r.rate_amount,
            job_type_name: r.job_type_name, trade: r.trade,
            revenue: theJob.invoice_amount, computed_at: new Date().toISOString(),
          } : { source: 'manual', revenue: theJob.invoice_amount, computed_at: new Date().toISOString() };
        }
        const res = await fetch(`/api/install-jobs/${theJob.id}/assignments/${a.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pay_type_id: payTypeId, pay_amount: st.amount === '' ? null : Number(st.amount), pay_basis: basis }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to save pay'); }
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save pay');
    } finally { setBusy(false); }
  };

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };
  const inputStyle = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };

  const removeBtn = (a: Assignment) => canEdit && (
    <button onClick={() => remove(a.id)} disabled={busy} className="p-0.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Remove">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );
  const staleBanner = (a: Assignment, saved: number | null | undefined, recalcAmt: string) => (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5" style={{ backgroundColor: 'rgba(210,153,34,0.12)' }}>
      <span className="text-[11px]" style={{ color: '#d29922' }}>
        Rates changed: {formatCurrency(saved)} → <span className="font-semibold">{formatCurrency(Number(recalcAmt))}</span>
      </span>
      <button onClick={() => setAmount(a, recalcAmt)} disabled={busy}
        className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(210,153,34,0.22)', color: '#d29922' }}>
        Recalculate
      </button>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-md z-50 flex flex-col overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-subtle)' }}>
        <div className="p-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{theJob.customer_name || 'Customer'}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Job #{theJob.job_number} · {theJob.job_type || '—'} · Invoice {theJob.invoice_amount != null ? formatCurrency(theJob.invoice_amount) : '—'}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Crew — {theJob.assignments.length} assigned
          </div>

          {theJob.assignments.length === 0 && (
            <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No one assigned yet.</div>
          )}

          {/* Technicians */}
          {techRows.length > 0 && (
            <div className="flex flex-col gap-2.5 mb-4">
              {techRows.map(a => {
                const st = pay[a.id] || { payTypeId: '', hours: '', amount: '' };
                const configs = configsFor(a);
                const cfg = configs.find(c => c.pay_type_id === st.payTypeId);
                const frozen = a.pay_type_id != null && a.pay_amount != null;
                const recalcAmt = frozen && cfg ? calc(cfg, st.hours) : '';
                const stale = frozen && recalcAmt !== '' && recalcAmt !== String(a.pay_amount);
                return (
                  <div key={a.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: 'rgba(58,143,87,.25)', color: '#6fd394' }}>{initials(a.name)}</span>
                        {a.name || '—'}
                        {frozen && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(58,143,87,.16)', color: '#6fd394' }}>saved</span>}
                      </span>
                      {removeBtn(a)}
                    </div>

                    {configs.length === 0 ? (
                      <div className="text-[11px] mt-2" style={{ color: '#d29922' }}>
                        No pay types set for this tech. Add one in Settings → Technician Pay.
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex gap-2">
                          <select value={st.payTypeId} disabled={!canEdit || busy}
                            onChange={e => onPickType(a, e.target.value)}
                            className="flex-1 rounded-lg px-2 py-1.5 text-sm" style={selectStyle}>
                            <option value="">Pick pay type…</option>
                            {configs.map(c => <option key={c.pay_type_id} value={c.pay_type_id}>{c.name} · {cfgHint(c)}</option>)}
                          </select>
                          {needsHours(cfg?.method) && (
                            <input type="number" inputMode="decimal" placeholder="hrs" value={st.hours}
                              disabled={!canEdit || busy} onChange={e => onHours(a, e.target.value)}
                              className="w-16 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums" style={inputStyle} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pay $</span>
                          <input type="number" inputMode="decimal" placeholder="0.00" value={st.amount}
                            disabled={!canEdit || busy} onChange={e => onAmount(a, e.target.value)}
                            className="w-28 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums font-semibold" style={inputStyle} />
                          {cfg && st.payTypeId && (
                            <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {payBasisLabel({ method: cfg.method, percent: cfg.percent, flat_amount: cfg.flat_amount, hourly_rate: cfg.hourly_rate, hours: parseFloat(st.hours) || null, revenue: theJob.invoice_amount })}
                            </span>
                          )}
                        </div>
                        {stale && canEdit && staleBanner(a, a.pay_amount, recalcAmt)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Subcontractors */}
          {subRows.length > 0 && (
            <div className="flex flex-col gap-2.5 mb-4">
              {subRows.map(a => {
                const st = pay[a.id] || { payTypeId: '', hours: '', amount: '' };
                const rate = matchSubRate(a);
                const frozen = a.pay_amount != null;
                const recalcAmt = frozen && rate ? subCalc(rate) : '';
                const stale = frozen && recalcAmt !== '' && recalcAmt !== String(a.pay_amount);
                return (
                  <div key={a.id} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: 'rgba(163,113,247,.22)', color: '#a371f7' }}>{initials(a.name)}</span>
                        {a.name || '—'}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Subcontractor</span>
                        {frozen && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(163,113,247,.16)', color: '#a371f7' }}>saved</span>}
                      </span>
                      {removeBtn(a)}
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Pay $</span>
                        <input type="number" inputMode="decimal" placeholder="0.00" value={st.amount}
                          disabled={!canEdit || busy} onChange={e => onAmount(a, e.target.value)}
                          className="w-28 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums font-semibold" style={inputStyle} />
                        {rate ? (
                          <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                            {rate.rate_type === 'percent'
                              ? `${rate.rate_amount}% of ${formatCurrency(theJob.invoice_amount)}`
                              : `Flat ${formatCurrency(rate.rate_amount)}`} · {rate.job_type_name === '*' ? 'all jobs' : rate.job_type_name}
                          </span>
                        ) : (
                          <span className="text-[11px] truncate" style={{ color: '#d29922' }}>
                            No rate-card match — enter manually
                          </span>
                        )}
                      </div>
                      {stale && canEdit && staleBanner(a, a.pay_amount, recalcAmt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2 mt-2" style={{ color: 'var(--text-muted)' }}>Add to crew</div>
              <div className="flex gap-2 mb-2">
                <select value={techSel} onChange={e => { setTechSel(e.target.value); add('technician', e.target.value); }}
                  disabled={busy} className="flex-1 rounded-lg px-2 py-2 text-sm" style={selectStyle}>
                  <option value="">Add technician…</option>
                  {availTechs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mb-2">
                <select value={subSel} onChange={e => { setSubSel(e.target.value); add('subcontractor', e.target.value); }}
                  disabled={busy} className="flex-1 rounded-lg px-2 py-2 text-sm" style={selectStyle}>
                  <option value="">Add subcontractor…</option>
                  {availSubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </>
          )}
          {error && <div className="text-xs mt-2" style={{ color: '#f85149' }}>{error}</div>}
        </div>

        {/* Footer — crew total + Save */}
        {theJob.assignments.length > 0 && (
          <div className="p-4 border-t sticky bottom-0" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Crew pay total</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(crewTotal)}</span>
            </div>
            {canEdit && (
              <button onClick={savePay} disabled={busy || !dirty}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>
                {busy ? 'Saving…' : dirty ? 'Save pay' : 'Pay saved'}
              </button>
            )}
            <div className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
              Pay freezes when saved. Editing a rate later won&apos;t change saved jobs.
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
