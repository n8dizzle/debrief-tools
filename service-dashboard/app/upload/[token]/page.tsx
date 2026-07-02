'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

const WRAP: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, backgroundColor: 'var(--bg-primary, #0F1210)' };
const CARD: React.CSSProperties = { width: '100%', maxWidth: 480, margin: '24px 0', backgroundColor: 'var(--bg-card, #1C231E)', border: '1px solid var(--border-subtle, #2A3530)', borderRadius: 14, padding: 24 };

interface Info { job_id: number; customer_name: string | null; uploaded: number }

export default function RecallPhotoUploadPage() {
  const params = useParams();
  const token = String(params.token);
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [uploading, setUploading] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/upload?token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setState('invalid'); setError(body.error || 'This link is no longer valid.'); return; }
      setInfo(body); setCount(body.uploaded || 0); setState('ready');
    } catch { setState('invalid'); setError('Could not load this page.'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setUploading(true); setError(null); setJustSent(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/public/upload?token=${encodeURIComponent(token)}`, { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) { setError(body.error || 'Upload failed. Try again.'); return; }
      setCount(c => c + 1); setJustSent(true);
      if (fileRef.current) fileRef.current.value = '';
    } catch { setError('Upload failed. Try again.'); } finally { setUploading(false); }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  return (
    <div style={WRAP}>
      <div style={CARD}>
        <div style={{ fontSize: 13, color: 'var(--christmas-green-light, #6B9B75)', fontWeight: 600, marginBottom: 12 }}>Christmas Air</div>

        {state === 'loading' && <div style={{ color: 'var(--text-muted, #6B7C6E)' }}>Loading…</div>}
        {state === 'invalid' && <div style={{ color: 'var(--text-secondary, #A8B5AB)' }}>{error || 'This link is no longer valid.'}</div>}

        {state === 'ready' && info && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F5F0E1)' }}>Upload photos</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #A8B5AB)', marginTop: 2 }}>
              Recall job #{info.job_id}{info.customer_name ? ` · ${info.customer_name}` : ''}
            </div>

            <label
              style={{ display: 'block', marginTop: 18, padding: '16px', borderRadius: 10, textAlign: 'center', cursor: uploading ? 'wait' : 'pointer',
                border: '1.5px dashed var(--border-default, #3A4840)', backgroundColor: 'var(--bg-secondary, #161B18)', color: 'var(--text-primary, #F5F0E1)', fontWeight: 600 }}
            >
              {uploading ? 'Uploading…' : '📷 Take or choose a photo'}
              <input ref={fileRef} onChange={onPick} disabled={uploading} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} />
            </label>

            {error && <div style={{ color: 'var(--status-error, #ef4444)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            {justSent && !error && <div style={{ color: 'var(--status-success, #22c55e)', fontSize: 14, marginTop: 10 }}>✓ Photo uploaded. Add another if you like.</div>}

            <div style={{ fontSize: 13, color: 'var(--text-muted, #6B7C6E)', marginTop: 16 }}>
              {count} photo{count === 1 ? '' : 's'} uploaded for this recall. You can add more anytime from this link.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
