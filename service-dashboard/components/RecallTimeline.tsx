'use client';

import { useState, ReactNode } from 'react';

// Visual causal journey of a recall: original job → gap → recall → AI verdict → validation,
// with investigation events woven in chronologically. Managers scan this to validate
// causation instead of reading two ServiceTitan histories from scratch.

export interface TimelineRecall {
  st_original_job_id: number;
  st_original_completed_date?: string | null;
  recall_created_on: string;
  days_to_recall: number | null;
  tech_name: string | null;
  customer_name: string | null;
  business_unit_name: string | null;
}
export interface TimelineEvidence { claim: string; source: string; quote?: string }
export interface TimelineInvestigation {
  validation_state?: string | null;
  root_cause_category: string | null;
  ai_root_cause_category?: string | null;
  ai_rationale?: string | null;
  ai_evidence?: TimelineEvidence[] | null;
  ai_confidence?: string | null;
  ai_generated_at?: string | null;
}
export interface TimelineJobDetails {
  recall: { summary: string | null } | null;
  original: { summary: string | null } | null;
}
export interface TimelineActivity { id: string; action: string; created_at: string }

const RAIL = 'var(--border-default)';
const CONF: Record<string, { label: string; fg: string; bg: string }> = {
  high: { label: 'High confidence', fg: 'var(--status-success)', bg: 'rgba(34,197,94,0.12)' },
  med: { label: 'Medium confidence', fg: 'var(--status-warning)', bg: 'rgba(234,179,8,0.12)' },
  low: { label: 'Low confidence', fg: 'var(--status-error)', bg: 'rgba(239,68,68,0.12)' },
};

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d); // date-only strings are Central local
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function truncate(s: string | null | undefined, n = 180): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

// Humanize an activity action string into a timeline label.
function activityLabel(action: string): string | null {
  if (action === 'opened') return null; // covered by the AI/recall nodes
  if (action === 'ai_validated') return 'Manager confirmed the AI root cause';
  if (action === 'ai_overridden') return 'Manager overrode the AI root cause';
  if (action === 'question_added') return 'Research question added';
  if (action === 'question_answered') return 'Research question answered';
  if (action === 'resolved') return 'Marked resolved';
  if (action === 'reopened') return 'Re-opened';
  if (action.startsWith('status:')) {
    const m = action.replace('status:', '').replace('→', ' → ');
    return `Status changed (${m})`;
  }
  if (action === 'updated') return null; // too noisy for the timeline
  return action;
}

function Node({ dot, title, meta, children }: { dot: ReactNode; title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 34, paddingBottom: 18 }}>
      <div style={{ position: 'absolute', left: 7, top: 2, width: 18, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{dot}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      {meta && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{meta}</div>}
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

const DOT = (color: string, glyph: string) => (
  <span style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{glyph}</span>
);

export default function RecallTimeline({ recall, investigation, jobDetails, activity }: {
  recall: TimelineRecall | null;
  investigation: TimelineInvestigation | null;
  jobDetails: TimelineJobDetails | null;
  activity: TimelineActivity[];
}) {
  const [showEvidence, setShowEvidence] = useState(true);
  if (!recall) return null;

  const inv = investigation;
  const aiCat = inv?.ai_root_cause_category || null;
  const conf = CONF[inv?.ai_confidence || ''] || null;
  const evidence = inv?.ai_evidence || [];
  const validated = inv?.validation_state === 'validated' || inv?.validation_state === 'overridden';
  const finalCause = inv?.root_cause_category || null;

  // Investigation activity worth showing, oldest-first, that isn't already a dedicated node.
  const events = [...activity]
    .filter(a => activityLabel(a.action) !== null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const origSummary = truncate(jobDetails?.original?.summary);
  const recallSummary = truncate(jobDetails?.recall?.summary);

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Timeline</h2>
      <div style={{ position: 'relative' }}>
        {/* vertical rail */}
        <div style={{ position: 'absolute', left: 15, top: 4, bottom: 12, width: 2, backgroundColor: RAIL }} />

        {/* 1. Original job */}
        <Node
          dot={DOT('var(--christmas-green)', '🔧')}
          title="Original job completed"
          meta={<>{fmt(recall.st_original_completed_date)} · Tech: {recall.tech_name || '—'} · job #{recall.st_original_job_id}</>}
        >
          {origSummary
            ? <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{origSummary}</div>
            : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No work summary on file.</div>}
        </Node>

        {/* 2. Gap */}
        {recall.days_to_recall != null && (
          <Node dot={DOT('var(--bg-secondary)', '⏱')} title={<span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{recall.days_to_recall} days later</span>} />
        )}

        {/* 3. Recall */}
        <Node
          dot={DOT('var(--status-warning)', '↩')}
          title="Recall created"
          meta={<>{fmt(recall.recall_created_on)} · {recall.business_unit_name || '—'}</>}
        >
          {recallSummary
            ? <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{recallSummary}</div>
            : <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No callback summary on file.</div>}
        </Node>

        {/* 4. AI verdict */}
        {aiCat ? (
          <Node
            dot={DOT('var(--christmas-green-light)', '✨')}
            title={<>AI root cause: <span style={{ color: 'var(--text-primary)' }}>{aiCat}</span></>}
            meta={<>{inv?.ai_generated_at ? fmt(inv.ai_generated_at) : ''}{validated ? '' : ' · proposed, needs validation'}</>}
          >
            {conf && (
              <span style={{ display: 'inline-block', backgroundColor: conf.bg, color: conf.fg, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{conf.label}</span>
            )}
            {inv?.ai_rationale && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{inv.ai_rationale}</div>}
            {evidence.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowEvidence(v => !v)}
                  style={{ fontSize: 12, color: 'var(--christmas-green-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showEvidence ? '▾' : '▸'} Why ({evidence.length} {evidence.length === 1 ? 'signal' : 'signals'})
                </button>
                {showEvidence && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {evidence.map((e, i) => (
                      <div key={i} style={{ fontSize: 13, paddingLeft: 10, borderLeft: '2px solid var(--border-default)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{e.source}</span>
                        <div style={{ color: 'var(--text-secondary)' }}>{e.claim}</div>
                        {e.quote && <div style={{ color: 'var(--text-primary)', fontStyle: 'italic', marginTop: 2 }}>&ldquo;{e.quote}&rdquo;</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Node>
        ) : (
          <Node dot={DOT('var(--bg-secondary)', '✨')} title={<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No AI proposal yet</span>} meta="Use “Re-run AI” below to generate one." />
        )}

        {/* 5. Investigation events */}
        {events.map(ev => {
          const label = activityLabel(ev.action)!;
          return <Node key={ev.id} dot={DOT('var(--bg-secondary)', '•')} title={<span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>} meta={fmt(ev.created_at)} />;
        })}

        {/* 6. Validation / final cause */}
        {validated && finalCause && (
          <Node
            dot={DOT('var(--status-success)', '✓')}
            title={<>Validated root cause: <span style={{ color: 'var(--text-primary)' }}>{finalCause}</span></>}
            meta={inv?.validation_state === 'overridden' ? 'Manager overrode the AI' : 'Manager confirmed the AI'}
          />
        )}
      </div>
    </div>
  );
}
