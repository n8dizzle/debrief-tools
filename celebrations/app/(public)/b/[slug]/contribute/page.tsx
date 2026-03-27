'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CelBoard, TEXT_BG_COLORS } from '@/lib/supabase';
import MediaUploader from '@/components/MediaUploader';
import GiphyPicker from '@/components/GiphyPicker';

type Tab = 'text' | 'photo' | 'gif' | 'video';

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
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(TEXT_BG_COLORS[TEXT_BG_COLORS.length - 1]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [mediaWidth, setMediaWidth] = useState<number | undefined>();
  const [mediaHeight, setMediaHeight] = useState<number | undefined>();
  const [caption, setCaption] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);

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

  function resetMedia() {
    setMediaUrl('');
    setStoragePath('');
    setMediaWidth(undefined);
    setMediaHeight(undefined);
    setCaption('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!board) return;
    if (!board.allow_anonymous && !authorName.trim()) return;

    const isMedia = ['photo', 'gif', 'video'].includes(tab);
    if (tab === 'text' && !text.trim()) return;
    if (isMedia && !mediaUrl) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contribute/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || 'Anonymous',
          content_type: tab,
          text_content: (tab === 'text' ? text.trim() : caption.trim()) || null,
          media_url: isMedia ? mediaUrl : null,
          media_storage_path: storagePath || null,
          media_width: mediaWidth || null,
          media_height: mediaHeight || null,
          background_color: tab === 'text' ? bgColor : null,
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

  const canSubmit = (tab === 'text' && text.trim()) || (['photo', 'gif', 'video'].includes(tab) && mediaUrl);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'text', label: 'Text' },
    { key: 'photo', label: 'Photo' },
    { key: 'gif', label: 'GIF' },
    { key: 'video', label: 'Video' },
  ];

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
              setCaption('');
              setMediaUrl('');
              setStoragePath('');
              setMediaWidth(undefined);
              setMediaHeight(undefined);
              setTab('text');
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
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Your Name {board.allow_anonymous ? '(optional)' : '*'}
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="input"
            placeholder={board.allow_anonymous ? 'Anonymous' : 'Enter your name'}
            required={!board.allow_anonymous}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); resetMedia(); }}
              className="flex-1 py-3 sm:py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tab === t.key ? 'var(--christmas-green)' : 'transparent',
                color: tab === t.key ? 'var(--christmas-cream)' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Text tab */}
        {tab === 'text' && (
          <div className="space-y-4">
            <div className="rounded-lg p-4 min-h-[120px]" style={{ background: bgColor }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-transparent border-none resize-none focus:outline-none text-base"
                style={{ color: bgColor !== '#1C231E' ? '#ffffff' : 'var(--text-primary)' }}
                placeholder="Write your message..."
                rows={4}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>
                Background Color
              </label>
              <div className="flex gap-3 flex-wrap">
                {TEXT_BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBgColor(color)}
                    className="w-10 h-10 sm:w-8 sm:h-8 rounded-full transition-transform"
                    style={{
                      background: color,
                      transform: bgColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: bgColor === color ? '0 0 0 2px var(--christmas-cream)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Photo tab */}
        {tab === 'photo' && (
          <div className="space-y-4">
            {mediaUrl ? (
              <div className="relative">
                <img src={mediaUrl} alt="" className="w-full rounded-lg" />
                <button
                  type="button"
                  onClick={resetMedia}
                  className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <MediaUploader
                boardId={board.id}
                accept="image/jpeg,image/png,image/webp,image/gif"
                uploadUrl={`/api/contribute/${slug}/upload`}
                onUpload={(result) => {
                  setMediaUrl(result.url);
                  setStoragePath(result.storagePath);
                }}
                label="Tap to upload a photo or drag and drop"
              />
            )}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="input"
              placeholder="Add a caption (optional)"
              rows={2}
            />
          </div>
        )}

        {/* GIF tab */}
        {tab === 'gif' && (
          <div className="space-y-4">
            {mediaUrl ? (
              <div>
                <div className="relative">
                  <img src={mediaUrl} alt="" className="w-full rounded-lg" />
                  <button
                    type="button"
                    onClick={resetMedia}
                    className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="input mt-4"
                  placeholder="Add a caption (optional)"
                  rows={2}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGiphy(true)}
                className="w-full p-10 rounded-lg border-2 border-dashed text-center transition-colors"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div className="text-3xl mb-2">GIF</div>
                <p className="text-sm">Tap to search for GIFs</p>
              </button>
            )}
          </div>
        )}

        {/* Video tab */}
        {tab === 'video' && (
          <div className="space-y-4">
            {mediaUrl ? (
              <div className="relative">
                <video src={mediaUrl} controls className="w-full rounded-lg" />
                <button
                  type="button"
                  onClick={resetMedia}
                  className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <MediaUploader
                boardId={board.id}
                accept="video/mp4,video/webm"
                uploadUrl={`/api/contribute/${slug}/upload`}
                onUpload={(result) => {
                  setMediaUrl(result.url);
                  setStoragePath(result.storagePath);
                }}
                label="Tap to upload a video or drag and drop"
              />
            )}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="input"
              placeholder="Add a caption (optional)"
              rows={2}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="btn btn-primary w-full py-3"
          style={{ opacity: submitting || !canSubmit ? 0.5 : 1 }}
        >
          {submitting ? 'Posting...' : 'Post Message'}
        </button>
      </form>

      {/* GIPHY Picker Modal */}
      {showGiphy && (
        <GiphyPicker
          onSelect={(gif) => {
            setMediaUrl(gif.url);
            setMediaWidth(gif.width);
            setMediaHeight(gif.height);
            setShowGiphy(false);
          }}
          onClose={() => setShowGiphy(false)}
        />
      )}
    </div>
  );
}
