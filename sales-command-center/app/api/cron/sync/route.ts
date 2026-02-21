import { NextResponse } from 'next/server';

/**
 * Vercel Cron endpoint — runs every 2 minutes in production.
 * Internally calls the poll endpoint to import new leads and sync pipeline statuses.
 *
 * Vercel sends GET requests to cron routes, so we proxy to the POST poll endpoint.
 */
export async function GET() {
  // Verify this is a legitimate Vercel cron invocation
  // (Optional: check CRON_SECRET header for security)

  try {
    const baseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');

    const response = await fetch(`${baseUrl}/api/leads/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (error: any) {
    console.error('Cron sync failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
