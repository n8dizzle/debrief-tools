'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BoardType, BOARD_TYPE_LABELS, BOARD_TYPE_EMOJI } from '@/lib/supabase';

const BOARD_TYPES: BoardType[] = ['birthday', 'company', 'farewell', 'holiday', 'custom'];

export default function NewBoardPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [boardType, setBoardType] = useState<BoardType>('birthday');
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal');
  const [honoreeName, setHonoreeName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [allowAnonymous, setAllowAnonymous] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          board_type: boardType,
          visibility,
          honoree_name: honoreeName,
          event_date: eventDate || null,
          allow_anonymous: allowAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create board');
      }

      const { board } = await res.json();
      router.push(`/boards/${board.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Create Celebration Board
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  background: boardType === type ? 'var(--christmas-green)' : 'var(--bg-card)',
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
            placeholder={boardType === 'birthday' ? "John's Birthday" : "Board title"}
            required
          />
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
                background: visibility === 'internal' ? 'var(--christmas-green)' : 'var(--bg-card)',
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
                background: visibility === 'public' ? 'var(--christmas-green)' : 'var(--bg-card)',
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
                background: allowAnonymous ? 'var(--christmas-green)' : 'var(--bg-card)',
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

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary px-6"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Board'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
