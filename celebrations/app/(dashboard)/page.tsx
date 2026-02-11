'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import BoardCard from '@/components/BoardCard';
import { CelBoard } from '@/lib/supabase';

export default function BoardListPage() {
  const { data: session } = useSession();
  const { canCreateBoards } = useCelebrationsPermissions();
  const [boards, setBoards] = useState<CelBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    fetchBoards();
  }, [filter]);

  async function fetchBoards() {
    setLoading(true);
    try {
      const res = await fetch(`/api/boards?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards);
      }
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Celebration Boards
          </h1>
          <p className="text-sm mt-1 hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
            Create boards for birthdays, milestones, farewells, and more
          </p>
        </div>

        {canCreateBoards && (
          <Link
            href="/boards/new"
            className="btn btn-primary gap-2 w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Board
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-full sm:w-fit" style={{ background: 'var(--bg-card)' }}>
        {(['active', 'archived'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-md text-sm font-medium transition-colors capitalize"
            style={{
              background: filter === tab ? 'var(--christmas-green)' : 'transparent',
              color: filter === tab ? 'var(--christmas-cream)' : 'var(--text-secondary)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Board Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse" style={{ height: '200px' }} />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            No {filter} boards yet
          </p>
          {canCreateBoards && filter === 'active' && (
            <Link href="/boards/new" className="btn btn-primary mt-4 inline-flex">
              Create Your First Board
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      )}
    </div>
  );
}
