'use client';

import { useState, useEffect } from 'react';
import { CelNomination } from '@/lib/supabase';
import NominationCard from '@/components/NominationCard';

export default function MyNominationsPage() {
  const [nominations, setNominations] = useState<CelNomination[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadNominations() {
    try {
      const res = await fetch('/api/nominations');
      if (res.ok) {
        const data = await res.json();
        setNominations(data.nominations);
      }
    } catch (err) {
      console.error('Failed to load nominations:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNominations();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this nomination?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/nominations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNominations((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--christmas-cream)' }}>
        My Nominations
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Nominations you&apos;ve submitted
      </p>

      {nominations.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-4xl mb-3">📝</div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            No Nominations Yet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            You haven&apos;t submitted any nominations yet. Head to the Nominate page to recognize a teammate!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {nominations.map((nomination) => (
            <NominationCard
              key={nomination.id}
              nomination={nomination}
              onDelete={handleDelete}
              deleting={deletingId === nomination.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
