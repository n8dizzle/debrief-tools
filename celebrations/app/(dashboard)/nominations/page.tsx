'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CelNominationPeriod } from '@/lib/supabase';
import PeriodCard from '@/components/PeriodCard';

export default function NominationsPage() {
  const router = useRouter();
  const { isManager, isOwner, isLoading: authLoading } = useCelebrationsPermissions();
  const [periods, setPeriods] = useState<CelNominationPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = isManager || isOwner;

  useEffect(() => {
    if (!authLoading && !canManage) {
      router.replace('/nominations/submit');
    }
  }, [authLoading, canManage, router]);

  useEffect(() => {
    if (!authLoading && canManage) loadPeriods();
  }, [authLoading, canManage]);

  async function loadPeriods() {
    try {
      const res = await fetch('/api/nominations/periods');
      if (res.ok) {
        const data = await res.json();
        setPeriods(data.periods);
      }
    } catch (err) {
      console.error('Failed to load periods:', err);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading || !canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--christmas-green)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
            Nomination Periods
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage Value Champion nomination periods
          </p>
        </div>
        <button
          onClick={() => router.push('/nominations/periods/new')}
          className="btn btn-primary"
        >
          New Period
        </button>
      </div>

      {periods.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="text-4xl mb-3">🏆</div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
            No Periods Yet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Create your first nomination period to start collecting nominations.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {periods.map((period) => (
            <PeriodCard key={period.id} period={period} isManager />
          ))}
        </div>
      )}
    </div>
  );
}
