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

      {/* Tips Panel */}
      <details
        className="mb-6 rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <summary
          className="p-4 cursor-pointer text-sm font-semibold flex items-center gap-2"
          style={{ color: 'var(--christmas-gold)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Tips for a Great Board
        </summary>
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="pt-3 space-y-3">
            <div className="flex gap-3">
              <span className="text-lg shrink-0">1.</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Make your first post great
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Before inviting others, add a strong first post with a personal message and a photo, GIF, or video. Be specific — it sets the tone and shows people what kind of posts you&apos;re looking for.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-lg shrink-0">2.</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Pin a direction post
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Add a pinned post at the top with a brief description of the board&apos;s purpose and what you&apos;d love to see — favorite memories, shoutouts, photos from an event, etc. This gives contributors clear guidance.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-lg shrink-0">3.</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Set a deadline
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  When sharing the board link, include a deadline for submissions. A gentle time limit creates urgency and helps you plan when to present it. Use the Event Date field above to track this.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-lg shrink-0">4.</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Use Slack for easy contributions
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Link a Slack channel in Settings to automatically pull in messages, photos, and GIFs. Backfill lets you grab the best moments from past conversations. Posts from Slack go through a review queue so you can curate what appears.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-lg shrink-0">5.</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Present it live
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Use Present mode to display the board as a slideshow at a meeting or event. Share the public link so people can add posts in real-time while it plays. Pin the best posts so they&apos;re shown first.
                </p>
              </div>
            </div>
          </div>
        </div>
      </details>

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
