'use client';
import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import PresenceBadge from '@/components/PresenceBadge';
import { rowClass, ownerForLocation, daysSince, ageColor, fmtMoney, formatLocalDate } from '@/lib/pe-utils';
import { OWNERS, TECHS, SVC_SUBTYPES, PARTS_REPAIR, SVC_OWNERS_CONFIG } from '@/lib/constants';
import type { PEOrder, PEWarrantyClaim } from '@/types';

function fmtMD(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export default function ServicePage() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, openEditDetail, openCloseout, openAudit, openColSettings, isLoading,
    warrantyOrders, setWarrantyOrders, showToast, suppliers, validities, presence, setEditing } = ctx;

  // Clear my presence when leaving this board (route change removes the focused
  // input without firing blur, so onBlur alone would leave my avatar stuck here).
  useEffect(() => () => setEditing('service', null), [setEditing]);

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'cancelled'>('open');
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
      document.getElementById(`svc-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    const clear = setTimeout(() => setFocusId(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, []);

  function save(id: number, changes: Partial<PEOrder>) {
    saveOrderDebounced(id, changes);
  }

  function onLocationChange(id: number, loc: string, order: PEOrder) {
    const newOwner = ownerForLocation(loc, false);
    save(id, { location: loc, ...(newOwner ? { owner: newOwner } : {}) });
  }

  function onPartBOChange(id: number, checked: boolean, order: PEOrder) {
    // Part backordered → location Backordered (drives amber color) + CXR Team owns it.
    const changes: Partial<PEOrder> = { part_bo: checked };
    if (checked) { changes.location = 'Backordered'; changes.owner = 'CXR Team'; }
    save(id, changes);
  }

  function onBOInformedChange(id: number, checked: boolean, order: PEOrder) {
    // Customer informed of the backorder → hand back to Parts Coordinator.
    // Row stays the backordered color until the part arrives (parts_at_shop).
    const changes: Partial<PEOrder> = { bo_informed: checked };
    if (checked) changes.owner = 'Parts Coordinator';
    save(id, changes);
  }

  function onPartsAtShopChange(id: number, checked: boolean) {
    const changes: Partial<PEOrder> = { parts_at_shop: checked };
    if (checked) changes.owner = 'CXR Team';
    save(id, changes);
  }

  // Jobs that already have a warranty claim started (avoid duplicates).
  const warrantyJobs = useMemo(
    () => new Set(((warrantyOrders as PEWarrantyClaim[]) || []).map(w => String(w.job || '').trim()).filter(Boolean)),
    [warrantyOrders]
  );

  // When a ticket is marked warranty Parts (P) or Part & Labor (P/L), auto-start a
  // warranty claim on the Warranty tab pre-filled with the customer + ticket number.
  function onWTypeChange(o: PEOrder, val: string) {
    const changes: Partial<PEOrder> = { warranty_type: val };
    if (val === 'P' || val === 'P/L') changes.warranty = 'Yes';
    save(o.id, changes);

    if ((val === 'P' || val === 'P/L') && o.job && !warrantyJobs.has(String(o.job).trim())) {
      const newW = {
        last_name: '', mfgr: '', fail_date: null, repair_date: null,
        main_model_num: '', main_unit_sn: '', failed_part_num: '', failed_part_serial: '',
        mfg_invoice_num: '', repl_part_num: '', repl_part_serial: '',
        date_of_claim: formatLocalDate(new Date()), claim_num: '',
        credit_approved: '', return_required: '', amt_charged: '', amt_refunded: '', paid: '',
        job: o.job || '', tech: o.tech || '', customer: o.customer || '', status: 'active',
      };
      fetch('/api/warranty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newW) })
        .then(r => r.json())
        .then(({ claim }) => {
          if (claim) {
            setWarrantyOrders?.((prev: PEWarrantyClaim[]) => [claim, ...prev]);
            showToast?.(`Warranty claim started for ${o.customer || 'job #' + o.job}`);
          }
        })
        .catch(() => showToast?.('Failed to start warranty claim', 'error'));
    }
  }

  const svcOrders = useMemo(() => orders.filter((o: PEOrder) => o.order_type === 'service'), [orders]);

  const filtered = useMemo(() => {
    return svcOrders.filter((o: PEOrder) => {
      if (o.status !== statusFilter) return false;
      if (ownerFilter && o.owner !== ownerFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [o.job, o.tech, o.customer, o.part, o.supplier, o.note_cxr, o.note_wh].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [svcOrders, search, ownerFilter, statusFilter]);

  // Auto-link: open estimates that share an originating job number must be booked
  // together. Build {orderId -> {idx, total, job}} for any job with 2+ open rows.
  const linkGroups = useMemo(() => {
    const byJob = new Map<string, PEOrder[]>();
    for (const o of svcOrders) {
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
  }, [svcOrders]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const arr = [...filtered];
    arr.sort((a: PEOrder, b: PEOrder) => {
      let cmp = 0;
      if (sortCol === 'date') {
        cmp = (a.date || '').localeCompare(b.date || ''); // YYYY-MM-DD sorts chronologically
      } else {
        cmp = (a.customer || '').localeCompare(b.customer || '', 'en', { sensitivity: 'base' });
      }
      return cmp * sortDir;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const vrt = (label: string) => (
    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: 10, paddingTop: 4 }}>{label}</div>
  );

  return (
    <>
      {/* Owner Filter Bar */}
      <div className="owner-bar">
        {SVC_OWNERS_CONFIG.map(({ name, dot }) => {
          const count = svcOrders.filter((o: PEOrder) => o.status === 'open' && o.owner === name).length;
          const isActive = ownerFilter === name;
          return (
            <div key={name} className={`owner-card${isActive ? ' active' : ''}`} onClick={() => setOwnerFilter(isActive ? '' : name)}>
              <div className="owner-card-dot" style={{ background: dot }} />
              <div>
                <div className="owner-card-name">{name}</div>
                <div className="owner-card-count" style={{ color: dot }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="">All Owners</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openAudit?.()}>
          Audit Trail
        </button>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openColSettings?.('service')}>
          Columns
        </button>
        <span className="row-count">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ padding: '0 24px 12px' }}>
        {isLoading ? (
          <div className="empty"><div className="empty-icon">◎</div><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">◎</div><p>No service orders.</p></div>
        ) : (
          <div className="svc-container">
            <table className="st-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>✎</th>
                  <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by date">Date<span style={{ fontSize: 10, opacity: sortCol === 'date' ? 1 : 0.4 }}>{sortArrow('date')}</span></th>
                  <th>Job #</th>
                  <th>Sold By</th>
                  <th>Est. Cost</th>
                  <th onClick={() => toggleSort('customer')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Sort by customer name">Customer<span style={{ fontSize: 10, opacity: sortCol === 'customer' ? 1 : 0.4 }}>{sortArrow('customer')}</span></th>
                  <th>Owner</th>
                  <th>Type</th>
                  <th style={{ minWidth: 90 }}>Parts/Repair</th>
                  <th style={{ textAlign: 'center', minWidth: 44 }}>War?</th>
                  <th style={{ textAlign: 'center', minWidth: 55 }}>W.Type</th>
                  <th style={{ minWidth: 150 }}>Part/Description</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 70, verticalAlign: 'bottom', paddingBottom: 4 }}>
                    {vrt('Parts Ord.')}
                  </th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 70, verticalAlign: 'bottom', paddingBottom: 4 }}>
                    {vrt('Part B/O?')}
                  </th>
                  <th style={{ minWidth: 55 }}>ETA</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 70, verticalAlign: 'bottom', paddingBottom: 4 }}>
                    {vrt('Cust. Inf. B/O')}
                  </th>
                  <th style={{ minWidth: 150 }}>Supplier</th>
                  <th>Order #</th>
                  <th>Cost</th>
                  <th style={{ minWidth: 140 }}>Location</th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 70, verticalAlign: 'bottom', paddingBottom: 4 }}>
                    {vrt('Parts at Shop')}
                  </th>
                  <th style={{ textAlign: 'center', minWidth: 36, height: 70, verticalAlign: 'bottom', paddingBottom: 4 }}>
                    {vrt('2 Techs?')}
                  </th>
                  <th style={{ minWidth: 170 }}>WH Notes</th>
                  <th style={{ minWidth: 170 }}>CXR Notes</th>
                  <th style={{ minWidth: 120 }}>Validity</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o: PEOrder) => {
                  const rc = rowClass(o);
                  const editors = presence.filter(p => p.board === 'service' && p.rowId === o.id);
                  const age = daysSince(o.date);
                  const linkedCount = o.linked_jobs?.length || 0;
                  const link = linkGroups.get(o.id);
                  const isWarranty = ['Yes', 'P', 'P/L', 'L'].includes(o.warranty ?? '');
                  const trStyle: React.CSSProperties = {};
                  if (link) trStyle.boxShadow = 'inset 4px 0 0 #d48a0a';
                  if (focusId === o.id) { trStyle.outline = '2px solid var(--accent)'; trStyle.outlineOffset = -2; }
                  return (
                    <tr key={o.id} id={`svc-row-${o.id}`} className={rc}
                      onFocus={() => setEditing('service', o.id)}
                      onBlur={() => setEditing('service', null)}
                      style={Object.keys(trStyle).length ? trStyle : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="detail-open-btn" onClick={() => openEditDetail?.(o.id)} title="Edit details">✎</button>
                        <PresenceBadge peers={editors} />
                      </td>

                      <td>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', color: ageColor(age) }}>{fmtMD(o.date)}</span>
                      </td>

                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input className="si" value={o.job || ''} onChange={e => save(o.id, { job: e.target.value })}
                            style={{ minWidth: 100, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#2d4a3e', fontWeight: 600 }} />
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
                          {linkedCount > 0 && <span className="linked-badge">+{linkedCount}</span>}
                        </span>
                      </td>

                      <td>
                        <select className="si-sel" value={o.tech || ''} onChange={e => save(o.id, { tech: e.target.value })} style={{ minWidth: 100 }}>
                          <option value="">— tech —</option>
                          {o.tech && !TECHS.includes(o.tech) && <option value={o.tech}>{o.tech}</option>}
                          {TECHS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>

                      <td>
                        <input className="si" value={o.estimate_cost || ''} onChange={e => save(o.id, { estimate_cost: e.target.value })} onBlur={e => save(o.id, { estimate_cost: fmtMoney(e.target.value) })} placeholder="$0.00" style={{ minWidth: 85 }} />
                      </td>

                      <td>
                        <input className="si" value={o.customer || ''} onChange={e => save(o.id, { customer: e.target.value })} style={{ minWidth: 130 }} />
                      </td>

                      <td>
                        <select className="si-sel" value={o.owner || ''} onChange={e => save(o.id, { owner: e.target.value })} style={{ minWidth: 150 }}>
                          <option value="">— owner —</option>
                          {OWNERS.map(owner => <option key={owner}>{owner}</option>)}
                        </select>
                      </td>

                      <td>
                        <select className="si-sel" value={o.subtype || ''} onChange={e => {
                          const v = e.target.value;
                          const patch: Partial<PEOrder> = { subtype: v };
                          if (v === 'Membership') patch.owner = 'CXR Team';
                          else if (v === 'Duct Cleaning') patch.owner = 'Install Dispatcher';
                          else if (v === 'Plumbing') patch.owner = 'Plumbing Dispatcher';
                          save(o.id, patch);
                        }} style={{ minWidth: 90 }}>
                          <option value="">— type —</option>
                          {o.subtype && !SVC_SUBTYPES.includes(o.subtype) && <option value={o.subtype}>{o.subtype}</option>}
                          {SVC_SUBTYPES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>

                      <td>
                        <select className="si-sel" value={o.tech_type || ''} onChange={e => save(o.id, { tech_type: e.target.value })} style={{ minWidth: 90 }}>
                          <option value="">—</option>
                          {PARTS_REPAIR.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={isWarranty} style={{ width: 16, height: 16, accentColor: '#1565c0', cursor: 'pointer' }}
                          onChange={e => save(o.id, { warranty: e.target.checked ? 'Yes' : 'No' })} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <select className="si-sel" value={o.warranty_type || ''} onChange={e => onWTypeChange(o, e.target.value)}
                          style={{ minWidth: 50, opacity: isWarranty ? 1 : .3 }}>
                          <option value="">—</option>
                          {['P', 'L', 'P/L'].map(w => <option key={w}>{w}</option>)}
                        </select>
                      </td>

                      <td>
                        <input className="si" value={o.part || ''} onChange={e => save(o.id, { part: e.target.value })} title={o.part || ''} placeholder="Part description..." style={{ minWidth: 150 }} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.parts_ordered} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }}
                          onChange={e => save(o.id, { parts_ordered: e.target.checked })} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.part_bo} style={{ width: 16, height: 16, accentColor: '#c0392b', cursor: 'pointer' }}
                          onChange={e => onPartBOChange(o.id, e.target.checked, o)} />
                      </td>

                      <td>
                        <input className="si" type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })} style={{ minWidth: 130 }} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.bo_informed} style={{ width: 16, height: 16, accentColor: '#2980b9', cursor: 'pointer' }}
                          onChange={e => onBOInformedChange(o.id, e.target.checked, o)} />
                      </td>

                      <td>
                        <select className="si-sel" value={o.supplier || ''} onChange={e => save(o.id, { supplier: e.target.value })} style={{ minWidth: 150 }}>
                          <option value="">— select —</option>
                          {o.supplier && !suppliers.includes(o.supplier) && <option value={o.supplier}>{o.supplier}</option>}
                          {suppliers.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>

                      <td>
                        <input className="si" value={o.order_num || ''} onChange={e => save(o.id, { order_num: e.target.value })} style={{ minWidth: 90, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} />
                      </td>

                      <td>
                        <input className="si" value={o.cost || ''} onChange={e => save(o.id, { cost: e.target.value })} onBlur={e => save(o.id, { cost: fmtMoney(e.target.value) })} placeholder="$0.00" style={{ minWidth: 85 }} />
                      </td>

                      <td>
                        <select className="si-sel" value={o.location || ''} onChange={e => onLocationChange(o.id, e.target.value, o)} style={{ minWidth: 140 }}>
                          <option value="">— select —</option>
                          {['Place Order','Shipping to Shop','Lewisville Shop','Backordered','P/U Supply House','Waiting for Customer','Waiting for Tech/Cus','Cancel PO','Shipping to Supplier','Duct Cleaning - Schedule'].map(l => <option key={l}>{l}</option>)}
                        </select>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.parts_at_shop} style={{ width: 16, height: 16, accentColor: '#7d3c98', cursor: 'pointer' }}
                          onChange={e => onPartsAtShopChange(o.id, e.target.checked)} />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!o.two_techs} style={{ width: 16, height: 16, accentColor: '#117a65', cursor: 'pointer' }}
                          onChange={e => save(o.id, { two_techs: e.target.checked })} />
                      </td>

                      <td>
                        <input className="si" value={o.note_wh || ''} onChange={e => save(o.id, { note_wh: e.target.value })} placeholder="WH notes..." />
                      </td>

                      <td>
                        <input className="si" value={o.note_cxr || ''} onChange={e => save(o.id, { note_cxr: e.target.value })} placeholder="CXR notes..." />
                      </td>

                      <td>
                        <select className="si-sel" value={o.validity || ''} onChange={e => save(o.id, { validity: e.target.value })} style={{ minWidth: 110 }}>
                          <option value="">— select —</option>
                          {o.validity && !validities.includes(o.validity) && <option value={o.validity}>{o.validity}</option>}
                          {validities.map(v => <option key={v}>{v}</option>)}
                        </select>
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
