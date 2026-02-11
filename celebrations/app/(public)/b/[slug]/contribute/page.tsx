'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CelBoard, TEXT_BG_COLORS } from '@/lib/supabase';

export default function PublicContributePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [board, setBoard] = useState<CelBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [authorName, setAuthorName] = useState('');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(TEXT_BG_COLORS[TEXT_BG_COLORS.length - 1]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [contentType, setContentType] = useState<'text' | 'photo'>('text');
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    fetchBoard();
  }, [slug]);

  async function fetchBoard() {
    try {
      const res = await fetch(`/api/contribute/${slug}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
      }
    } catch (err) {
      console.error('Failed to fetch board:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !board) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', board.id);
      formData.append('slug', slug);

      const res = await fetch(`/api/contribute/${slug}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setMediaUrl(data.url);
        setContentType('photo');
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!board) return;
    if (!board.allow_anonymous && !authorName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contribute/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || 'Anonymous',
          content_type: mediaUrl ? 'photo' : 'text',
          text_content: text.trim() || null,
          media_url: mediaUrl || null,
          background_color: !mediaUrl ? bgColor : null,
        }),
      });

      if (res.ok) {
        setSuccess(true);
      }
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>Board not found</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">{'\uD83C\uDF89'}</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--christmas-cream)' }}>
          Message Added!
        </h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Your message has been added to the board.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/b/${slug}`)}
            className="btn btn-primary"
          >
            View Board
          </button>
          <button
            onClick={() => {
              setSuccess(false);
              setText('');
              setMediaUrl('');
              setContentType('text');
            }}
            className="btn btn-secondary"
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 sm:py-8 pb-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/b/${slug}`)}
          className="text-sm mb-4 inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to board
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Add Your Message
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          to &quot;{board.title}&quot;
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        {!board.allow_anonymous && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Your Name *
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="input"
              placeholder="Enter your name"
              required
            />
          </div>
        )}

        {board.allow_anonymous && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Your Name (optional)
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="input"
              placeholder="Anonymous"
            />
          </div>
        )}

        {/* Message */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Your Message
          </label>
          <div className="rounded-lg p-4" style={{ background: !mediaUrl ? bgColor : 'var(--bg-card)' }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-transparent border-none resize-none focus:outline-none"
              style={{ color: bgColor !== '#1C231E' && !mediaUrl ? '#ffffff' : 'var(--text-primary)' }}
              placeholder="Write your message..."
              rows={4}
            />
          </div>

          {/* Color picker (only for text-only posts) */}
          {!mediaUrl && (
            <div className="mt-3">
              <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
                Background Color
              </label>
              <div className="flex gap-3 sm:gap-2 flex-wrap">
                {TEXT_BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    className="w-10 h-10 sm:w-7 sm:h-7 rounded-full transition-transform"
                    style={{
                      background: color,
                      transform: bgColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: bgColor === color ? '0 0 0 2px var(--christmas-cream)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Add a Photo (optional)
          </label>
          {mediaUrl ? (
            <div className="relative">
              <img src={mediaUrl} alt="" className="w-full rounded-lg" />
              <button
                type="button"
                onClick={() => { setMediaUrl(''); setContentType('text'); }}
                className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
              {uploadingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Click to upload a photo</span>
                </div>
              )}
            </label>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (!text.trim() && !mediaUrl)}
          className="btn btn-primary w-full py-3"
          style={{ opacity: submitting || (!text.trim() && !mediaUrl) ? 0.5 : 1 }}
        >
          {submitting ? 'Posting...' : 'Post Message'}
        </button>
      </form>
    </div>
  );
}
