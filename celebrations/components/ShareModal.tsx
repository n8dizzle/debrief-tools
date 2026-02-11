'use client';

import { useState } from 'react';
import { CelBoard } from '@/lib/supabase';

interface ShareModalProps {
  board: CelBoard;
  onClose: () => void;
}

export default function ShareModal({ board, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://celebrate.christmasair.com';
  const publicUrl = `${appUrl}/b/${board.slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="modal-panel" style={{ maxHeight: 'fit-content' }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--christmas-cream)' }}>
            Share Board
          </h3>
          <button onClick={onClose} className="modal-close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 safe-area-bottom">
          {/* Visibility info */}
          <div
            className="p-3 rounded-lg flex items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
              background: board.visibility === 'public' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(93, 138, 102, 0.15)',
              color: board.visibility === 'public' ? '#60a5fa' : 'var(--christmas-green-light)',
            }}>
              {board.visibility === 'public' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {board.visibility === 'public' ? 'Public Board' : 'Internal Only'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {board.visibility === 'public'
                  ? 'Anyone with the link can view and contribute'
                  : 'Only team members can view (must be logged in)'}
              </p>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
              Board Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={publicUrl}
                readOnly
                className="input flex-1 text-sm"
              />
              <button
                onClick={handleCopy}
                className="btn btn-primary whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
