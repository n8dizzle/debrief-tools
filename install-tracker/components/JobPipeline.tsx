'use client';

import { useState } from 'react';
import type { JobStage } from '@/lib/jobs';

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

export default function JobPipeline({ stages }: { stages: JobStage[] }) {
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
