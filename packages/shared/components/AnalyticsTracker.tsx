'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface AnalyticsTrackerProps {
  app: string;
}

/**
 * Tracks page views for analytics. Drop into any app's DashboardShell.
 * Fires on initial load and route changes. Debounces rapid navigations.
 */
export function AnalyticsTracker({ app }: AnalyticsTrackerProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lastTracked = useRef('');

  useEffect(() => {
    if (!session?.user?.email || !pathname) return;

    // Deduplicate same path
    const key = `${app}:${pathname}`;
    if (key === lastTracked.current) return;
    lastTracked.current = key;

    // Fire and forget
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, path: pathname }),
    }).catch(() => {
      // Silent fail - analytics should never break the app
    });
  }, [pathname, session, app]);

  return null;
}
