/**
 * Next.js calls register() once at server startup. Inits Sentry for the Node
 * runtime so unhandled errors are captured. Edge runtime is intentionally
 * skipped — this app has no edge handlers, and @sentry/node isn't edge-safe.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
