'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface AnalyticsTrackerProps {
  app: string;
}

export function AnalyticsTracker({ app }: AnalyticsTrackerProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lastTracked = useRef('');

  useEffect(() => {
    if (!session?.user?.email || !pathname) return;

    const key = `${app}:${pathname}`;
    if (key === lastTracked.current) return;
    lastTracked.current = key;

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, path: pathname }),
    }).catch(() => {});
  }, [pathname, session, app]);

  return null;
}
