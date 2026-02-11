'use client';

import { useState } from 'react';
import MediaUploader from './MediaUploader';
import GiphyPicker from './GiphyPicker';
import { TEXT_BG_COLORS } from '@/lib/supabase';

type Tab = 'text' | 'photo' | 'gif' | 'video';

interface PostFormProps {
  boardId: string;
  onSubmit: (post: {
    content_type: string;
    text_content?: string;
    media_url?: string;
    media_storage_path?: string;
    media_thumbnail_url?: string;
    media_width?: number;
    media_height?: number;
    background_color?: string;
  }) => Promise<void>;
  onClose: () => void;
  authorName?: string;
}

export default function PostForm({ boardId, onSubmit, onClose, authorName }: PostFormProps) {
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(TEXT_BG_COLORS[TEXT_BG_COLORS.length - 1]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [mediaWidth, setMediaWidth] = useState<number | undefined>();
  const [mediaHeight, setMediaHeight] = useState<number | undefined>();
  const [caption, setCaption] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'text', label: 'Text' },
    { key: 'photo', label: 'Photo' },
    { key: 'gif', label: 'GIF' },
    { key: 'video', label: 'Video' },
  ];

  async function handleSubmit() {
    if (tab === 'text' && !text.trim()) return;
    if (['photo', 'gif', 'video'].includes(tab) && !mediaUrl) return;

    setSubmitting(true);
    try {
      await onSubmit({
        content_type: tab,
        text_content: tab === 'text' ? text : caption || undefined,
        media_url: tab !== 'text' ? mediaUrl : undefined,
        media_storage_path: storagePath || undefined,
        media_thumbnail_url: thumbnail || undefined,
        media_width: mediaWidth,
        media_height: mediaHeight,
        background_color: tab === 'text' ? bgColor : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to submit post:', err);
    } finally {
      setSubmitting(false);
    }
  }

  function resetMedia() {
    setMediaUrl('');
    setStoragePath('');
    setThumbnail('');
    setMediaWidth(undefined);
    setMediaHeight(undefined);
    setCaption('');
  }

  const canSubmit = (tab === 'text' && text.trim()) || (['photo', 'gif', 'video'].includes(tab) && mediaUrl);

  return (
    <div className="modal-overlay">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="modal-panel">
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--christmas-cream)' }}>
            Add Your Message
          </h3>
          <button onClick={onClose} className="modal-close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
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

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Text tab */}
          {tab === 'text' && (
            <div className="space-y-4">
              <div
                className="rounded-lg p-4 min-h-[120px]"
                style={{ background: bgColor }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-transparent border-none resize-none focus:outline-none text-base"
                  style={{
                    color: bgColor !== '#1C231E' ? '#ffffff' : 'var(--text-primary)',
                  }}
                  placeholder="Write your message..."
                  rows={4}
                  autoFocus
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Background Color
                </label>
                <div className="flex gap-3 flex-wrap">
                  {TEXT_BG_COLORS.map((color) => (
                    <button
                      key={color}
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
                  boardId={boardId}
                  accept="image/jpeg,image/png,image/webp,image/gif"
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
                  boardId={boardId}
                  accept="video/mp4,video/webm"
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
        </div>

        {/* Footer - sticky at bottom */}
        <div className="p-4 flex gap-3 safe-area-bottom" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} className="btn btn-secondary flex-1 sm:flex-none">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="btn btn-primary flex-1 sm:flex-none"
            style={{ opacity: submitting || !canSubmit ? 0.5 : 1 }}
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* GIPHY Picker Modal */}
      {showGiphy && (
        <GiphyPicker
          onSelect={(gif) => {
            setMediaUrl(gif.url);
            setThumbnail(gif.thumbnail);
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
