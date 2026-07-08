'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Deal, TriageStatus } from '@/lib/deals';

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function DealsTable({ deals, tab }: { deals: Deal[]; tab: TriageStatus }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: number) {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSel((p) => (p.size === deals.length ? new Set() : new Set(deals.map((d) => d.st_project_id))));
  }

  async function triage(projectIds: number[], status: TriageStatus) {
    if (!projectIds.length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds, status }),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || 'Failed'); return; }
      setSel(new Set());
      router.refresh();
    } finally { setBusy(false); }
  }

  function applyAllSuggestions() {
    const toInstall = deals.filter((d) => d.suggested_class === 'install').map((d) => d.st_project_id);
    const toArchive = deals.filter((d) => d.suggested_class !== 'install').map((d) => d.st_project_id);
    if (!confirm(`Apply suggestions to all ${deals.length}? → ${toInstall.length} to Install, ${toArchive.length} to Archived.`)) return;
    (async () => {
      setBusy(true);
      try {
        if (toInstall.length) await fetch('/api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds: toInstall, status: 'install' }) });
        if (toArchive.length) await fetch('/api/deals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectIds: toArchive, status: 'archived' }) });
        setSel(new Set());
        router.refresh();
      } finally { setBusy(false); }
    })();
  }

  const selIds = Array.from(sel);

  return (
    <>
      <div className="triage-bar">
        {tab === 'untriaged' && (
          <button className="mini-btn" disabled={busy || !deals.length} onClick={applyAllSuggestions}>
            ✨ Apply all suggestions ({deals.length})
          </button>
        )}
        {sel.size > 0 && (
          <>
            <span className="triage-selcount">{sel.size} selected</span>
            {tab !== 'install' && <button className="mini-btn" disabled={busy} onClick={() => triage(selIds, 'install')}>→ Install</button>}
            {tab !== 'archived' && <button className="mini-btn ghost" disabled={busy} onClick={() => triage(selIds, 'archived')}>Archive</button>}
            {tab !== 'untriaged' && <button className="mini-btn ghost" disabled={busy} onClick={() => triage(selIds, 'untriaged')}>↩ Triage</button>}
          </>
        )}
      </div>

      <div className="table-card jobs-scroll">
        <table className="ar-table">
          <thead>
            <tr>
              <th className="chkcol"><input type="checkbox" checked={sel.size === deals.length && deals.length > 0} onChange={toggleAll} /></th>
              <th>Customer</th>
              <th>Sold</th>
              <th className="num">Systems</th>
              <th className="num">Contract</th>
              <th>Business unit</th>
              <th>{tab === 'untriaged' ? 'Suggestion' : 'Install job'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.st_project_id} className={sel.has(d.st_project_id) ? 'row-sel' : ''}>
                <td className="chkcol"><input type="checkbox" checked={sel.has(d.st_project_id)} onChange={() => toggle(d.st_project_id)} /></td>
                <td className="cust"><Link className="joblink" href={`/deals/${d.st_project_id}`}>{d.customer_name || `Project ${d.st_project_id}`}</Link></td>
                <td className="muted">{d.sold_on || '—'}</td>
                <td className="num">{d.equipment_unit_count ?? 0}</td>
                <td className="num">{usd(d.contract_total)}</td>
                <td className="muted">{d.primary_business_unit || '—'}</td>
                <td>
                  {tab === 'untriaged' ? (
                    <span className={`badge ${d.suggested_class === 'install' ? 'badge-stage' : 'badge-other'}`} title={d.suggestion_reason || ''}>
                      {d.suggested_class === 'install' ? 'Install' : 'Other'}
                    </span>
                  ) : d.install_job_number ? (
                    <a className="joblink" href={`https://go.servicetitan.com/#/Job/Index/${d.install_job_number}`} target="_blank" rel="noopener noreferrer">#{d.install_job_number} ↗</a>
                  ) : <span className="muted">—</span>}
                </td>
                <td className="actioncol">
                  {tab !== 'install' && <button className="icon-btn sm" title="Dispatch to Install" disabled={busy} onClick={() => triage([d.st_project_id], 'install')}>→</button>}
                  {tab !== 'archived' && <button className="icon-btn sm danger" title="Archive" disabled={busy} onClick={() => triage([d.st_project_id], 'archived')}>🗑</button>}
                  {tab !== 'untriaged' && <button className="icon-btn sm" title="Back to triage" disabled={busy} onClick={() => triage([d.st_project_id], 'untriaged')}>↩</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deals.length === 0 && <p className="grid-empty">Nothing here.</p>}
      </div>
    </>
  );
}
