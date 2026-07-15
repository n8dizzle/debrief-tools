'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import PresenceBadge from '@/components/PresenceBadge';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import PrefsTable, { type PrefsColumn } from '@/components/PrefsTable';
import { useFillViewportHeight } from '@/hooks/useFillViewportHeight';
import { rowClass, daysSince, ageColor, fmtMoney, looksLikeCurrency, compareValues } from '@/lib/pe-utils';
import { INST_OWNERS_CONFIG } from '@/lib/constants';
import type { PEOrder } from '@/types';

const INSTALL_TECHS = ['Luke', 'Brett', 'Christina', 'John', 'Daniel', 'Other'];
const INSTALL_OWNERS = ['Install Manager', 'Parts Coordinator', 'Warehouse', 'Install Dispatcher', 'Christina'];
const INSTALL_LOCS = ['Place Order', 'Shipping to Shop', 'Lewisville Shop', 'Backordered', 'P/U Supply House', 'Waiting for Customer', 'Cancel PO', 'Shipping to Supplier'];

function fmtMD(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('-').map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return '—';
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export default function InstallPage() {
  const ctx = useOrders() as OrdersContextValue;
  const { orders, saveOrderDebounced, openEditDetail, openCloseout, openWizard, isLoading, installTeams, suppliers, presence, setEditing } = ctx;

  // Clear my presence when leaving this board (route change removes the focused
  // input without firing blur, so onBlur alone would leave my avatar stuck here).
  useEffect(() => () => setEditing('install', null), [setEditing]);

  // Pin the table's scroll box to fill the viewport so its horizontal scrollbar
  // stays in view (no scrolling past every row to reach it).
  const scrollRef = useRef<HTMLDivElement>(null);
  useFillViewportHeight(scrollRef, [isLoading]);

  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');  // driven by the owner cards
  // Multi-select filters (empty = show all). Status defaults to Open.
  const [statuses, setStatuses] = useState<Set<string>>(() => new Set(['open']));
  const [warFilterSet, setWarFilterSet] = useState<Set<string>>(new Set());
  const [locationFilterSet, setLocationFilterSet] = useState<Set<string>>(new Set());
  // Stat-card quick filters: an extra open-orders bucket + which card is highlighted.
  const [bucket, setBucket] = useState<'all' | 'Backordered' | 'scheduled' | 'aging'>('all');
  const [activeCard, setActiveCard] = useState<string>('all');
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
      document.getElementById(`inst-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    const clear = setTimeout(() => setFocusId(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, []);

  function save(id: number, changes: Partial<PEOrder>) {
    saveOrderDebounced(id, changes);
  }

  function onLocationChange(id: number, loc: string) {
    // Location and owner are independent — changing location no longer reassigns owner.
    save(id, { location: loc });
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
      if (statuses.size > 0 && !statuses.has(o.status)) return false;
      if (bucket === 'Backordered' && o.location !== 'Backordered') return false;
      if (bucket === 'scheduled' && !(o.sched_date || o.scheduled_date)) return false;
      if (bucket === 'aging' && daysSince(o.date) <= 30) return false;
      if (teamFilter && o.install_team !== teamFilter) return false;
      if (ownerFilter && o.owner !== ownerFilter) return false;
      if (warFilterSet.size > 0 && !warFilterSet.has(o.warranty || '')) return false;
      if (locationFilterSet.size > 0 && !locationFilterSet.has(o.location || '')) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        // Global search across every user-facing column.
        const hay = [
          o.job, o.tech, o.customer, o.owner, o.part, o.supplier, o.install_team,
          o.job_cost, o.equip_cost, o.order_num, o.location, o.warranty, o.eta,
          o.bo_status, o.equip_avail, o.status === 'completed' ? 'booked' : o.status,
          fmtMD(o.date), o.date, fmtMD(o.sched_date), o.sched_date, fmtMD(o.qc_date), o.qc_date,
          o.note_wh, o.note_cxr,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [instOrders, search, teamFilter, statuses, bucket, ownerFilter, warFilterSet, locationFilterSet]);

  // Auto-link: open estimates sharing an originating job number must be booked together.
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
    const key = sortCol;
    return [...filtered].sort((a, b) => compareValues((a as unknown as Record<string, unknown>)[key], (b as unknown as Record<string, unknown>)[key]) * sortDir);
  }, [filtered, sortCol, sortDir]);

  // Stat card click → preset the Status filter + open-bucket, and highlight the card.
  function setActiveStatCard(key: string) {
    setActiveCard(key);
    if (key === 'completed') { setStatuses(new Set(['completed'])); setBucket('all'); }
    else { setStatuses(new Set(['open'])); setBucket(key === 'all' ? 'all' : (key as 'Backordered' | 'scheduled' | 'aging')); }
  }

  // ── Column config (order = default order; users reorder/resize/hide/freeze) ──
  const columns = useMemo<PrefsColumn<PEOrder>[]>(() => [
    {
      key: 'edit', label: 'Edit', locked: true, defaultWidth: 46, minWidth: 46, align: 'center',
      render: (o) => (
        <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
          <button className="detail-open-btn" style={{ background: '#7a1c2e' }} onClick={() => openEditDetail?.(o.id)} title="Edit details">✎</button>
          <PresenceBadge peers={presence.filter(p => p.board === 'install' && p.rowId === o.id)} />
        </span>
      ),
    },
    {
      key: 'date', label: 'Date', sortKey: 'date', defaultWidth: 66, minWidth: 50,
      render: (o) => <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: ageColor(daysSince(o.date)) }}>{fmtMD(o.date)}</span>,
    },
    {
      key: 'job', label: 'Job #', defaultWidth: 150, minWidth: 90,
      render: (o) => {
        const link = linkGroups.get(o.id);
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
          </span>
        );
      },
    },
    {
      key: 'customer', label: 'Customer', sortKey: 'customer', defaultWidth: 150, minWidth: 90,
      render: (o) => <input className="si" value={o.customer || ''} onChange={e => save(o.id, { customer: e.target.value })} />,
    },
    {
      key: 'tech', label: 'Sold By', defaultWidth: 110, minWidth: 80,
      render: (o) => (
        <select className="si-sel" value={o.tech || ''} onChange={e => save(o.id, { tech: e.target.value })}>
          <option value="">— tech —</option>
          {o.tech && !INSTALL_TECHS.includes(o.tech) && <option value={o.tech}>{o.tech}</option>}
          {INSTALL_TECHS.map(t => <option key={t}>{t}</option>)}
        </select>
      ),
    },
    {
      key: 'job_cost', label: 'Job Cost', defaultWidth: 100, minWidth: 70,
      render: (o) => <input className="si" value={o.job_cost || ''} onChange={e => save(o.id, { job_cost: e.target.value })} onBlur={e => save(o.id, { job_cost: fmtMoney(e.target.value) })} placeholder="$0.00" />,
    },
    {
      key: 'owner', label: 'Owner', defaultWidth: 150, minWidth: 100,
      render: (o) => (
        <select className="si-sel" value={o.owner || ''} onChange={e => save(o.id, { owner: e.target.value })}>
          <option value="">— owner —</option>
          {INSTALL_OWNERS.map(owner => <option key={owner}>{owner}</option>)}
        </select>
      ),
    },
    {
      key: 'warranty', label: 'War?', align: 'center', defaultWidth: 60, minWidth: 50,
      render: (o) => (
        <select className="si-sel" value={o.warranty || ''} onChange={e => save(o.id, { warranty: e.target.value })}>
          <option value="">—</option>
          <option>Yes</option><option>No</option><option>E/L</option><option>E</option>
        </select>
      ),
    },
    {
      key: 'part', label: 'Equipment to Order', defaultWidth: 170, minWidth: 110,
      render: (o) => <input className="si" value={o.part || ''} onChange={e => save(o.id, { part: e.target.value })} title={o.part || ''} placeholder="Equipment..." />,
    },
    {
      key: 'equip_avail', label: 'Avail?', align: 'center', defaultWidth: 60, minWidth: 50,
      render: (o) => (
        <select className="si-sel" value={o.equip_avail || ''} onChange={e => save(o.id, { equip_avail: e.target.value })}>
          <option value="">—</option><option>Yes</option><option>No</option>
        </select>
      ),
    },
    {
      key: 'bo_status', label: 'B/O?', align: 'center', defaultWidth: 60, minWidth: 50,
      render: (o) => (
        <select className="si-sel" value={o.bo_status || ''} onChange={e => onBOStatusChange(o.id, e.target.value)}>
          <option value="">—</option><option>Yes</option><option>No</option>
        </select>
      ),
    },
    {
      key: 'eta', label: 'ETA', defaultWidth: 140, minWidth: 110,
      render: (o) => <input className="si" type="date" value={o.eta || ''} onChange={e => save(o.id, { eta: e.target.value })} />,
    },
    {
      key: 'bo_informed', label: 'Cust. Inf. B/O', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.bo_informed} style={{ width: 16, height: 16, accentColor: '#2980b9', cursor: 'pointer' }} onChange={e => onBOInformedChange(o.id, e.target.checked)} />,
    },
    {
      key: 'bo_ordered', label: 'Parts Ordered', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.bo_ordered} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }} onChange={e => save(o.id, { bo_ordered: e.target.checked })} />,
    },
    {
      key: 'supplier', label: 'Ordered From', defaultWidth: 160, minWidth: 100,
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
      render: (o) => <input className="si" value={o.order_num || ''} onChange={e => save(o.id, { order_num: e.target.value })} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} />,
    },
    {
      key: 'equip_cost', label: 'Equip. Cost', defaultWidth: 100, minWidth: 70,
      render: (o) => <input className="si" value={o.equip_cost || ''} onChange={e => save(o.id, { equip_cost: e.target.value })} onBlur={e => save(o.id, { equip_cost: fmtMoney(e.target.value) })} placeholder="$0.00" />,
    },
    {
      key: 'location', label: 'Location', defaultWidth: 150, minWidth: 110,
      render: (o) => (
        <select className="si-sel" value={o.location || ''} onChange={e => onLocationChange(o.id, e.target.value)}>
          <option value="">— select —</option>
          {INSTALL_LOCS.map(l => <option key={l}>{l}</option>)}
        </select>
      ),
    },
    {
      key: 'install_team', label: 'Install Team', defaultWidth: 110, minWidth: 90,
      render: (o) => (
        <select className="si-sel" value={o.install_team || ''} onChange={e => save(o.id, { install_team: e.target.value })}>
          <option value="">— select —</option>
          {o.install_team && !installTeams.includes(o.install_team) && !looksLikeCurrency(o.install_team) && <option value={o.install_team}>{o.install_team}</option>}
          {installTeams.map(t => <option key={t}>{t}</option>)}
        </select>
      ),
    },
    {
      key: 'sched_date', label: 'Date Sched.', defaultWidth: 140, minWidth: 110,
      render: (o) => <input className="si" type="date" value={o.sched_date || o.scheduled_date || ''} onChange={e => save(o.id, { sched_date: e.target.value })} />,
    },
    {
      key: 'call_booked', label: 'Call Booked?', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.call_booked} style={{ width: 16, height: 16, accentColor: '#d4ac0d', cursor: 'pointer' }} onChange={e => onCallBookedChange(o.id, e.target.checked)} />,
    },
    {
      key: 'qc_scheduled', label: 'QC Scheduled?', align: 'center', defaultWidth: 60, minWidth: 46,
      render: (o) => <input type="checkbox" checked={!!o.qc_scheduled} style={{ width: 16, height: 16, accentColor: '#3a6b4a', cursor: 'pointer' }} onChange={e => save(o.id, { qc_scheduled: e.target.checked })} />,
    },
    {
      key: 'qc_date', label: 'QC Date', defaultWidth: 140, minWidth: 110,
      render: (o) => <input className="si" type="date" value={o.qc_date || ''} onChange={e => save(o.id, { qc_date: e.target.value })} />,
    },
    {
      key: 'notes', label: 'Notes', defaultWidth: 180, minWidth: 110,
      render: (o) => <input className="si" value={[o.note_wh, o.note_cxr].filter(Boolean).join(' | ') || ''} onChange={e => save(o.id, { note_wh: e.target.value })} placeholder="Notes..." />,
    },
    {
      key: 'closeout', label: 'Close', locked: true, defaultWidth: 44, minWidth: 40, align: 'center',
      render: (o) => <button className="closeout-x-btn" onClick={() => openCloseout?.(o.id)} title="Close out / Cancel">✕</button>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [presence, linkGroups, suppliers, installTeams]);

  return (
    <>
      {/* Stat Cards */}
      <div className="stat-bar" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { key: 'all', label: 'All Open', count: stats.all, color: 'col-accent', status: 'open' as const },
          { key: 'Backordered', label: 'Backordered', count: stats.bo, color: 'col-red', status: 'open' as const },
          { key: 'scheduled', label: 'Scheduled', count: stats.scheduled, color: 'col-green', status: 'open' as const },
          { key: 'aging', label: 'Over 30 Days', count: stats.aging, color: 'col-red', status: 'open' as const },
          { key: 'completed', label: 'Booked', count: stats.done, color: 'col-green', status: 'completed' as const },
        ].map(s => (
          <div key={s.key} className={`stat${activeCard === s.key ? ' active' : ''}`}
            onClick={() => setActiveStatCard(s.key)}>
            <div className={`stat-num ${s.color}`}>{s.count}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Owner filter cards (tinted with each team's row color, theme-aware) */}
      <div className="owner-bar owner-bar-sm">
        {INST_OWNERS_CONFIG.map(({ name }) => {
          const count = instOpen.filter((o: PEOrder) => o.owner === name).length;
          const isActive = ownerFilter === name;
          const cls = rowClass({ owner: name, status: 'open', location: '' } as PEOrder);
          const tinted = cls !== 'row-unassigned';
          const accent = tinted ? `var(--${cls}-bar)` : 'var(--accent)';
          return (
            <div key={name} className={`owner-card sm${isActive ? ' active' : ''}`} onClick={() => setOwnerFilter(isActive ? '' : name)}
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
            { value: 'completed', label: 'Booked' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          selected={statuses}
          onChange={(n) => { setStatuses(n); setActiveCard(''); setBucket('all'); }}
        />
        <MultiSelectFilter label="War?" options={['Yes', 'No', 'E/L', 'E'].map(w => ({ value: w, label: w }))} selected={warFilterSet} onChange={setWarFilterSet} />
        <MultiSelectFilter label="Locations" options={INSTALL_LOCS.map(l => ({ value: l, label: l }))} selected={locationFilterSet} onChange={setLocationFilterSet} />
        <select className="filter" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <option value="">All Install Teams</option>
          {installTeams.map(t => <option key={t}>{t}</option>)}
        </select>
        <span className="row-count" style={{ marginLeft: 'auto' }}>{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openWizard?.()}>
          + New Order
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
          <div className="empty"><div className="empty-icon">◎</div><p>No install orders.</p></div>
        ) : (
          <PrefsTable<PEOrder>
            board="install"
            columns={columns}
            rows={sorted}
            rowKey={(o) => o.id}
            rowId={(o) => `inst-row-${o.id}`}
            rowClassName={(o) => rowClass(o)}
            rowStyle={(o) => {
              const s: React.CSSProperties = {};
              if (linkGroups.get(o.id)) s.boxShadow = 'inset 4px 0 0 #d48a0a';
              if (focusId === o.id) { s.outline = '2px solid var(--accent)'; s.outlineOffset = -2; }
              return Object.keys(s).length ? s : undefined;
            }}
            onRowFocus={(o) => setEditing('install', o.id)}
            onRowBlur={() => setEditing('install', null)}
            tableClassName="st-table"
            containerClassName="inst-container"
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
