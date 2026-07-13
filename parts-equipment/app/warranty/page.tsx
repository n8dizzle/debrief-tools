'use client';
import { useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { OrdersContextValue } from '@/hooks/useOrders';
import type { PEWarrantyClaim } from '@/types';
import { formatLocalDate } from '@/lib/pe-utils';

export default function WarrantyPage() {
  const ctx = useOrders() as OrdersContextValue;
  const { warrantyOrders, setWarrantyOrders, showToast, isLoading } = ctx;

  function save(id: number, field: keyof PEWarrantyClaim, value: string) {
    setWarrantyOrders((prev: PEWarrantyClaim[]) =>
      prev.map(w => w.id === id ? { ...w, [field]: value } : w)
    );
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
    setWarrantyOrders((prev: PEWarrantyClaim[]) => prev.filter((w: PEWarrantyClaim) => w.id !== id));
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
      .then(({ claim }) => {
        if (claim) setWarrantyOrders((prev: PEWarrantyClaim[]) => [claim, ...prev]);
      })
      .catch(() => {
        const tempW = { ...newW, id: Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as unknown as PEWarrantyClaim;
        setWarrantyOrders((prev: PEWarrantyClaim[]) => [tempW, ...prev]);
      });
  }

  const active = useMemo(() => (warrantyOrders as PEWarrantyClaim[]).filter(w => w.paid !== 'Yes'), [warrantyOrders]);
  const completed = useMemo(() => (warrantyOrders as PEWarrantyClaim[]).filter(w => w.paid === 'Yes'), [warrantyOrders]);

  const totCharged = useMemo(() => active.reduce((s, w) => s + (parseFloat(w.amt_charged ?? '') || 0), 0), [active]);
  const totRefunded = useMemo(() => active.reduce((s, w) => s + (parseFloat(w.amt_refunded ?? '') || 0), 0), [active]);

  function inp(w: PEWarrantyClaim, field: keyof PEWarrantyClaim, type = 'text') {
    return (
      <input
        className="wt-input"
        type={type}
        value={(w[field] as string) || ''}
        onChange={e => save(w.id, field, e.target.value)}
        style={{ minWidth: type === 'date' ? 110 : 75 }}
      />
    );
  }

  function ynSel(w: PEWarrantyClaim, field: keyof PEWarrantyClaim) {
    const val = (w[field] as string) || '';
    const cls = val === 'Yes' ? 'wt-yn yn-yes' : val === 'No' ? 'wt-yn yn-no' : 'wt-yn';
    return (
      <select className={cls} value={val} onChange={e => save(w.id, field, e.target.value)}>
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  function renderTable(rows: PEWarrantyClaim[], isCompleted: boolean) {
    if (!rows.length) {
      return (
        <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>
          {isCompleted ? 'No completed claims yet.' : 'No active warranty claims yet. Click + Add Claim to begin.'}
        </div>
      );
    }
    return (
      <table className={`wt-table${isCompleted ? ' wt-completed' : ''}`}>
        <thead>
          <tr>
            <th style={{ minWidth: 110 }}>Ticket #</th>
            <th style={{ minWidth: 130 }}>Full Name</th>
            <th style={{ minWidth: 90 }}>MFGR</th>
            <th style={{ minWidth: 110 }}>Fail Date</th>
            <th style={{ minWidth: 110 }}>Repair Date</th>
            <th style={{ minWidth: 115 }}>Main Unit MN</th>
            <th style={{ minWidth: 115 }}>Main Unit SN</th>
            <th style={{ minWidth: 115 }}>Failed Part PN</th>
            <th style={{ minWidth: 115 }}>Failed Part SN</th>
            <th style={{ minWidth: 125 }}>Mfg Invoice #</th>
            <th style={{ minWidth: 115 }}>Repl. Part PN</th>
            <th style={{ minWidth: 115 }}>Repl. Part SN</th>
            <th style={{ minWidth: 110 }}>Date of Claim</th>
            <th style={{ minWidth: 105 }}>Claim #</th>
            <th style={{ minWidth: 85 }}>Credit Approved?</th>
            <th style={{ minWidth: 85 }}>Return Required?</th>
            <th style={{ minWidth: 95 }}>Amt Charged</th>
            <th style={{ minWidth: 95 }}>Amt Refunded</th>
            <th style={{ minWidth: 75 }}>PAID?</th>
            <th style={{ width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(w => (
            <tr key={w.id}>
              <td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input className="wt-input" value={w.job || ''} onChange={e => save(w.id, 'job', e.target.value)} style={{ minWidth: 80 }} />
                  {w.job && (
                    <a href={`https://go.servicetitan.com/#/Job/Index/${w.job}`} target="_blank" rel="noopener noreferrer"
                      title="Open job in ServiceTitan" onClick={e => e.stopPropagation()}
                      style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>↗</a>
                  )}
                </span>
              </td>
              <td>{inp(w, 'customer')}</td>
              <td>{inp(w, 'mfgr')}</td>
              <td>{inp(w, 'fail_date', 'date')}</td>
              <td>{inp(w, 'repair_date', 'date')}</td>
              <td>{inp(w, 'main_model_num')}</td>
              <td>{inp(w, 'main_unit_sn')}</td>
              <td>{inp(w, 'failed_part_num')}</td>
              <td>{inp(w, 'failed_part_serial')}</td>
              <td>{inp(w, 'mfg_invoice_num')}</td>
              <td>{inp(w, 'repl_part_num')}</td>
              <td>{inp(w, 'repl_part_serial')}</td>
              <td>{inp(w, 'date_of_claim', 'date')}</td>
              <td>{inp(w, 'claim_num')}</td>
              <td>{ynSel(w, 'credit_approved')}</td>
              <td>{ynSel(w, 'return_required')}</td>
              <td>
                <input className="wt-input" type="text" value={w.amt_charged || ''} onChange={e => save(w.id, 'amt_charged', e.target.value)} placeholder="$0.00" style={{ minWidth: 75 }} />
              </td>
              <td>
                <input className="wt-input" type="text" value={w.amt_refunded || ''} onChange={e => save(w.id, 'amt_refunded', e.target.value)} placeholder="$0.00" style={{ minWidth: 75 }} />
              </td>
              <td>
                <select className={w.paid === 'Yes' ? 'wt-yn yn-yes' : 'wt-yn'} value={w.paid || ''} onChange={e => markPaid(w.id, e.target.value)}>
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
              <td>
                <button onClick={() => deleteRow(w.id)} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer', fontFamily: 'Roboto, sans-serif' }}>✕</button>
              </td>
            </tr>
          ))}
          {!isCompleted && (
            <tr className="wt-totals-row">
              <td colSpan={16} style={{ textAlign: 'right', paddingRight: 12, fontWeight: 700 }}>TOTALS</td>
              <td>${totCharged.toFixed(2)}</td>
              <td style={{ color: '#1a7a4a' }}>${totRefunded.toFixed(2)}</td>
              <td colSpan={2}></td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }

  if (isLoading) {
    return <div className="empty"><div className="empty-icon">◎</div><p>Loading...</p></div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '14px 24px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Active Warranty Claims</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Charged: <strong>${totCharged.toFixed(2)}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;
            Refunded: <strong style={{ color: '#1a7a4a' }}>${totRefunded.toFixed(2)}</strong>
          </div>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 13, padding: '7px 16px' }} onClick={addRow}>
          + Add Claim
        </button>
      </div>

      {/* Active table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(50vh - 60px)', padding: '0 24px 4px' }}>
        {renderTable(active, false)}
      </div>

      {/* Completed section */}
      <div style={{ padding: '12px 24px 8px', marginTop: 8, borderTop: '2px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Completed Warranty Claims</div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(40vh - 60px)' }}>
          {renderTable(completed, true)}
        </div>
      </div>
    </div>
  );
}
