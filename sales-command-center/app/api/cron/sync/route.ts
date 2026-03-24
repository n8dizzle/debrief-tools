import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * Vercel Cron endpoint — runs every 2 minutes in production.
 * Calls the poll endpoint internally, passing through the CRON_SECRET.
 *
 * Uses VERCEL_URL (the deployment-specific URL) to avoid any domain-level
 * middleware or deployment protection issues on the custom domain.
 */
export async function GET() {
  try {
    // Use the Vercel deployment URL (bypasses custom domain middleware)
    // Fall back to NEXT_PUBLIC_DASHBOARD_URL, then localhost
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001');

    const cronSecret = process.env.CRON_SECRET || '';

    const response = await fetch(`${baseUrl}/api/leads/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Cron poll failed: ${response.status}`, data);
    }

    return NextResponse.json({
      success: response.ok,
      timestamp: new Date().toISOString(),
      pollStatus: response.status,
      result: data,
    });
  } catch (error: any) {
    console.error('Cron sync failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
