'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

const WRAP: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'var(--bg-primary, #0F1210)' };
const CARD: React.CSSProperties = { width: '100%', maxWidth: 480, backgroundColor: 'var(--bg-card, #1C231E)', border: '1px solid var(--border-subtle, #2A3530)', borderRadius: 14, padding: 24 };

export default function TechAnswerPage() {
  const params = useParams();
  const token = String(params.token);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'answered' | 'done' | 'invalid'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/answer?token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setState('invalid'); setError(body.error || 'This link is no longer valid.'); return; }
      setQuestion(body.question);
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
        <div style={{ fontSize: 13, color: 'var(--christmas-green-light, #6B9B75)', fontWeight: 600, marginBottom: 12 }}>Christmas Air</div>

        {state === 'loading' && <div style={{ color: 'var(--text-muted, #6B7C6E)' }}>Loading…</div>}

        {state === 'invalid' && <div style={{ color: 'var(--text-secondary, #A8B5AB)' }}>{error || 'This link is no longer valid.'}</div>}

        {state === 'done' && (
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ color: 'var(--text-primary, #F5F0E1)', fontWeight: 600 }}>Thanks — got it.</div>
            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 14, marginTop: 4 }}>Your answer was sent to the office. You can close this page.</div>
          </div>
        )}

        {state === 'answered' && (
          <div>
            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 14, marginBottom: 10 }}>This question was already answered:</div>
            <div style={{ color: 'var(--text-primary, #F5F0E1)', fontWeight: 600, marginBottom: 8 }}>{question}</div>
            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 14, paddingLeft: 10, borderLeft: '2px solid var(--border-default, #3A4840)' }}>{answer}</div>
          </div>
        )}

        {state === 'ready' && (
          <div>
            <div style={{ color: 'var(--text-secondary, #A8B5AB)', fontSize: 13, marginBottom: 6 }}>A question about a job you worked:</div>
            <div style={{ color: 'var(--text-primary, #F5F0E1)', fontWeight: 600, fontSize: 16, marginBottom: 14 }}>{question}</div>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={5} placeholder="Type your answer…"
              style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: 'var(--bg-secondary, #161B18)', color: 'var(--text-primary, #F5F0E1)', border: '1px solid var(--border-default, #3A4840)', resize: 'vertical' }} />
            {error && <div style={{ color: 'var(--status-error, #ef4444)', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button onClick={submit} disabled={saving || !answer.trim()}
              style={{ marginTop: 12, width: '100%', padding: '12px', borderRadius: 8, fontSize: 16, fontWeight: 600, border: 'none', cursor: saving || !answer.trim() ? 'not-allowed' : 'pointer', opacity: saving || !answer.trim() ? 0.5 : 1, backgroundColor: 'var(--christmas-green, #5D8A66)', color: 'var(--christmas-cream, #F5F0E1)' }}>
              {saving ? 'Sending…' : 'Submit answer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
