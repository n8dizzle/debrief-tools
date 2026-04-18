"use client";

import posthog from "posthog-js";

let initialized = false;

/**
 * Initialize PostHog client. Idempotent. Skips if no key configured —
 * trackEvent then becomes a no-op so dev/staging without analytics keys
 * doesn't error.
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });
  initialized = true;
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  posthog.capture(name, properties);
}

export function identifyReferrer(referrerId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !initialized) return;
  posthog.identify(referrerId, traits);
}
