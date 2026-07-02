'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

const WRAP: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, backgroundColor: 'var(--bg-primary, #0F1210)' };
const CARD: React.CSSProperties = { width: '100%', maxWidth: 480, margin: '24px 0', backgroundColor: 'var(--bg-card, #1C231E)', border: '1px solid var(--border-subtle, #2A3530)', borderRadius: 14, padding: 24 };

interface JobBlock { job_id?: number; summary: string | null; notes: { text: string; createdOn?: string }[] }
interface Context { customer_name: string | null; days_to_recall: number | null; equipment: string | null; original: JobBlock | null; recall: JobBlock | null }

function JobInfo({ label, block }: { label: string; block: JobBlock | null }) {
  if (!block) return null;
  const notes = block.notes || [];
  if (!block.summary?.trim() && notes.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #A8B5AB)' }}>{label}{block.job_id ? ` · job #${block.job_id}` : ''}</div>
      {block.summary?.trim() && <div style={{ fontSize: 13, color: 'var(--text-primary, #F5F0E1)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{block.summary}</div>}
      {notes.map((n, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary, #A8B5AB)', whiteSpace: 'pre-wrap', paddingLeft: 8, borderLeft: '2px solid var(--border-default, #3A4840)', marginTop: 4 }}>{n.text}</div>
      ))}
    </div>
  );
}

export default function TechAnswerPage() {
  const params = useParams();
  const token = String(params.token);
  const [question, setQuestion] = useState<string | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [demo, setDemo] = useState(false);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'answered' | 'done' | 'invalid'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/answer?token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setState('invalid'); setError(body.error || 'This link is no longer valid.'); return; }
      setQuestion(body.question); setContext(body.context || null); setDemo(!!body.demo);
      if (body.already_answered) { setAnswer(body.answer || ''); setState('answered'); }
      else setState('ready');
    } catch { setState('invalid'); setError('Could not load the question.'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!answer.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/public/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, answer }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || 'Could not submit. Try again.'); return; }
      setState('done');
    } catch { setError('Could not submit. Try again.'); } finally { setSaving(false); }
  };

  return (
    <div style={WRAP}>
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--christmas-green-light, #6B9B75)', fontWeight: 600 }}>Christmas Air</span>
          {demo && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-warning, #eab308)', border: '1px solid var(--status-warning, #eab308)', borderRadius: 999, padding: '2px 8px' }}>DEMO — nothing is saved</span>}
        </div>

        {state === 'loading' && <div style={{ color: 'var(--text-muted, #6B7C6E)' }}>Loading…</div>}
        {state === 'invalid' && <div style={{ color: 'var(--text-secondary, #A8B5AB)' }}>{error || 'This link is no longer valid.'}</div>}

        {state === 'done' && (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ color: 'var(--text-primary, #F5F0E1)', fontWeight: 600 }}>{demo ? 'Demo complete — nothing was saved.' : 'Thanks — got it.'}</div>
            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 14, marginTop: 4 }}>{demo ? 'This is what a technician sees after answering.' : 'Your answer was sent to the office. You can close this page.'}</div>
          </div>
        )}

        {(state === 'ready' || state === 'answered') && (
          <div>
            {/* Job context — details at the tech's fingertips */}
            {context && (context.customer_name || context.equipment || context.original || context.recall) && (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-secondary, #161B18)', border: '1px solid var(--border-subtle, #2A3530)' }}>
                {context.customer_name && <div style={{ fontSize: 14, color: 'var(--text-primary, #F5F0E1)', fontWeight: 600 }}>{context.customer_name}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7C6E)' }}>
                  {context.equipment ? `${context.equipment}` : ''}{context.equipment && context.days_to_recall != null ? ' · ' : ''}{context.days_to_recall != null ? `came back ${context.days_to_recall} days later` : ''}
                </div>
                <JobInfo label="The job you worked" block={context.original} />
                <JobInfo label="The callback" block={context.recall} />
              </div>
            )}

            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 13, marginBottom: 6 }}>Question from the office:</div>
            <div style={{ color: 'var(--text-primary, #F5F0E1)', fontWeight: 600, fontSize: 16, marginBottom: 14 }}>{question}</div>

            {state === 'answered' ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #A8B5AB)', paddingLeft: 10, borderLeft: '2px solid var(--border-default, #3A4840)' }}>
                <div style={{ color: 'var(--text-muted, #6B7C6E)', marginBottom: 4 }}>Already answered:</div>{answer}
              </div>
            ) : (
              <>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={5} placeholder="Type your answer…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: 'var(--bg-secondary, #161B18)', color: 'var(--text-primary, #F5F0E1)', border: '1px solid var(--border-default, #3A4840)', resize: 'vertical' }} />
                {error && <div style={{ color: 'var(--status-error, #ef4444)', fontSize: 13, marginTop: 8 }}>{error}</div>}
                <button onClick={submit} disabled={saving || !answer.trim()}
                  style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 8, fontSize: 16, fontWeight: 600, border: 'none', cursor: saving || !answer.trim() ? 'not-allowed' : 'pointer', opacity: saving || !answer.trim() ? 0.5 : 1, backgroundColor: 'var(--christmas-green, #5D8A66)', color: 'var(--christmas-cream, #F5F0E1)' }}>
                  {saving ? 'Sending…' : 'Submit answer'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
