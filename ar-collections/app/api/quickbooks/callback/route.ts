import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { QuickBooksClient, getQuickBooksClient } from '@/lib/quickbooks';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/quickbooks/callback
 * OAuth callback handler - exchanges code for tokens and stores credentials
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/settings?error=unauthorized', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('[QuickBooks Callback] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !realmId) {
      console.error('[QuickBooks Callback] Missing code or realmId');
      return NextResponse.redirect(
        new URL('/settings?error=missing_params', request.url)
      );
    }

    // Validate state parameter
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        // Check state timestamp isn't too old (10 minute expiry)
        if (Date.now() - decoded.timestamp > 10 * 60 * 1000) {
          return NextResponse.redirect(
            new URL('/settings?error=state_expired', request.url)
          );
        }
      } catch {
        console.warn('[QuickBooks Callback] Invalid state parameter');
      }
    }

    console.log('[QuickBooks Callback] Exchanging code for tokens...');

    // Exchange code for tokens
    const tokens = await QuickBooksClient.exchangeCodeForTokens(code, realmId);

    // Calculate expiry times
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + tokens.x_refresh_token_expires_in * 1000);

    // Store credentials in database
    const supabase = getServerSupabase();

    // Delete any existing credentials first (only allow one connection)
    await supabase.from('ar_quickbooks_credentials').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert new credentials
    const { error: insertError } = await supabase
      .from('ar_quickbooks_credentials')
      .insert({
        realm_id: realmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[QuickBooks Callback] Failed to store credentials:', insertError);
      return NextResponse.redirect(
        new URL('/settings?error=storage_failed', request.url)
      );
    }

    console.log('[QuickBooks Callback] Credentials stored, fetching company info...');

    // Get company info to store company name
    try {
      const client = await getQuickBooksClient();
      const companyInfo = await client.testConnection();

      await supabase
        .from('ar_quickbooks_credentials')
        .update({ company_name: companyInfo.CompanyName })
        .eq('realm_id', realmId);

      console.log('[QuickBooks Callback] Connected to:', companyInfo.CompanyName);
    } catch (companyError) {
      console.warn('[QuickBooks Callback] Could not fetch company info:', companyError);
    }

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?qb=connected', request.url)
    );
  } catch (error) {
    console.error('[QuickBooks Callback] Error:', error);
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    );
  }
}
