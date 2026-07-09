'use client';

import { useState } from 'react';
import type { JobStage, ProjectEstimate } from '@/lib/jobs';

const SOURCE_LABEL: Record<string, string> = {
  st: 'ServiceTitan',
  partial: 'ServiceTitan + ap-payments',
  manual: 'Manual — ST is blind',
};

function dotSymbol(status: JobStage['status']) {
  if (status === 'done') return '✓';
  if (status === 'gap') return '?';
  return '●';
}

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function EstimatesBlock({ estimates }: { estimates: ProjectEstimate[] }) {
  if (!estimates.length) return <div className="jp-note">No estimates synced for this project yet.</div>;
  const sold = estimates.filter((e) => e.status === 'Sold');
  const sys = sold.reduce((s, e) => s + (e.systems ?? 0), 0);
  const comp = sold.reduce((s, e) => s + (e.components ?? 0), 0);
  return (
    <div className="ests">
      <div className="ests-summary">
        {sold.length} sold estimate{sold.length === 1 ? '' : 's'} · {sys} system{sys === 1 ? '' : 's'} · {comp} component{comp === 1 ? '' : 's'}
        {estimates.length > sold.length && ` · ${estimates.length - sold.length} other`}
      </div>
      {estimates.map((e) => {
        const equip = (e.items || []).filter((i) => i.type.toLowerCase() === 'equipment');
        return (
          <div className="est-row" key={e.estimate_id}>
            <div className="est-head">
              <span className={`est-badge ${e.status === 'Sold' ? 'sold' : 'other'}`}>{e.status || '—'}</span>
              <span className="est-name">{e.name || `Estimate #${e.estimate_id}`}</span>
              <span className="est-amt">{usd(e.subtotal)}</span>
              {e.estimate_job_number && (
                <a className="est-link" href={`https://go.servicetitan.com/#/Job/Index/${e.estimate_job_number}`} target="_blank" rel="noopener noreferrer">↗</a>
              )}
            </div>
            {equip.length > 0 && (
              <ul className="est-equip">
                {equip.map((i, j) => <li key={j}>{i.qty > 1 ? `${i.qty}× ` : ''}{i.name}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function JobPipeline({ stages, estimates = [] }: { stages: JobStage[]; estimates?: ProjectEstimate[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="jp-flow">
      {stages.map((s, i) => {
        const expandable = s.details.length > 0 || !!s.note;
        const isOpen = open.has(i);
        return (
          <div className="jp-step" key={`${s.name}-${i}`}>
            <div className={`jp-dot ${s.status}`}>{dotSymbol(s.status)}</div>
            <div className={`jp-card ${s.source === 'manual' ? 'gapcard' : ''}`}>
              <button
                className="jp-headrow"
                onClick={() => expandable && toggle(i)}
                aria-expanded={expandable ? isOpen : undefined}
                disabled={!expandable}
              >
                <span className="jp-head">
                  <span className="jp-name">{s.name}</span>
                  <span className={`src ${s.source}`}>{SOURCE_LABEL[s.source]}</span>
                </span>
                {expandable && <span className={`jp-chev ${isOpen ? 'open' : ''}`}>›</span>}
              </button>

              {s.value && <div className="jp-val">{s.value}</div>}

              {isOpen && (
                <div className="jp-expand">
                  {s.details.map((d, j) => (
                    <div className="jp-drow" key={j}>
                      <span className="jp-dlabel">{d.label}</span>
                      <span className="jp-dval">
                        {d.href ? (
                          <a href={d.href} target="_blank" rel="noopener noreferrer">{d.value}</a>
                        ) : d.value}
                      </span>
                    </div>
                  ))}
                  {s.name.toLowerCase().includes('sold') && <EstimatesBlock estimates={estimates} />}
                  {s.note && <div className="jp-note">{s.note}</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
