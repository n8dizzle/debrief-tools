import { NextResponse } from 'next/server';

/**
 * Legacy Slack notification endpoint — DISABLED.
 * Lead notifications now go via DMs directly from the poll/route.ts cron.
 * This endpoint is kept for backwards compatibility but does nothing.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    skipped: true,
    message: 'Legacy endpoint — lead DMs are now handled by the poll cron',
  });
}
