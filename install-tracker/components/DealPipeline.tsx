'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { PipelineStage } from '@/lib/deals';
import type { ProjectEstimate } from '@/lib/jobs';

const usd = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function dot(status: PipelineStage['status']) {
  return status === 'done' ? '✓' : status === 'na' ? '–' : status === 'active' ? '●' : '○';
}

export default function DealPipeline({
  stages, estimates, projectId,
}: {
  stages: PipelineStage[]; estimates: ProjectEstimate[]; projectId: number;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = role === 'owner' || role === 'manager';

  // Open the first stage still needing work (done and N/A both count as settled).
  const firstOpen = Math.max(0, stages.findIndex((s) => s.status !== 'done' && s.status !== 'na'));
  const [open, setOpen] = useState<Set<number>>(new Set([firstOpen === -1 ? 0 : firstOpen]));
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(i: number) {
    setOpen((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  async function patch(nodeId: string, payload: Record<string, unknown>) {
    setBusy(nodeId);
    try {
      const res = await fetch('/api/deal-steps', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, nodeId, ...payload }),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || 'Failed'); return; }
      router.refresh();
    } finally { setBusy(null); }
  }
  const setStep = (nodeId: string, done: boolean) => patch(nodeId, { done });
  const setGate = (nodeId: string, state: 'required' | 'not_required') => patch(nodeId, { state });

  const soldEst = estimates.filter((e) => e.status === 'Sold');

  return (
    <div className="jp-flow">
      {stages.map((s, i) => {
        const isOpen = open.has(i);
        const doneCount = s.subSteps.filter((x) => x.done).length;
        return (
          <div className="jp-step" key={`${s.name}-${i}`}>
            <div className={`jp-dot ${s.status}`}>{dot(s.status)}</div>
            <div className="jp-card">
              <button className="jp-headrow" onClick={() => toggle(i)} aria-expanded={isOpen}>
                <span className="jp-head">
                  <span className="jp-name">{s.name}</span>
                  {s.status === 'na'
                    ? <span className="jp-progress na">Not required</span>
                    : s.subSteps.length > 0 && <span className="jp-progress">{doneCount}/{s.subSteps.length}</span>}
                </span>
                <span className={`jp-chev ${isOpen ? 'open' : ''}`}>›</span>
              </button>

              {isOpen && (
                <div className="jp-expand">
                  {s.gated && s.notRequired ? (
                    <div className="gate na-row">
                      <span className="na-label">Not required for this job</span>
                      {canEdit && s.stageId && (
                        <button className="gate-btn" onClick={() => setGate(s.stageId!, 'required')} disabled={busy === s.stageId}>Mark required</button>
                      )}
                    </div>
                  ) : (<>
                  {s.gated && canEdit && s.stageId && (
                    <div className="gate">
                      <span className="gate-q">Not every job needs this stage.</span>
                      <button className="gate-btn" onClick={() => setGate(s.stageId!, 'not_required')} disabled={busy === s.stageId}>Mark not required</button>
                    </div>
                  )}
                  <ul className="checklist">
                    {s.subSteps.map((ss, j) => (
                      <li key={ss.id ?? j} className={ss.done ? 'done' : ''}>
                        {ss.auto ? (
                          <span className={`chk-auto ${ss.done ? 'on' : ''}`} title="Filled automatically from ServiceTitan">{ss.done ? '✓' : '○'}</span>
                        ) : (
                          <input
                            type="checkbox" className="chk-box"
                            checked={ss.done}
                            disabled={!canEdit || !ss.id || busy === ss.id}
                            onChange={(e) => ss.id && setStep(ss.id, e.target.checked)}
                          />
                        )}
                        <span className="chk-body">
                          <span className="chk-title">{ss.title}</span>
                          <span className="chk-sub">{ss.auto ? (ss.evidence || 'from ServiceTitan') : (ss.evidence || ss.detail)}</span>
                        </span>
                        <span className={`chk-tag ${ss.tag}`}>{ss.tag}</span>
                      </li>
                    ))}
                    {s.subSteps.length === 0 && <li className="chk-empty">No sub-steps defined for this stage yet.</li>}
                  </ul>

                  {s.isSold && soldEst.length > 0 && (
                    <div className="ests">
                      <div className="ests-summary">
                        {soldEst.length} sold estimate{soldEst.length === 1 ? '' : 's'} ·{' '}
                        {soldEst.reduce((a, e) => a + (e.systems ?? 0), 0)} system{soldEst.reduce((a, e) => a + (e.systems ?? 0), 0) === 1 ? '' : 's'} ·{' '}
                        {soldEst.reduce((a, e) => a + (e.components ?? 0), 0)} components
                      </div>
                      {soldEst.map((e) => (
                        <div className="est-row" key={e.estimate_id}>
                          <div className="est-head">
                            <span className="est-name">{e.name || `Estimate #${e.estimate_id}`}</span>
                            <span className="est-amt">{usd(e.subtotal)}</span>
                            {e.estimate_job_number && (
                              <a className="est-link" href={`https://go.servicetitan.com/#/Job/Index/${e.estimate_job_number}`} target="_blank" rel="noopener noreferrer">↗</a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </>)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
