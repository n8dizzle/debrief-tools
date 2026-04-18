"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";
import { initSentryBrowser } from "@/sentry.client.config";

/**
 * Mounts once at the root layout. Boots PostHog + Sentry browser SDK.
 * Both are no-ops when their respective DSN/key env vars aren't set.
 */
export default function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initAnalytics();
    initSentryBrowser();
  }, []);

  return <>{children}</>;
}
