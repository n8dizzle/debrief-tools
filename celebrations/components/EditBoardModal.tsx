'use client';

import { useState } from 'react';
import { CelBoard, BoardType, BOARD_TYPE_LABELS, BOARD_TYPE_EMOJI } from '@/lib/supabase';

const BOARD_TYPES: BoardType[] = ['birthday', 'company', 'farewell', 'holiday', 'custom'];

interface EditBoardModalProps {
  board: CelBoard;
  onSave: (updated: CelBoard) => void;
  onClose: () => void;
}

export default function EditBoardModal({ board, onSave, onClose }: EditBoardModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description || '');
  const [boardType, setBoardType] = useState<BoardType>(board.board_type);
  const [visibility, setVisibility] = useState(board.visibility);
  const [honoreeName, setHonoreeName] = useState(board.honoree_name || '');
  const [eventDate, setEventDate] = useState(board.event_date || '');
  const [slug, setSlug] = useState(board.slug || '');
  const [allowAnonymous, setAllowAnonymous] = useState(board.allow_anonymous);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug.trim() || undefined,
          description: description || null,
          board_type: boardType,
          visibility,
          honoree_name: honoreeName || null,
          event_date: eventDate || null,
          allow_anonymous: allowAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update board');
      }

      const { board: updated } = await res.json();
      onSave(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-2xl rounded-xl p-6 my-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Edit Board
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg text-sm" style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              {error}
            </div>
          )}

          {/* Board Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Board Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BOARD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBoardType(type)}
                  className="p-3 rounded-lg text-left transition-all"
                  style={{
                    background: boardType === type ? 'var(--christmas-green)' : 'var(--bg-primary)',
                    color: boardType === type ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                    border: `1px solid ${boardType === type ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                  }}
                >
                  <div className="text-lg mb-1">{BOARD_TYPE_EMOJI[type]}</div>
                  <div className="text-sm font-medium">{BOARD_TYPE_LABELS[type]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Public URL Slug */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Public Link
            </label>
            <div
              className="flex items-center rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-default)', background: 'var(--bg-primary)' }}
            >
              <span
                className="px-3 py-2 text-sm whitespace-nowrap shrink-0"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}
              >
                celebrations.christmasair.com/b/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
                )}
                className="flex-1 px-3 py-2 text-sm bg-transparent border-none focus:outline-none"
                style={{ color: 'var(--text-primary)' }}
                placeholder="my-board-slug"
              />
            </div>
          </div>

          {/* Honoree Name */}
          {(boardType === 'birthday' || boardType === 'farewell') && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Honoree Name
              </label>
              <input
                type="text"
                value={honoreeName}
                onChange={(e) => setHonoreeName(e.target.value)}
                className="input"
                placeholder="Who is this board for?"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="Optional description for the board"
            />
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Event Date
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Visibility
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('internal')}
                className="flex-1 p-3 rounded-lg text-sm transition-all"
                style={{
                  background: visibility === 'internal' ? 'var(--christmas-green)' : 'var(--bg-primary)',
                  color: visibility === 'internal' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  border: `1px solid ${visibility === 'internal' ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                }}
              >
                <div className="font-medium">Internal Only</div>
                <div className="text-xs mt-1 opacity-75">Team members must be logged in</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className="flex-1 p-3 rounded-lg text-sm transition-all"
                style={{
                  background: visibility === 'public' ? 'var(--christmas-green)' : 'var(--bg-primary)',
                  color: visibility === 'public' ? 'var(--christmas-cream)' : 'var(--text-secondary)',
                  border: `1px solid ${visibility === 'public' ? 'var(--christmas-green)' : 'var(--border-default)'}`,
                }}
              >
                <div className="font-medium">Public</div>
                <div className="text-xs mt-1 opacity-75">Anyone with the link can view &amp; contribute</div>
              </button>
            </div>
          </div>

          {/* Allow Anonymous */}
          {visibility === 'public' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAllowAnonymous(!allowAnonymous)}
                className="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                style={{
                  background: allowAnonymous ? 'var(--christmas-green)' : 'var(--bg-primary)',
                  borderColor: allowAnonymous ? 'var(--christmas-green)' : 'var(--border-default)',
                }}
              >
                {allowAnonymous && (
                  <svg className="w-3 h-3" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Allow anonymous contributions (no name required)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary px-6"
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
