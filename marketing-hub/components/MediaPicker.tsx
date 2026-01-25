'use client';

import { useState, useRef } from 'react';
import type { GBPMedia } from '@/lib/supabase';

interface MediaPickerProps {
  selectedUrls: string[];
  onSelect: (urls: string[]) => void;
  maxItems?: number;
}

export default function MediaPicker({
  selectedUrls,
  onSelect,
  maxItems = 10,
}: MediaPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [media, setMedia] = useState<GBPMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gbp/media');
      const data = await response.json();
      if (response.ok) {
        setMedia(data.media || []);
      } else {
        setError(data.error || 'Failed to load media');
      }
    } catch {
      setError('Failed to load media');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    loadMedia();
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      const response = await fetch('/api/gbp/media', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Add to media list and auto-select
        setMedia((prev) => [data, ...prev]);
        if (selectedUrls.length < maxItems) {
          onSelect([...selectedUrls, data.url]);
        }
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleSelect = (url: string) => {
    if (selectedUrls.includes(url)) {
      onSelect(selectedUrls.filter((u) => u !== url));
    } else if (selectedUrls.length < maxItems) {
      onSelect([...selectedUrls, url]);
    }
  };

  const removeSelected = (url: string) => {
    onSelect(selectedUrls.filter((u) => u !== url));
  };

  return (
    <div>
      {/* Selected Media Preview */}
      {selectedUrls.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedUrls.map((url, idx) => (
            <div
              key={idx}
              className="relative w-20 h-20 rounded-lg overflow-hidden group"
              style={{ border: '2px solid var(--christmas-green)' }}
            >
              <img
                src={url}
                alt={`Selected ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeSelected(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Media Button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {selectedUrls.length > 0 ? `Change photos (${selectedUrls.length})` : 'Add photos'}
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-2xl max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <h3 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
                Select Photos
              </h3>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload Button */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                }}
              >
                {isUploading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload New Photo
                  </>
                )}
              </button>
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                JPEG, PNG, or WebP - Max 5MB
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Media Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-8 h-8 animate-spin" style={{ color: 'var(--christmas-green)' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : media.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No photos in library. Upload one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {media.map((item) => {
                    const isSelected = selectedUrls.includes(item.url);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelect(item.url)}
                        className="relative aspect-square rounded-lg overflow-hidden group transition-transform hover:scale-105"
                        style={{
                          border: isSelected
                            ? '3px solid var(--christmas-green)'
                            : '2px solid var(--border-subtle)',
                        }}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(52, 102, 67, 0.5)' }}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: 'var(--christmas-green)' }}
                            >
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex justify-between items-center"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {selectedUrls.length} of {maxItems} selected
              </span>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--christmas-green)',
                  color: 'var(--christmas-cream)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
