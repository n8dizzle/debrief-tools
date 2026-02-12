'use client';

import { useState, useEffect, useCallback } from 'react';

interface GiphyGif {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  preview: string;
  width: number;
  height: number;
}

interface GiphyPickerProps {
  onSelect: (gif: GiphyGif) => void;
  onClose: () => void;
}

export default function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load trending on mount
  useEffect(() => {
    fetchTrending();
  }, []);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res = await fetch('/api/giphy/trending?limit=24');
      if (res.ok) {
        const data = await res.json();
        setGifs(data.gifs);
      }
    } catch (err) {
      console.error('Failed to fetch trending GIFs:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback((q: string) => {
    setQuery(q);

    if (searchTimeout) clearTimeout(searchTimeout);

    if (!q.trim()) {
      fetchTrending();
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/giphy/search?q=${encodeURIComponent(q)}&limit=24`);
        if (res.ok) {
          const data = await res.json();
          setGifs(data.gifs);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    setSearchTimeout(timeout);
  }, [searchTimeout]);

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="modal-panel">
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--christmas-cream)' }}>
            Choose a GIF
          </h3>
          <button onClick={onClose} className="modal-close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="input"
            placeholder="Search GIFs..."
            autoFocus
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
            </div>
          ) : gifs.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              {query ? 'No GIFs found' : 'Loading...'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => onSelect(gif)}
                  className="relative rounded-lg overflow-hidden hover:ring-2 transition-all aspect-square"
                  style={{ background: 'var(--bg-card)' }}
                >
                  <img
                    src={gif.preview || gif.thumbnail}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GIPHY Attribution */}
        <div className="p-3 text-center safe-area-bottom" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Powered by GIPHY
          </span>
        </div>
      </div>
    </div>
  );
}
