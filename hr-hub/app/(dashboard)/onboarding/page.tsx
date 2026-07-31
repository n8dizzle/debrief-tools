'use client';

import nextDynamic from 'next/dynamic';

// The onboarding app is a ported client-only SPA — render it client-side only
// (no SSR) so its browser-dependent bits (chart.js, print/PDF) never run on the server.
const OnboardingApp = nextDynamic(() => import('@/components/onboarding/OnboardingApp'), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--text-secondary)', padding: 24 }}>Loading onboarding…</div>,
});

export default function OnboardingPage() {
  return <OnboardingApp />;
}
