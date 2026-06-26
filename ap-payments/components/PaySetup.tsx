'use client';

import { useState, useEffect, useCallback } from 'react';

interface PayType { id: string; name: string; method: 'percent' | 'hourly' | 'combo' | 'flat'; }
interface TechPay {
  id: string; pay_type_id: string;
  hourly_rate: number | null; percent: number | null; flat_amount: number | null;
  default_job_types: string[];
  pay_type: { id: string; name: string; method: PayType['method'] };
}
interface Tech { id: string; name: string; trade?: string | null; }

const methodColor: Record<string, string> = { percent: '#3a8f57', hourly: '#5aa9e6', combo: '#d29922', flat: '#a371f7' };
const methodLabel: Record<string, string> = { percent: 'Percent', hourly: 'Hourly', combo: 'Combo', flat: 'Flat' };

function rateSummary(c: TechPay): string {
  const m = c.pay_type.method;
  if (m === 'percent') return `${c.percent ?? 0}%`;
  if (m === 'hourly') return `$${c.hourly_rate ?? 0}/hr`;
  if (m === 'combo') return `$${c.hourly_rate ?? 0}/hr + ${c.percent ?? 0}%`;
  return `$${c.flat_amount ?? 0}`;
}

const card = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };
const ctl = { backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const;

/** Searchable multi-select of ST job types (for "Default for"). */
function JobTypePicker({ all, selected, onChange }: { all: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = all.filter(t => t.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="rounded-lg px-2 py-1.5 text-xs text-left" style={{ ...ctl, color: 'var(--text-secondary)', minWidth: 180 }}>
        {selected.length === 0 ? 'Default for: (none)' : `Default for: ${selected.length} job type${selected.length === 1 ? '' : 's'}`} ▾
      </button>
      {open && (
        <div className="absolute z-30 mt-1 rounded-lg p-2 w-72 max-h-72 overflow-auto" style={{ ...card, backgroundColor: 'var(--bg-secondary)' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search job types…"
            className="w-full rounded px-2 py-1.5 text-xs mb-2" style={ctl} />
          {shown.length === 0 && <div className="text-xs px-1 py-1" style={{ color: 'var(--text-muted)' }}>No matches.</div>}
          {shown.map(t => {
            const on = selected.includes(t);
            return (
              <label key={t} className="flex items-center gap-2 px-1.5 py-1 rounded text-xs cursor-pointer hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? selected.filter(x => x !== t) : [...selected, t])} />
                {t}
              </label>
            );
          })}
          <button onClick={() => setOpen(false)} className="mt-2 text-xs w-full rounded py-1.5" style={{ backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream)' }}>Done</button>
        </div>
      )}
    </div>
  );
}

export default function PaySetup({ canManage }: { canManage: boolean }) {
  const [payTypes, setPayTypes] = useState<PayType[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, TechPay[]>>({});
  const [newPtName, setNewPtName] = useState('');
  const [newPtMethod, setNewPtMethod] = useState<PayType['method']>('percent');
  const [addSel, setAddSel] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    const [pt, tk, jt] = await Promise.all([fetch('/api/pay-types'), fetch('/api/technicians'), fetch('/api/job-types')]);
    setPayTypes(pt.ok ? await pt.json() : []);
    const tks = tk.ok ? await tk.json() : [];
    setTechs((tks || []).map((t: any) => ({ id: t.id, name: t.name, trade: t.trade })));
    setJobTypes(jt.ok ? await jt.json() : []);
  }, []);
  useEffect(() => { loadBase(); }, [loadBase]);

  const loadConfigs = useCallback(async (techId: string) => {
    const res = await fetch(`/api/technicians/${techId}/pay-types`);
    if (res.ok) { const data = await res.json(); setConfigs(c => ({ ...c, [techId]: data })); }
  }, []);

  const toggleTech = (techId: string) => {
    if (expanded === techId) { setExpanded(null); return; }
    setExpanded(techId); setAddSel('');
    if (!configs[techId]) loadConfigs(techId);
  };

  const addPayType = async () => {
    if (!newPtName.trim()) return;
    const res = await fetch('/api/pay-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPtName.trim(), method: newPtMethod }) });
    if (res.ok) { const created = await res.json(); setNewPtName(''); setPayTypes(p => [...p, created]); } else setErr((await res.json()).error);
  };
  const delPayType = async (id: string) => {
    const res = await fetch(`/api/pay-types/${id}`, { method: 'DELETE' });
    if (res.ok) setPayTypes(p => p.filter(x => x.id !== id)); else setErr((await res.json()).error);
  };

  const addConfig = async (techId: string, payTypeId: string) => {
    if (!payTypeId) return;
    const res = await fetch(`/api/technicians/${techId}/pay-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pay_type_id: payTypeId, default_job_types: [] }) });
    if (res.ok) { setAddSel(''); loadConfigs(techId); } else setErr((await res.json()).error);
  };
  const patchConfig = async (techId: string, c: TechPay, patch: Partial<TechPay>) => {
    setConfigs(prev => ({ ...prev, [techId]: prev[techId].map(x => x.id === c.id ? { ...x, ...patch } : x) }));
    await fetch(`/api/technicians/${techId}/pay-types/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  };
  const delConfig = async (techId: string, id: string) => {
    await fetch(`/api/technicians/${techId}/pay-types/${id}`, { method: 'DELETE' });
    loadConfigs(techId);
  };

  return (
    <div className="space-y-5">
      {err && <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', color: '#f85149' }}>{err}</div>}

      {/* Pay Types library */}
      <div className="rounded-lg" style={card}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Pay Types</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Comp structures available to assign to technicians. Numbers are set per technician below.</div>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {payTypes.map(p => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: methodColor[p.method] }} />
              {p.name} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{methodLabel[p.method]}</span>
              {canManage && <button onClick={() => delPayType(p.id)} className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>}
            </span>
          ))}
        </div>
        {canManage && (
          <div className="px-3 pb-3 flex gap-2 items-center">
            <input value={newPtName} onChange={e => setNewPtName(e.target.value)} placeholder="New pay type name…" className="rounded-lg px-2 py-1.5 text-sm" style={ctl} />
            <select value={newPtMethod} onChange={e => setNewPtMethod(e.target.value as PayType['method'])} className="rounded-lg px-2 py-1.5 text-sm" style={ctl}>
              <option value="percent">% of Revenue</option><option value="hourly">Hourly</option><option value="combo">Hourly + %</option><option value="flat">Flat</option>
            </select>
            <button onClick={addPayType} className="rounded-lg px-3 py-1.5 text-sm" style={{ backgroundColor: 'rgba(58,143,87,.15)', border: '1px solid var(--christmas-green)', color: '#6fd394' }}>+ Add</button>
          </div>
        )}
      </div>

      {/* Technicians */}
      <div className="rounded-lg" style={card}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Technicians</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Attach pay types per technician and set their numbers. Mark which ST job types each is the default for.</div>
        </div>
        <div>
          {techs.map(t => {
            const open = expanded === t.id;
            const cfgs = configs[t.id] || [];
            return (
              <div key={t.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div onClick={() => toggleTech(t.id)} className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5">
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{t.name} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.trade || ''}</span></div>
                  <div className="flex items-center gap-2">
                    {open ? null : (cfgs.length > 0
                      ? cfgs.slice(0, 3).map(c => <span key={c.id} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{c.pay_type.name} <b style={{ color: 'var(--text-primary)' }}>{rateSummary(c)}</b></span>)
                      : (configs[t.id] ? <span className="text-xs" style={{ color: 'var(--amber, #d29922)' }}>No pay type set</span> : null))}
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{open ? '▴' : 'Edit ▾'}</span>
                  </div>
                </div>
                {open && (
                  <div className="px-4 pb-4" style={{ backgroundColor: 'rgba(58,143,87,.04)' }}>
                    {cfgs.length === 0 && <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No pay types yet.</div>}
                    {cfgs.map(c => {
                      const m = c.pay_type.method;
                      return (
                        <div key={c.id} className="rounded-lg p-3 mb-2 flex items-center gap-3 flex-wrap" style={card}>
                          <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)', minWidth: 130 }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: methodColor[m] }} />{c.pay_type.name}
                          </span>
                          {(m === 'hourly' || m === 'combo') && (
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>$ <input type="number" defaultValue={c.hourly_rate ?? ''} onBlur={e => patchConfig(t.id, c, { hourly_rate: e.target.value === '' ? null : Number(e.target.value) })} disabled={!canManage} className="rounded px-2 py-1 w-20 text-xs" style={ctl} /> /hr</span>
                          )}
                          {(m === 'percent' || m === 'combo') && (
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}><input type="number" defaultValue={c.percent ?? ''} onBlur={e => patchConfig(t.id, c, { percent: e.target.value === '' ? null : Number(e.target.value) })} disabled={!canManage} className="rounded px-2 py-1 w-16 text-xs" style={ctl} /> % of revenue</span>
                          )}
                          {m === 'flat' && (
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>$ <input type="number" defaultValue={c.flat_amount ?? ''} onBlur={e => patchConfig(t.id, c, { flat_amount: e.target.value === '' ? null : Number(e.target.value) })} disabled={!canManage} className="rounded px-2 py-1 w-24 text-xs" style={ctl} /> flat</span>
                          )}
                          <JobTypePicker all={jobTypes} selected={c.default_job_types || []} onChange={v => patchConfig(t.id, c, { default_job_types: v })} />
                          {canManage && <button onClick={() => delConfig(t.id, c.id)} className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>✕</button>}
                        </div>
                      );
                    })}
                    {canManage && (
                      <div className="flex gap-2 items-center mt-1">
                        <select value={addSel} onChange={e => { addConfig(t.id, e.target.value); }} className="rounded-lg px-2 py-1.5 text-sm" style={ctl}>
                          <option value="">+ Add a pay type…</option>
                          {payTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
