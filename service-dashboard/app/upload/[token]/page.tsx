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
  const [justSent, setJustSent] = useState(0); // how many uploaded in the last batch
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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

  const uploadOne = async (file: File): Promise<{ ok: boolean; error?: string }> => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/public/upload?token=${encodeURIComponent(token)}`, { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) return { ok: true };
      return { ok: false, error: body.error || 'Upload failed.' };
    } catch { return { ok: false, error: 'Upload failed.' }; }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError(null); setJustSent(0);
    setProgress({ done: 0, total: files.length });
    let ok = 0; let firstErr: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const r = await uploadOne(files[i]);
      if (r.ok) { ok++; setCount(c => c + 1); }
      else if (!firstErr) firstErr = r.error || 'Upload failed.';
      setProgress({ done: i + 1, total: files.length });
    }
    if (fileRef.current) fileRef.current.value = ''; // allow re-picking the same file
    setUploading(false);
    setProgress(null);
    setJustSent(ok);
    const failed = files.length - ok;
    if (failed > 0) setError(`${failed} photo${failed === 1 ? '' : 's'} didn't upload${firstErr ? ` (${firstErr})` : ''}. Try again.`);
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
              {uploading
                ? (progress ? `Uploading ${progress.done} of ${progress.total}…` : 'Uploading…')
                : '📷 Take photo or choose from library'}
              {/* No capture attr → phone offers Camera, Photo Library, and Files. multiple → pick several at once. */}
              <input ref={fileRef} onChange={onPick} disabled={uploading} type="file" accept="image/*" multiple style={{ display: 'none' }} />
            </label>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7C6E)', marginTop: 8, textAlign: 'center' }}>
              You can select more than one photo at a time, or come back and add more.
            </div>

            {error && <div style={{ color: 'var(--status-error, #ef4444)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            {justSent > 0 && !error && <div style={{ color: 'var(--status-success, #22c55e)', fontSize: 14, marginTop: 10 }}>✓ {justSent} photo{justSent === 1 ? '' : 's'} uploaded. Add more if you like.</div>}

            <div style={{ fontSize: 13, color: 'var(--text-muted, #6B7C6E)', marginTop: 16 }}>
              {count} photo{count === 1 ? '' : 's'} uploaded for this recall. You can add more anytime from this link.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
