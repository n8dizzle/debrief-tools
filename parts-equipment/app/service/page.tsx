'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import PresenceBadge from '@/components/PresenceBadge';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import PrefsTable, { type PrefsColumn } from '@/components/PrefsTable';
import { useFillViewportHeight } from '@/hooks/useFillViewportHeight';
import { rowClass, daysSince, ageColor, fmtMoney, formatLocalDate, compareValues, STAGES } from '@/lib/pe-utils';
import { OWNERS, TECHS, SVC_SUBTYPES, PARTS_REPAIR, SVC_OWNERS_CONFIG } from '@/lib/constants';
import type { PEOrder, PEWarrantyClaim } from '@/types';

function fmtMD(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#1565c0', bg: 'rgba(21,101,192,0.12)' },
  completed: { label: 'Scheduled', color: '#1a7a4a', bg: 'rgba(26,122,74,0.14)' },
  cancelled: { label: 'Cancelled', color: '#8a8f9c', bg: 'rgba(120,125,140,0.16)' },
};
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status || '—', color: '#6b7592', bg: 'var(--surface2)' };
  return <span style={{ fontSize: 10, fontWeight: 700, color: m.color, background: m.bg, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{m.label}</span>;
}

export default function ServicePage() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, commitOrderNum, openEditDetail, openCloseout, openAudit, openWizard, isLoading,
    warrantyOrders, setWarrantyOrders, showToast, suppliers, validities, locations, blockedReasons, presence, setEditing } = ctx;

  // Remembers what each row's Order # box held when it was focused, so on blur we
  // can tell a brand-new entry (blank -> filled) from an edit of an existing one.
  // Only a brand-new entry fires the ServiceTitan note.
  const orderNumFocus = useRef<Record<number, string>>({});

  // Clear my presence when leaving this board (route change removes the focused
  // input without firing blur, so onBlur alone would leave my avatar stuck here).
  useEffect(() => () => setEditing('service', null), [setEditing]);

  // Pin the table's scroll box to fill the viewport so its horizontal scrollbar
  // stays in view (no scrolling past every row to reach it).
  const scrollRef = useRef<HTMLDivElement>(null);
  useFillViewportHeight(scrollRef, [isLoading]);

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  // Multi-select filters. Empty set = no filter (show all). Status defaults to Open.
  const [statuses, setStatuses] = useState<Set<string>>(() => new Set(['open']));
  const [typeFilterSet, setTypeFilterSet] = useState<Set<string>>(new Set());
  const [prFilterSet, setPrFilterSet] = useState<Set<string>>(new Set());
  const [locationFilterSet, setLocationFilterSet] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [colsOpen, setColsOpen] = useState(false);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  }

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

  function onLocationChange(id: number, loc: string) {
    // Location and owner are independent — changing location no longer reassigns
    // the owner (team feedback: it was unexpectedly handing tickets to Warehouse).
    save(id, { location: loc });
  }

  function onPartBOChange(id: number, checked: boolean) {
    // Part backordered → blocked Backordered (drives amber) + stage Ordered + CXR Team owns it.
    // Unchecked → clear the backordered block (leave other block reasons alone).
    const changes: Partial<PEOrder> = { part_bo: checked };
    if (checked) { changes.blocked = 'backordered'; changes.stage = 'ordered'; changes.owner = 'CXR Team'; }
    else { changes.blocked = ''; }
    save(id, changes);
  }

  function onBOInformedChange(id: number, checked: boolean) {
    // Customer informed of the backorder → hand back to Parts Coordinator.
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
      if (statuses.size > 0 && !statuses.has(o.status)) return false;
      if (ownerFilter && o.owner !== ownerFilter) return false;
      if (typeFilterSet.size > 0 && !typeFilterSet.has(o.subtype || '')) return false;
      if (prFilterSet.size > 0 && !prFilterSet.has(o.tech_type || '')) return false;
      if (locationFilterSet.size > 0 && !locationFilterSet.has(o.location || '')) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        // Global search across every user-facing column (incl. the Status label so
        // "scheduled" matches the 'completed' status, and both raw + M/D dates).
        const hay = [
          o.job, o.tech, o.customer, o.owner, o.subtype, o.tech_type,
          o.part, o.supplier, o.order_num, o.location, o.validity,
          o.estimate_cost, o.cost, o.eta, fmtMD(o.date), o.date,
          o.warranty_type, STATUS_META[o.status]?.label || o.status,
          o.note_wh, o.note_cxr,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [svcOrders, search, ownerFilter, statuses, typeFilterSet, prFilterSet, locationFilterSet]);

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
    const key = sortCol;
    return [...filtered].sort((a, b) => compareValues((a as unknown as Record<string, unknown>)[key], (b as unknown as Record<string, unknown>)[key]) * sortDir);
  }, [filtered, sortCol, sortDir]);

  // ── Column config (order = default order; users reorder/resize/hide/freeze) ──
  const columns = useMemo<PrefsColumn<PEOrder>[]>(() => [
    {
      key: 'edit', label: 'Edit', locked: true, defaultWidth: 46, minWidth: 46, align: 'center',
      render: (o) => (
        <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
          <button className="detail-open-btn" onClick={() => openEditDetail?.(o.id)} title="Edit details">✎</button>
          <PresenceBadge peers={presence.filter(p => p.board === 'service' && p.rowId === o.id)} />
        </span>
      ),
    },
    {
      key: 'status', label: 'Status', defaultWidth: 84, minWidth: 60, align: 'center',
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: 'date', label: 'Date', sortKey: 'date', defaultWidth: 66, minWidth: 50,
      render: (o) => <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: ageColor(daysSince(o.date)) }}>{fmtMD(o.date)}</span>,
    },
    {
      key: 'job', label: 'Job #', defaultWidth: 150, minWidth: 90,
      render: (o) => {
        const link = linkGroups.get(o.id);
        const linkedCount = o.linked_jobs?.length || 0;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <input className="si" value={o.job || ''} onChange={e => save(o.id, { job: e.target.value })}
              size={Math.max((o.job || '').length, 3)}
              style={{ width: 'auto', flex: '0 0 auto', padding: 0, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text)', fontWeight: 600 }} />
            {o.st_url && (
              <a href={o.st_url} target="_blank" rel="noopener noreferrer" title="Open job in ServiceTitan"
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text)', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
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
        );
      },
    },
    {
      key: 'tech', label: 'Sold By', defaultWidth: 120, minWidth: 80,
      render: (o) => (
        <select className="si-sel" value={o.tech || ''} onChange={e => save(o.id, { tech: e.target.value })}>
          <option value="">— tech —</option>
          {o.tech && !TECHS.includes(o.tech) && <option value={o.tech}>{o.tech}</option>}
          {TECHS.map(t => <option key={t}>{t}</option>)}
        </select>
      ),
    },
    {
      key: 'estimate_cost', label: 'Est. Subtotal', defaultWidth: 100, minWidth: 70,
      render: (o) => <input className="si" value={o.estimate_cost || ''} onChange={e => save(o.id, { estimate_cost: e.target.value })} onBlur={e => save(o.id, { estimate_cost: fmtMoney(e.target.value) })} placeholder="$0.00" />,
    },
    {
      key: 'customer', label: 'Customer', sortKey: 'customer', defaultWidth: 150, minWidth: 90,
      render: (o) => <input className="si" value={o.customer || ''} onChange={e => save(o.id, { customer: e.target.value })} />,
    },
    {
      key: 'owner', label: 'Owner', defaultWidth: 160, minWidth: 100,
      render: (o) => (
        <select className="si-sel" value={o.owner || ''} onChange={e => save(o.id, { owner: e.target.value })}>
          <option value="">— owner —</option>
          {OWNERS.map(owner => <option key={owner}>{owner}</option>)}
        </select>
      ),
    },
    {
      key: 'subtype', label: 'Type', defaultWidth: 100, minWidth: 80,
      render: (o) => (
        <select className="si-sel" value={o.subtype || ''} onChange={e => {
          const v = e.target.value;
          const patch: Partial<PEOrder> = { subtype: v };
          if (v === 'Membership') patch.owner = 'CXR Team';
          else if (v === 'Duct Cleaning') patch.owner = 'Install Dispatcher';
          else if (v === 'Plumbing') patch.owner = 'Plumbing Dispatcher';
          save(o.id, patch);
        }}>
          <option value="">— type —</option>
          {o.subtype && !SVC_SUBTYPES.includes(o.subtype) && <option value={o.subtype}>{o.subtype}</option>}
          {SVC_SUBTYPES.map(s => <option key={s}>{s}</option>)}
        </select>
      ),
    },
    {
      key: 'tech_type', label: 'Parts/Repair', defaultWidth: 95, minWidth: 70,
      render: (o) => (
        <select className="si-sel" value={o.tech_type || ''} onChange={e => save(o.id, { tech_type: e.target.value })}>
          <option value="">—</option>
          {PARTS_REPAIR.map(s => <option key={s}>{s}</option>)}
        </select>
      ),
    },
    {
      key: 'warranty', label: 'War?', align: 'center', defaultWidth: 50, minWidth: 44,
      render: (o) => {
        const isWarranty = ['Yes', 'P', 'P/L', 'L'].includes(o.warranty ?? '');
        return <input type="checkbox" checked={isWarranty} style={{ width: 16, height: 16, accentColor: '#1565c0', cursor: 'pointer' }}
          onChange={e => save(o.id, { warranty: e.target.checked ? 'Yes' : 'No' })} />;
      },
    },
    {
      key: 'warranty_type', label: 'W.Type', align: 'center', defaultWidth: 60, minWidth: 50,
      render: (o) => {
        const isWarranty = ['Yes', 'P', 'P/L', 'L'].includes(o.warranty ?? '');
        return (
          <select className="si-sel" value={o.warranty_type || ''} onChange={e => onWTypeChange(o, e.target.value)} style={{ opacity: isWarranty ? 1 : .3 }}>
            <option value="">—</option>
            {['P', 'L', 'P/L'].map(w => <option key={w}>{w}</option>)}
          </select>
        );
      },
    },
    {
      key: 'part', label: 'Part / Description', defaultWidth: 170, minWidth: 100,
      render: (o) => <input className="si" value={o.part || ''} onChange={e => save(o.id, { part: e.target.value })} title={o.part || ''} placeholder="Part description..." />,
    },
    {
      key: 'parts_ordered', label: 'Parts Ord.', align: 'center', defaultWidth: 54, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.parts_ordered} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }}
        onChange={e => save(o.id, { parts_ordered: e.target.checked })} />,
    },
    {
      key: 'part_bo', label: 'Part B/O?', align: 'center', defaultWidth: 54, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.part_bo} style={{ width: 16, height: 16, accentColor: '#c0392b', cursor: 'pointer' }}
        onChange={e => onPartBOChange(o.id, e.target.checked)} />,
    },
    {
      key: 'eta', label: 'ETA', defaultWidth: 140, minWidth: 110,
      render: (o) => <input className="si" type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })} />,
    },
    {
      key: 'bo_informed', label: 'Cust. Inf. B/O', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.bo_informed} style={{ width: 16, height: 16, accentColor: '#2980b9', cursor: 'pointer' }}
        onChange={e => onBOInformedChange(o.id, e.target.checked)} />,
    },
    {
      key: 'supplier', label: 'Supplier', defaultWidth: 160, minWidth: 100,
      render: (o) => (
        <select className="si-sel" value={o.supplier || ''} onChange={e => save(o.id, { supplier: e.target.value })}>
          <option value="">— select —</option>
          {o.supplier && !suppliers.includes(o.supplier) && <option value={o.supplier}>{o.supplier}</option>}
          {suppliers.map(s => <option key={s}>{s}</option>)}
        </select>
      ),
    },
    {
      key: 'order_num', label: 'Order #', defaultWidth: 100, minWidth: 70,
      render: (o) => {
        // Locked until a supplier is picked — this guarantees the ServiceTitan
        // note (fired when the order # is committed) always has a supplier in it.
        const noSupplier = !(o.supplier || '').trim();
        return <input
          className="si"
          value={o.order_num || ''}
          disabled={noSupplier}
          title={noSupplier ? 'Pick a supplier first' : undefined}
          placeholder={noSupplier ? 'supplier first' : ''}
          onFocus={e => { orderNumFocus.current[o.id] = e.target.value.trim(); }}
          onChange={e => save(o.id, { order_num: e.target.value })}
          onBlur={e => {
            const startedEmpty = !orderNumFocus.current[o.id];
            const now = e.target.value.trim();
            if (startedEmpty && now) commitOrderNum(o.id, now);
          }}
          style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, ...(noSupplier ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
        />;
      },
    },
    {
      key: 'cost', label: 'Cost', defaultWidth: 100, minWidth: 70,
      render: (o) => <input className="si" value={o.cost || ''} onChange={e => save(o.id, { cost: e.target.value })} onBlur={e => save(o.id, { cost: fmtMoney(e.target.value) })} placeholder="$0.00" />,
    },
    {
      // The primary pipeline control — advance the row right here in the grid.
      key: 'stage', label: 'Stage', defaultWidth: 120, minWidth: 100,
      render: (o) => (
        <select className="si-sel" value={o.stage || 'needs_order'} onChange={e => save(o.id, { stage: e.target.value })}>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      ),
    },
    {
      key: 'blocked', label: 'Blocked', defaultWidth: 150, minWidth: 110,
      render: (o) => (
        <select className="si-sel" value={o.blocked || ''}
          style={o.blocked ? { color: 'var(--amber, #9a6410)', fontWeight: 600 } : undefined}
          onChange={e => save(o.id, { blocked: e.target.value })}>
          <option value="">—</option>
          {o.blocked && !blockedReasons.some(b => b.value === o.blocked) && <option value={o.blocked}>{o.blocked}</option>}
          {blockedReasons.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      ),
    },
    {
      // Physical place only now (migration 009); blank = not physically anywhere yet.
      key: 'location', label: 'Location', defaultWidth: 130, minWidth: 100,
      render: (o) => (
        <select className="si-sel" value={o.location || ''} onChange={e => onLocationChange(o.id, e.target.value)}>
          <option value="">—</option>
          {o.location && !locations.includes(o.location) && <option value={o.location}>{o.location}</option>}
          {locations.map(l => <option key={l}>{l}</option>)}
        </select>
      ),
    },
    {
      key: 'parts_at_shop', label: 'Parts at Shop', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.parts_at_shop} style={{ width: 16, height: 16, accentColor: '#7d3c98', cursor: 'pointer' }}
        onChange={e => onPartsAtShopChange(o.id, e.target.checked)} />,
    },
    {
      key: 'two_techs', label: '2 Techs?', align: 'center', defaultWidth: 54, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.two_techs} style={{ width: 16, height: 16, accentColor: '#117a65', cursor: 'pointer' }}
        onChange={e => save(o.id, { two_techs: e.target.checked })} />,
    },
    {
      key: 'note_wh', label: 'WH Notes', defaultWidth: 180, minWidth: 110,
      render: (o) => <input className="si" value={o.note_wh || ''} onChange={e => save(o.id, { note_wh: e.target.value })} placeholder="WH notes..." />,
    },
    {
      key: 'note_cxr', label: 'CXR Notes', defaultWidth: 180, minWidth: 110,
      render: (o) => <input className="si" value={o.note_cxr || ''} onChange={e => save(o.id, { note_cxr: e.target.value })} placeholder="CXR notes..." />,
    },
    {
      key: 'validity', label: 'Validity', defaultWidth: 120, minWidth: 90,
      render: (o) => (
        <select className="si-sel" value={o.validity || ''} onChange={e => save(o.id, { validity: e.target.value })}>
          <option value="">— select —</option>
          {o.validity && !validities.includes(o.validity) && <option value={o.validity}>{o.validity}</option>}
          {validities.map(v => <option key={v}>{v}</option>)}
        </select>
      ),
    },
    {
      key: 'closeout', label: 'Close', locked: true, defaultWidth: 44, minWidth: 40, align: 'center',
      render: (o) => <button className="closeout-x-btn" onClick={() => openCloseout?.(o.id)} title="Close out / Cancel">✕</button>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [presence, linkGroups, suppliers, validities, warrantyJobs]);

  return (
    <>
      {/* Owner Filter Bar */}
      <div className="owner-bar">
        {SVC_OWNERS_CONFIG.map(({ name, dot }) => {
          const count = svcOrders.filter((o: PEOrder) => o.status === 'open' && o.owner === name).length;
          const isActive = ownerFilter === name;
          // Tint the card with the same row color this team uses on the board.
          // Everything is driven by theme-aware vars so it reads in light AND dark:
          // bg = row tint, text = --row-text, dot/count = the row accent (--*-bar).
          const cls = rowClass({ owner: name, status: 'open', location: '' } as PEOrder);
          const tinted = cls !== 'row-unassigned';
          const accent = tinted ? `var(--${cls}-bar)` : dot;
          return (
            <div key={name} className={`owner-card${isActive ? ' active' : ''}`} onClick={() => setOwnerFilter(isActive ? '' : name)}
              style={tinted ? { background: `var(--${cls})`, color: 'var(--row-text)' } : undefined}>
              <div className="owner-card-dot" style={{ background: accent }} />
              <div>
                <div className="owner-card-name">{name}</div>
                <div className="owner-card-count" style={{ color: accent }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" type="text" placeholder="Search Any Column.." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <MultiSelectFilter
          label="Statuses"
          options={[
            { value: 'open', label: 'Open' },
            { value: 'completed', label: 'Scheduled' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          selected={statuses}
          onChange={setStatuses}
        />
        <MultiSelectFilter label="Types" options={SVC_SUBTYPES.map(s => ({ value: s, label: s }))} selected={typeFilterSet} onChange={setTypeFilterSet} />
        <MultiSelectFilter label="Parts/Repair" options={PARTS_REPAIR.map(s => ({ value: s, label: s }))} selected={prFilterSet} onChange={setPrFilterSet} />
        <MultiSelectFilter label="Locations" options={locations.map(l => ({ value: l, label: l }))} selected={locationFilterSet} onChange={setLocationFilterSet} />
        <span className="row-count" style={{ marginLeft: 'auto' }}>{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openWizard?.()}>
          + New Order
        </button>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openAudit?.()}>
          Audit Trail
        </button>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => setColsOpen(true)}>
          Columns
        </button>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ padding: '0 24px 12px' }}>
        {isLoading ? (
          <div className="empty"><div className="empty-icon">◎</div><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">◎</div><p>No service orders.</p></div>
        ) : (
          <PrefsTable<PEOrder>
            board="service"
            columns={columns}
            rows={sorted}
            rowKey={(o) => o.id}
            rowId={(o) => `svc-row-${o.id}`}
            rowClassName={(o) => rowClass(o)}
            rowStyle={(o) => {
              const s: React.CSSProperties = {};
              if (linkGroups.get(o.id)) s.boxShadow = 'inset 4px 0 0 #d48a0a';
              if (focusId === o.id) { s.outline = '2px solid var(--accent)'; s.outlineOffset = -2; }
              return Object.keys(s).length ? s : undefined;
            }}
            onRowFocus={(o) => setEditing('service', o.id)}
            onRowBlur={() => setEditing('service', null)}
            tableClassName="st-table"
            containerClassName="svc-container"
            scrollRef={scrollRef}
            sort={{ col: sortCol, dir: sortDir, onToggle: toggleSort }}
            managerOpen={colsOpen}
            onManagerClose={() => setColsOpen(false)}
            defaultFrozen={3}
          />
        )}
      </div>
    </>
  );
}
