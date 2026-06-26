'use client';

import { useState } from 'react';

export interface Assignment {
  id: string;
  type: 'technician' | 'subcontractor';
  technician_id: string | null;
  contractor_id: string | null;
  name: string | null;
  pay_amount?: number | null;
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

function initials(name: string | null): string {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();
}

export default function CrewDrawer({
  job, technicians, contractors, canEdit, onClose, onChanged,
}: {
  job: InstallJobRow | null;
  technicians: Opt[];
  contractors: Opt[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [techSel, setTechSel] = useState('');
  const [subSel, setSubSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!job) return null;

  const assignedTechIds = new Set(job.assignments.filter(a => a.type === 'technician').map(a => a.technician_id));
  const assignedSubIds = new Set(job.assignments.filter(a => a.type === 'subcontractor').map(a => a.contractor_id));
  const availTechs = technicians.filter(t => !assignedTechIds.has(t.id));
  const availSubs = contractors.filter(c => !assignedSubIds.has(c.id));

  const add = async (assignee_type: 'technician' | 'subcontractor', personId: string) => {
    if (!personId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/install-jobs/${job.id}/assignments`, {
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
      const res = await fetch(`/api/install-jobs/${job.id}/assignments/${assignmentId}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to remove'); }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally { setBusy(false); }
  };

  const selectStyle = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-screen w-full max-w-md z-50 flex flex-col overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-subtle)' }}>
        <div className="p-4 border-b flex items-start justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{job.customer_name || 'Customer'}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Job #{job.job_number} · {job.business_unit || job.trade} · {job.job_type || '—'}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Crew — {job.assignments.length} assigned
          </div>

          {job.assignments.length === 0 ? (
            <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No one assigned yet.</div>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {job.assignments.map(a => {
                const isTech = a.type === 'technician';
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <span className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: isTech ? 'rgba(58,143,87,.25)' : 'rgba(163,113,247,.22)', color: isTech ? '#6fd394' : '#a371f7' }}>
                        {initials(a.name)}
                      </span>
                      {a.name || '—'}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {isTech ? 'Technician' : 'Subcontractor'}
                      </span>
                    </span>
                    {canEdit && (
                      <button onClick={() => remove(a.id)} disabled={busy} className="p-0.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
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
          <div className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
            Green = technician, purple = subcontractor. Pay comes in the next update.
          </div>
        </div>
      </aside>
    </>
  );
}
