'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Home {
  id: string;
  nickname: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  home_type: string;
  year_built: number | null;
  sqft: number | null;
  square_footage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  stories: number | null;
  is_primary: boolean;
  created_at: string;
}

const HOME_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  townhouse: 'Townhouse',
  condo: 'Condo',
  apartment: 'Apartment',
  mobile_home: 'Mobile Home',
  other: 'Other',
};

function HomeCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-5 dark:bg-[var(--hw-bg)]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[var(--hw-bg-tertiary)]" />
        <div className="h-4 w-24 rounded bg-[var(--hw-bg-tertiary)]" />
      </div>
      <div className="mt-3 h-3 w-full rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-3 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="h-3 w-20 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
        <div className="h-3 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
      </div>
    </div>
  );
}

export default function HomesPage() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomes() {
      try {
        const res = await fetch('/api/homes');
        if (res.ok) {
          const data = await res.json();
          setHomes(data.homes || data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch homes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHomes();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--hw-text)]">My Homes</h1>
          <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
            Manage your properties to get personalized service recommendations.
          </p>
        </div>
        <Link
          href="/homes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Home
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HomeCardSkeleton />
          <HomeCardSkeleton />
          <HomeCardSkeleton />
        </div>
      ) : homes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hw-border)] bg-white py-16 text-center dark:bg-[var(--hw-bg)]">
          <svg className="h-16 w-16 text-[var(--hw-text-tertiary)]" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-[var(--hw-text)]">No homes yet</h3>
          <p className="mt-1 max-w-sm text-sm text-[var(--hw-text-secondary)]">
            Add your home to get matched with the right services and see personalized pricing.
          </p>
          <Link
            href="/homes/new"
            className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Add your first home
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((home) => (
            <Link
              key={home.id}
              href={`/homes/${home.id}`}
              className="flex flex-col rounded-xl border border-[var(--hw-border)] bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:bg-[var(--hw-bg)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[var(--hw-text)]">
                      {home.nickname || home.address_line1}
                    </h3>
                    {home.is_primary && (
                      <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Primary
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-[var(--hw-text-secondary)]">
                {home.address_line1}
                {home.address_line2 ? `, ${home.address_line2}` : ''}
              </p>
              <p className="text-sm text-[var(--hw-text-secondary)]">
                {home.city}, {home.state} {home.zip_code}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[var(--hw-border)] pt-4 text-xs text-[var(--hw-text-tertiary)]">
                {(home.sqft ?? home.square_footage) != null && (
                  <span>{((home.sqft ?? home.square_footage) as number).toLocaleString()} sqft</span>
                )}
                {home.year_built != null && <span>Built {home.year_built}</span>}
                {home.bedrooms != null && (
                  <span>{home.bedrooms} bed{home.bedrooms !== 1 ? 's' : ''}</span>
                )}
                {home.bathrooms != null && (
                  <span>{home.bathrooms} bath{home.bathrooms !== 1 ? 's' : ''}</span>
                )}
                {home.home_type && (
                  <span>{HOME_TYPE_LABELS[home.home_type] || home.home_type}</span>
                )}
                {home.stories != null && (
                  <span>{home.stories} stor{home.stories !== 1 ? 'ies' : 'y'}</span>
                )}
              </div>
            </Link>
          ))}

          {/* Add Home card */}
          <Link
            href="/homes/new"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hw-border)] bg-white p-5 text-[var(--hw-text-secondary)] transition-colors hover:border-primary hover:text-primary dark:bg-[var(--hw-bg)]"
          >
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="mt-2 text-sm font-medium">Add another home</span>
          </Link>
        </div>
      )}
    </div>
  );
}
