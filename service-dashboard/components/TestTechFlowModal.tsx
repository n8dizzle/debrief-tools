'use client';

import { useEffect, useState } from 'react';

// Lets a supervisor text THEIR OWN phone the demo answer link, so they experience the
// full technician flow (receive text → tap → see job context → answer). Sends a real SMS.
export default function TestTechFlowModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    if (!phone.trim() || sending) return;
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/recalls/test-text', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.sent) { setError(body.error || 'Could not send. Try again.'); return; }
      setSentTo(body.to || null);
    } catch { setError('Could not send. Try again.'); } finally { setSending(false); }
  };

  const label = 'var(--text-secondary)';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: '100%', maxWidth: 440, borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Test the technician flow</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {sentTo ? (
            <div>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📱</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>Sent to {sentTo}</div>
              <div style={{ color: label, fontSize: 14 }}>
                Check your phone and tap the link. It opens the demo — you can type an answer and submit; nothing is saved.
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button onClick={() => { setSentTo(null); setPhone(''); }} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--christmas-green-light)', border: '1px solid var(--border-default)' }}>Send another</button>
                <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream, #F5F0E1)' }}>Done</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: label, fontSize: 14, marginBottom: 14 }}>
                Enter your mobile number and we&apos;ll text you the same kind of link a technician gets.
                It opens a demo with sample job details — nothing is saved.
              </p>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Your mobile number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                type="tel" inputMode="tel" placeholder="(469) 555-0123" autoFocus
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, fontSize: 15, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
              />
              {error && <div style={{ color: 'var(--status-error)', fontSize: 13, marginTop: 8 }}>{error}</div>}
              <button
                onClick={send} disabled={sending || !phone.trim()}
                style={{ marginTop: 14, width: '100%', padding: '11px', borderRadius: 8, fontSize: 15, fontWeight: 600, border: 'none', cursor: sending || !phone.trim() ? 'not-allowed' : 'pointer', opacity: sending || !phone.trim() ? 0.5 : 1, backgroundColor: 'var(--christmas-green)', color: 'var(--christmas-cream, #F5F0E1)' }}
              >
                {sending ? 'Sending…' : 'Text me the test link'}
              </button>
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <a href="/q/demo" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--christmas-green-light)' }}>Or open the demo in this browser ↗</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
