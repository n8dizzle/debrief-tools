'use client';
import { useMemo, useEffect, useRef, useState } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import type { PEWarrantyClaim } from '@/types';
import { formatLocalDate, compareValues, parseMoney, fmtMoney, daysSince, warrantyAgeColor } from '@/lib/pe-utils';
import PresenceBadge from '@/components/PresenceBadge';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import PrefsTable, { type PrefsColumn } from '@/components/PrefsTable';
import { useFillViewportHeight } from '@/hooks/useFillViewportHeight';

// How long a claim has been open: days from Date of Claim until today. The clock
// stops once the claim is paid (nothing left to chase), and is blank if there's no
// Date of Claim to measure from. Returns null when there's no age to show.
function ageDays(w: PEWarrantyClaim): number | null {
  if (w.paid === 'Yes' || !w.date_of_claim) return null;
  return daysSince(w.date_of_claim);
}

export default function WarrantyPage() {
  const ctx = useOrders() as OrdersContextValue;
  const { warrantyOrders, setWarrantyOrders, showToast, isLoading, presence, setEditing, openAudit } = ctx;

  // Clear my presence when leaving this board.
  useEffect(() => () => setEditing('warranty', null), [setEditing]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useFillViewportHeight(scrollRef, [isLoading]);

  const [search, setSearch] = useState('');
  // Active = not yet paid; Completed = paid. Default: Active. Empty = show all.
  const [statuses, setStatuses] = useState<Set<string>>(() => new Set(['active']));
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [colsOpen, setColsOpen] = useState(false);
  // Aging = unpaid claims open past the red threshold (>60 days since Date of Claim).
  const [agingOnly, setAgingOnly] = useState(false);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(1); }
  }

  function save(id: number, field: keyof PEWarrantyClaim, value: string) {
    setWarrantyOrders((prev: PEWarrantyClaim[]) => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    fetch(`/api/warranty/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    }).catch(() => {});
  }

  function markPaid(id: number, val: string) {
    save(id, 'paid', val);
    if (val === 'Yes') showToast('Warranty claim marked as paid');
  }

  function deleteRow(id: number) {
    const w = warrantyOrders.find((c: PEWarrantyClaim) => c.id === id);
    const label = w?.claim_num || w?.customer || (w?.job ? `Ticket ${w.job}` : '');
    const msg = label
      ? `Delete warranty claim ${label}? This can't be undone.`
      : `Delete this warranty claim? This can't be undone.`;
    if (!confirm(msg)) return;
    setWarrantyOrders((prev: PEWarrantyClaim[]) => prev.filter((c: PEWarrantyClaim) => c.id !== id));
    fetch(`/api/warranty/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  function addRow() {
    const today = formatLocalDate(new Date());
    const newW = {
      last_name: '', mfgr: '', fail_date: null, repair_date: null,
      main_model_num: '', main_unit_sn: '', failed_part_num: '', failed_part_serial: '',
      mfg_invoice_num: '', repl_part_num: '', repl_part_serial: '',
      date_of_claim: today, claim_num: '',
      credit_approved: '', return_required: '', amt_charged: '', amt_refunded: '', paid: '',
      job: '', tech: '', customer: '', status: 'active',
    };
    fetch('/api/warranty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newW),
    })
      .then(r => r.json())
      .then(({ claim }) => { if (claim) setWarrantyOrders((prev: PEWarrantyClaim[]) => [claim, ...prev]); })
      .catch(() => {
        const tempW = { ...newW, id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as PEWarrantyClaim;
        setWarrantyOrders((prev: PEWarrantyClaim[]) => [tempW, ...prev]);
      });
  }

  const claims = warrantyOrders as PEWarrantyClaim[];

  const filtered = useMemo(() => {
    return claims.filter(w => {
      const bucket = w.paid === 'Yes' ? 'completed' : 'active';
      if (statuses.size > 0 && !statuses.has(bucket)) return false;
      if (agingOnly && (ageDays(w) ?? 0) <= 60) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          w.job, w.customer, w.mfgr, w.main_model_num, w.main_unit_sn,
          w.failed_part_num, w.failed_part_serial, w.mfg_invoice_num, w.repl_part_num, w.repl_part_serial,
          w.claim_num, w.credit_approved, w.return_required, w.amt_charged, w.amt_refunded, w.paid,
          w.fail_date, w.repair_date, w.date_of_claim,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [claims, statuses, search, agingOnly]);

  const agingCount = useMemo(() => claims.filter(w => (ageDays(w) ?? 0) > 60).length, [claims]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const key = sortCol;
    if (key === 'age') {
      // Age is computed, not a stored field. Sort numerically; claims with no age
      // (paid or undated) sink to the bottom regardless of direction.
      const v = (w: PEWarrantyClaim) => { const d = ageDays(w); return d == null ? -1 : d; };
      return [...filtered].sort((a, b) => (v(a) - v(b)) * sortDir);
    }
    return [...filtered].sort((a, b) => compareValues((a as unknown as Record<string, unknown>)[key], (b as unknown as Record<string, unknown>)[key]) * sortDir);
  }, [filtered, sortCol, sortDir]);

  const totCharged = useMemo(() => filtered.reduce((s, w) => s + parseMoney(w.amt_charged), 0), [filtered]);
  const totRefunded = useMemo(() => filtered.reduce((s, w) => s + parseMoney(w.amt_refunded), 0), [filtered]);

  // ── shared cell renderers ──
  const inp = (w: PEWarrantyClaim, field: keyof PEWarrantyClaim, type = 'text') => (
    <input className="wt-input" type={type} value={(w[field] as string) || ''} onChange={e => save(w.id, field, e.target.value)} />
  );
  const ynSel = (w: PEWarrantyClaim, field: keyof PEWarrantyClaim) => {
    const val = (w[field] as string) || '';
    const cls = val === 'Yes' ? 'wt-yn yn-yes' : val === 'No' ? 'wt-yn yn-no' : 'wt-yn';
    return (
      <select className={cls} value={val} onChange={e => save(w.id, field, e.target.value)}>
        <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
      </select>
    );
  };

  const columns = useMemo<PrefsColumn<PEWarrantyClaim>[]>(() => [
    {
      key: 'job', label: 'Ticket #', defaultWidth: 150, minWidth: 100,
      render: (w) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <input className="wt-input" value={w.job || ''} onChange={e => save(w.id, 'job', e.target.value)}
            size={Math.max((w.job || '').length, 3)} style={{ width: 'auto', flex: '0 0 auto' }} />
          <PresenceBadge peers={presence.filter(p => p.board === 'warranty' && p.rowId === w.id)} />
          {w.job && (
            <a href={`https://go.servicetitan.com/#/Job/Index/${w.job}`} target="_blank" rel="noopener noreferrer"
              title="Open job in ServiceTitan" onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text)', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </span>
      ),
    },
    { key: 'customer', label: 'Full Name', defaultWidth: 150, minWidth: 100, render: (w) => inp(w, 'customer') },
    { key: 'mfgr', label: 'MFGR', defaultWidth: 100, minWidth: 70, render: (w) => inp(w, 'mfgr') },
    { key: 'fail_date', label: 'Fail Date', defaultWidth: 130, minWidth: 110, render: (w) => inp(w, 'fail_date', 'date') },
    { key: 'repair_date', label: 'Repair Date', defaultWidth: 130, minWidth: 110, render: (w) => inp(w, 'repair_date', 'date') },
    { key: 'main_model_num', label: 'Main Unit MN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'main_model_num') },
    { key: 'main_unit_sn', label: 'Main Unit SN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'main_unit_sn') },
    { key: 'failed_part_num', label: 'Failed Part PN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'failed_part_num') },
    { key: 'failed_part_serial', label: 'Failed Part SN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'failed_part_serial') },
    { key: 'mfg_invoice_num', label: 'Mfg Invoice #', defaultWidth: 125, minWidth: 90, render: (w) => inp(w, 'mfg_invoice_num') },
    { key: 'repl_part_num', label: 'Repl. Part PN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'repl_part_num') },
    { key: 'repl_part_serial', label: 'Repl. Part SN', defaultWidth: 120, minWidth: 90, render: (w) => inp(w, 'repl_part_serial') },
    { key: 'date_of_claim', label: 'Date of Claim', defaultWidth: 130, minWidth: 110, render: (w) => inp(w, 'date_of_claim', 'date') },
    {
      key: 'age', label: 'Age', align: 'center', defaultWidth: 66, minWidth: 52,
      render: (w) => {
        const d = ageDays(w);
        return d == null
          ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
          : <span title={`${d} days since Date of Claim`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, color: warrantyAgeColor(d) }}>{d}d</span>;
      },
    },
    { key: 'claim_num', label: 'Claim #', defaultWidth: 110, minWidth: 80, render: (w) => inp(w, 'claim_num') },
    { key: 'credit_approved', label: 'Credit Approved?', align: 'center', defaultWidth: 90, minWidth: 70, render: (w) => ynSel(w, 'credit_approved') },
    { key: 'return_required', label: 'Return Required?', align: 'center', defaultWidth: 90, minWidth: 70, render: (w) => ynSel(w, 'return_required') },
    { key: 'amt_charged', label: 'Amt Charged', defaultWidth: 100, minWidth: 80, render: (w) => <input className="wt-input" value={w.amt_charged || ''} onChange={e => save(w.id, 'amt_charged', e.target.value)} placeholder="$0.00" /> },
    { key: 'amt_refunded', label: 'Amt Refunded', defaultWidth: 100, minWidth: 80, render: (w) => <input className="wt-input" value={w.amt_refunded || ''} onChange={e => save(w.id, 'amt_refunded', e.target.value)} placeholder="$0.00" /> },
    {
      key: 'paid', label: 'PAID?', align: 'center', defaultWidth: 80, minWidth: 60,
      render: (w) => (
        <select className={w.paid === 'Yes' ? 'wt-yn yn-yes' : 'wt-yn'} value={w.paid || ''} onChange={e => markPaid(w.id, e.target.value)}>
          <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
        </select>
      ),
    },
    {
      key: 'delete', label: 'Del', locked: true, align: 'center', defaultWidth: 44, minWidth: 40,
      render: (w) => <button className="closeout-x-btn" onClick={() => deleteRow(w.id)} title="Delete claim">✕</button>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [presence]);

  return (
    <>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" type="text" placeholder="Search Any Column.." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <MultiSelectFilter
          label="Statuses"
          options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }]}
          selected={statuses}
          onChange={setStatuses}
        />
        <button
          className="btn"
          onClick={() => setAgingOnly(v => !v)}
          title="Show only unpaid claims open more than 60 days"
          style={{
            fontSize: 12,
            padding: '5px 12px',
            borderColor: agingOnly ? '#c0392b' : undefined,
            background: agingOnly ? 'rgba(192,57,43,0.12)' : undefined,
            color: agingOnly ? '#c0392b' : 'var(--muted)',
            fontWeight: agingOnly ? 700 : undefined,
          }}
        >
          Aging{agingCount ? ` (${agingCount})` : ''}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          Charged <strong style={{ color: 'var(--text)' }}>{fmtMoney(String(totCharged))}</strong>
          &nbsp;·&nbsp; Refunded <strong style={{ color: 'var(--green)' }}>{fmtMoney(String(totRefunded))}</strong>
        </span>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={addRow}>+ Add Claim</button>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => openAudit?.()}>Audit Trail</button>
        <button className="btn" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--muted)' }} onClick={() => setColsOpen(true)}>Columns</button>
        <span className="row-count">{filtered.length} claim{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ padding: '0 24px 12px' }}>
        {isLoading ? (
          <div className="empty"><div className="empty-icon">◎</div><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">◎</div><p>No warranty claims. Click + Add Claim to begin.</p></div>
        ) : (
          <PrefsTable<PEWarrantyClaim>
            board="warranty"
            columns={columns}
            rows={sorted}
            rowKey={(w) => w.id}
            rowId={(w) => `wt-row-${w.id}`}
            onRowFocus={(w) => setEditing('warranty', w.id)}
            onRowBlur={() => setEditing('warranty', null)}
            tableClassName="wt-table"
            containerClassName="svc-container"
            scrollRef={scrollRef}
            sort={{ col: sortCol, dir: sortDir, onToggle: toggleSort }}
            managerOpen={colsOpen}
            onManagerClose={() => setColsOpen(false)}
            defaultFrozen={2}
          />
        )}
      </div>
    </>
  );
}
