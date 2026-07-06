'use client';
import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import { rowClass, ownerForLocation, daysSince, ageColor, fmtMoney } from '@/lib/pe-utils';
import { SUPPLIERS, INSTALL_TEAMS } from '@/lib/constants';
import type { PEOrder } from '@/types';

const INSTALL_TECHS = ['Luke', 'Brett', 'Christina', 'John', 'Daniel', 'Other'];

function fmtMD(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export default function InstallPage() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, openEditDetail, openCloseout, isLoading } = ctx;

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [statFilter, setStatFilter] = useState<string>('all');
  const [focusId, setFocusId] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<'date' | 'customer' | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(col: 'date' | 'customer') {
    if (sortCol === col) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortCol(col);
      setSortDir(1);
    }
  }
  const sortArrow = (col: 'date' | 'customer') =>
    sortCol === col ? (sortDir === 1 ? ' ▲' : ' ▼') : ' ⇅';

  // When arriving from the dashboard (?focus=<id>), highlight + scroll to that row.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('focus');
    const id = raw ? parseInt(raw, 10) : NaN;
    if (isNaN(id)) return;
    setFocusId(id);
    const t = setTimeout(() => {
      document.getElementById(`inst-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    const clear = setTimeout(() => setFocusId(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, []);

  function save(id: number, changes: Partial<PEOrder>) {
    saveOrderDebounced(id, changes);
  }

  function onLocationChange(id: number, loc: string, order: PEOrder) {
    const newOwner = ownerForLocation(loc, true);
    save(id, { location: loc, ...(newOwner ? { owner: newOwner } : {}) });
  }

  function onBOStatusChange(id: number, val: string) {
    // B/O = Yes → location Backordered (amber) + Install Dispatcher owns it.
    const changes: Partial<PEOrder> = { bo_status: val };
    if (val === 'Yes') { changes.location = 'Backordered'; changes.owner = 'Install Dispatcher'; }
    save(id, changes);
  }

  function onBOInformedChange(id: number, checked: boolean) {
    // Customer informed → hand back to Parts Coordinator; row stays Backordered.
    const changes: Partial<PEOrder> = { bo_informed: checked };
    if (checked) changes.owner = 'Parts Coordinator';
    save(id, changes);
  }

  function onCallBookedChange(id: number, checked: boolean) {
    const changes: Partial<PEOrder> = { call_booked: checked };
    if (checked) changes.owner = 'Install Dispatcher';
    save(id, changes);
  }

  const instOrders = useMemo(() => orders.filter((o: PEOrder) => o.order_type === 'install'), [orders]);
  const instOpen = useMemo(() => instOrders.filter((o: PEOrder) => o.status === 'open'), [instOrders]);

  const stats = useMemo(() => ({
    all: instOpen.length,
    bo: instOpen.filter((o: PEOrder) => o.location === 'Backordered').length,
    scheduled: instOpen.filter((o: PEOrder) => !!(o.sched_date || o.scheduled_date)).length,
    aging: instOpen.filter((o: PEOrder) => daysSince(o.date) > 30).length,
    done: instOrders.filter((o: PEOrder) => o.status === 'completed').length,
  }), [instOrders, instOpen]);

  const filtered = useMemo(() => {
    return instOrders.filter((o: PEOrder) => {
      if (statusFilter === 'open' && o.status !== 'open') return false;
      if (statusFilter === 'completed' && o.status !== 'completed') return false;
      if (teamFilter && o.install_team !== teamFilter) return false;
      if (statFilter === 'Backordered' && o.location !== 'Backordered') return false;
      if (statFilter === 'scheduled' && !(o.sched_date || o.scheduled_date)) return false;
      if (statFilter === 'aging' && daysSince(o.date) <= 30) return false;
      if (statFilter === 'completed' && o.status !== 'completed') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [o.job, o.tech, o.customer, o.part, o.supplier, o.install_team, o.note_wh, o.note_cxr].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [instOrders, search, teamFilter, statusFilter, statFilter]);

  // Auto-link: open estimates sharing an originating job number must be booked
  // together (this is where Scott Crowder's second job was missed).
  const linkGroups = useMemo(() => {
    const byJob = new Map<string, PEOrder[]>();
    for (const o of instOrders) {
      if (o.status !== 'open') continue;
      const j = (o.job || '').trim();
      if (!j) continue;
      if (!byJob.has(j)) byJob.set(j, []);
      byJob.get(j)!.push(o);
    }
    const info = new Map<number, { idx: number; total: number; job: string }>();
    byJob.forEach((arr, j) => {
      if (arr.length < 2) return;
      arr.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
      arr.forEach((o, i) => info.set(o.id, { idx: i + 1, total: arr.length, job: j }));
    });
    return info;
  }, [instOrders]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const arr = [...filtered];
    arr.sort((a: PEOrder, b: PEOrder) => {
      let cmp = 0;
      if (sortCol === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else {
        cmp = (a.customer || '').localeCompare(b.customer || '', 'en', { sensitivity: 'base' });
      }
      return cmp * sortDir;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  function setActiveStatFilter(key: string, status: 'open' | 'completed') {
    setStatFilter(key);
    setStatusFilter(status);
  }

  const vrt = (label: string) => (
    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 10, paddingTop: 4 }}>{label}</div>
  );

  return (
    <>
      {/* Stat Cards */}
      <div className="stat-bar" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { key: 'all', label: 'All Open', count: stats.all, color: 'col-accent', status: 'open' as const },
          { key: 'Backordered', label: 'Backordered', count: stats.bo, color: 'col-red', status: 'open' as const },
          { key: 'scheduled', label: 'Scheduled', count: stats.scheduled, color: 'col-green', status: 'open' as const },
          { key: 'aging', label: 'Over 30 Days', count: stats.aging, color: 'col-red', status: 'open' as const },
          { key: 'completed', label: 'Completed', count: stats.done, color: 'col-green', status: 'completed' as const },
        ].map(s => (
          <div key={s.key} className={`stat${statFilter === s.key ? ' active' : ''}`}
            onClick={() => setActiveStatFilter(s.key, s.status)}>
            <div className={`stat-num ${s.color}`}>{s.count}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <option value="">All teams</option>
          {INSTALL_TEAMS.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
        <span className="row-count">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <datalist id="pe-suppliers">
        {SUPPLIERS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div className="table-wrap" style={{ padding: '0 24px 12px' }}>
        {isLoading ? (
          <div className="empty"><div className="empty-icon">◎</div><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">◎</div><p>No install orders.</p></div>
        ) : (
          <div className="inst-container">
            <table className="it-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>✎</th>
                  <th onClick={() => toggleSort('date')} style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4, cursor: 'pointer', userSelect: 'none' }} title="Sort by date">{vrt('Date')}<span style={{ fontSize: 10, opacity: sortCol === 'date' ? 1 : 0.4 }}>{sortArrow('date')}</span></th>
                  <th>Job #</th>
                  <th onClick={() => toggleSort('customer')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by customer name">Customer<span style={{ fontSize: 10, opacity: sortCol === 'customer' ? 1 : 0.4 }}>{sortArrow('customer')}</span></th>
                  <th>Sold By</th>
                  <th>Job Cost</th>
                  <th>Owner</th>
                  <th style={{ textAlign: 'center', minWidth: 40 }}>War?</th>
                  <th>Equipment to Order</th>
                  <th style={{ minWidth: 50, textAlign: 'center' }}>Avail?</th>
                  <th style={{ minWidth: 50, textAlign: 'center' }}>B/O?</th>
                  <th style={{ minWidth: 60 }}>ETA</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4 }}>{vrt('Cust. Inf. B/O')}</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4 }}>{vrt('Parts Ordered')}</th>
                  <th>Ordered From</th>
                  <th>Order #</th>
                  <th>Equip. Cost</th>
                  <th>Location</th>
                  <th>Install Team</th>
                  <th>Sub Rate</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4 }}>{vrt('Date Sched.')}</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4 }}>{vrt('Call Booked?')}</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 60, verticalAlign: 'bottom', paddingBottom: 4 }}>{vrt('QC Scheduled?')}</th>
                  <th style={{ minWidth: 70 }}>QC Date</th>
                  <th style={{ minWidth: 180 }}>Notes</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o: PEOrder) => {
                  const rc = rowClass(o);
                  const link = linkGroups.get(o.id);
                  const trStyle: React.CSSProperties = {};
                  if (link) trStyle.boxShadow = 'inset 4px 0 0 #d48a0a';
                  if (focusId === o.id) { trStyle.outline = '2px solid var(--accent)'; trStyle.outlineOffset = -2; }
                  return (
                    <tr key={o.id} id={`inst-row-${o.id}`} className={rc}
                      style={Object.keys(trStyle).length ? trStyle : undefined}>
                      <td><button className="detail-open-btn" style={{ background: '#7a1c2e' }} onClick={() => openEditDetail?.(o.id)}>✎</button></td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: ageColor(daysSince(o.date)) }}>{fmtMD(o.date)}</span>
                      </td>

                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input className="si" value={o.job || ''} onChange={e => save(o.id, { job: e.target.value })} style={{ minWidth: 95, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#2d4a3e', fontWeight: 600 }} />
                          {o.st_url && (
                            <a href={o.st_url} target="_blank" rel="noopener noreferrer" title="Open job in ServiceTitan"
                              onClick={e => e.stopPropagation()}
                              style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>↗</a>
                          )}
                          {link && (
                            <span onClick={() => setSearch(o.job || '')}
                              title={`Book together — ${link.total} estimates on job #${link.job}. Click to show them all.`}
                              style={{ background: '#d48a0a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ‼ {link.idx}/{link.total}
                            </span>
                          )}
                        </span>
                      </td>

                      <td><input className="si" value={o.customer || ''} onChange={e => save(o.id, { customer: e.target.value })} style={{ minWidth: 130 }} /></td>

                      <td>
                        <select className="si-sel" style={{ minWidth: 90 }} value={o.tech || ''} onChange={e => save(o.id, { tech: e.target.value })}>
                          <option value="">— tech —</option>
                          {o.tech && !INSTALL_TECHS.includes(o.tech) && <option value={o.tech}>{o.tech}</option>}
                          {INSTALL_TECHS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>

                      <td><input className="si" value={o.job_cost || ''} onChange={e => save(o.id, { job_cost: e.target.value })} onBlur={e => save(o.id, { job_cost: fmtMoney(e.target.value) })} placeholder="$0.00" style={{ minWidth: 85 }} /></td>

                      <td>
                        <select className="si-sel" value={o.owner || ''} onChange={e => save(o.id, { owner: e.target.value })} style={{ minWidth: 130 }}>
                          <option value="">— owner —</option>
                          <option>Install Manager</option>
                          <option>Parts Coordinator</option>
                          <option>Warehouse</option>
                          <option>Install Dispatcher</option>
                          <option>Christina</option>
                        </select>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <select className="si-sel" value={o.warranty || ''} onChange={e => save(o.id, { warranty: e.target.value })}>
                          <option value="">—</option>
                          <option>Yes</option><option>No</option><option>E/L</option><option>E</option>
                        </select>
                      </td>

                      <td><input className="si" value={o.part || ''} onChange={e => save(o.id, { part: e.target.value })} title={o.part || ''} placeholder="Equipment..." style={{ minWidth: 150 }} /></td>

                      <td style={{ textAlign: 'center' }}>
                        <select className="si-sel" value={o.equip_avail || ''} onChange={e => save(o.id, { equip_avail: e.target.value })}>
                          <option value="">—</option><option>Yes</option><option>No</option>
                        </select>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <select className="si-sel" value={o.bo_status || ''} onChange={e => onBOStatusChange(o.id, e.target.value)}>
                          <option value="">—</option><option>Yes</option><option>No</option>
                        </select>
                      </td>

                      <td>
                        <input className="si" type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })} style={{ minWidth: 130 }} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.bo_informed} style={{ width: 16, height: 16, accentColor: '#2980b9', cursor: 'pointer' }} onChange={e => onBOInformedChange(o.id, e.target.checked)} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.bo_ordered} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }} onChange={e => save(o.id, { bo_ordered: e.target.checked })} />
                      </td>

                      <td>
                        <input className="si" list="pe-suppliers" value={o.supplier || ''} onChange={e => save(o.id, { supplier: e.target.value })} placeholder="— select or type —" title={o.supplier || ''} style={{ minWidth: 150 }} />
                      </td>

                      <td><input className="si" value={o.order_num || ''} onChange={e => save(o.id, { order_num: e.target.value })} style={{ minWidth: 90, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} /></td>

                      <td><input className="si" value={o.equip_cost || ''} onChange={e => save(o.id, { equip_cost: e.target.value })} onBlur={e => save(o.id, { equip_cost: fmtMoney(e.target.value) })} placeholder="$0.00" style={{ minWidth: 85 }} /></td>

                      <td>
                        <select className="si-sel" value={o.location || ''} onChange={e => onLocationChange(o.id, e.target.value, o)} style={{ minWidth: 140 }}>
                          <option value="">— select —</option>
                          {['Place Order','Shipping to Shop','Lewisville Shop','Backordered','P/U Supply House','Waiting for Customer','Cancel PO','Shipping to Supplier'].map(l => <option key={l}>{l}</option>)}
                        </select>
                      </td>

                      <td>
                        <select className="si-sel" value={o.install_team || ''} onChange={e => save(o.id, { install_team: e.target.value })} style={{ minWidth: 90 }}>
                          <option value="">— select —</option>
                          {INSTALL_TEAMS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>

                      <td><input className="si" value={o.sub_rate || ''} onChange={e => save(o.id, { sub_rate: e.target.value })} onBlur={e => save(o.id, { sub_rate: fmtMoney(e.target.value) })} placeholder="$0.00" style={{ minWidth: 85 }} /></td>

                      <td>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMD(o.sched_date)}</span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.call_booked} style={{ width: 16, height: 16, accentColor: '#d4ac0d', cursor: 'pointer' }} onChange={e => onCallBookedChange(o.id, e.target.checked)} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.qc_scheduled} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }} onChange={e => save(o.id, { qc_scheduled: e.target.checked })} />
                      </td>

                      <td>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}>{fmtMD(o.qc_date)}</span>
                      </td>

                      <td>
                        <input className="si" value={[o.note_wh, o.note_cxr].filter(Boolean).join(' | ') || ''} onChange={e => save(o.id, { note_wh: e.target.value })} placeholder="Notes..." style={{ minWidth: 170 }} />
                      </td>

                      <td>
                        <button className="closeout-x-btn" onClick={() => openCloseout?.(o.id)} title="Close out / Cancel">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
