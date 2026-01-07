import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleBusinessClient } from '@/lib/google-business';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/reviews/discover
 * Discover Google Business Profile accounts and locations
 * Use this to find your account_id and location_id values
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = session.user as { role?: string };
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const client = getGoogleBusinessClient();

  if (!client.isConfigured()) {
    return NextResponse.json({
      error: 'Google Business Profile API not configured',
      setup_instructions: {
        step1: 'Go to Google Cloud Console and enable: Google Business Profile API, My Business Account Management API, My Business Business Information API',
        step2: 'Create OAuth 2.0 credentials (Web application type)',
        step3: 'Add https://developers.google.com/oauthplayground as authorized redirect URI',
        step4: 'Go to OAuth Playground, use your credentials, authorize scope: https://www.googleapis.com/auth/business.manage',
        step5: 'Exchange for tokens and copy the refresh_token',
        step6: 'Add to .env: GOOGLE_BUSINESS_CLIENT_ID, GOOGLE_BUSINESS_CLIENT_SECRET, GOOGLE_BUSINESS_REFRESH_TOKEN',
      },
    }, { status: 500 });
  }

  try {
    // Get all accounts
    const accountsResponse = await client.listAccounts();
    const accounts = accountsResponse.accounts || [];

    const result: {
      accounts: Array<{
        account_id: string;
        account_name: string;
        locations: Array<{
          location_id: string;
          location_name: string;
          address?: string;
          place_id?: string;
        }>;
      }>;
    } = { accounts: [] };

    // For each account, get locations
    for (const account of accounts) {
      const accountId = account.name; // e.g., "accounts/123456789"

      try {
        const locationsResponse = await client.listLocations(accountId);
        const locations = locationsResponse.locations || [];

        result.accounts.push({
          account_id: accountId,
          account_name: account.accountName || accountId,
          locations: locations.map((loc: {
            name?: string;
            locationName?: string;
            address?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
            metadata?: { placeId?: string };
          }) => ({
            location_id: loc.name || '',
            location_name: loc.locationName || '',
            address: loc.address
              ? `${loc.address.addressLines?.join(', ') || ''}, ${loc.address.locality || ''}, ${loc.address.administrativeArea || ''}`
              : undefined,
            place_id: loc.metadata?.placeId,
          })),
        });
      } catch (locError) {
        console.error(`Failed to get locations for ${accountId}:`, locError);
        result.accounts.push({
          account_id: accountId,
          account_name: account.accountName || accountId,
          locations: [],
        });
      }
    }

    return NextResponse.json({
      message: 'Discovery complete. Use these IDs to configure your locations in the database.',
      instructions: 'Update the google_locations table with google_account_id and google_location_id for each location.',
      ...result,
    });
  } catch (error) {
    console.error('Discovery error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Discovery failed',
    }, { status: 500 });
  }
}

/**
 * POST /api/reviews/discover
 * Auto-match discovered locations with database locations
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = session.user as { role?: string };
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const body = await request.json();
  const { mappings } = body;

  // mappings should be: [{ db_location_id, google_account_id, google_location_id, place_id? }]
  if (!mappings || !Array.isArray(mappings)) {
    return NextResponse.json({ error: 'Mappings array required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const mapping of mappings) {
    const { db_location_id, google_account_id, google_location_id, place_id } = mapping;

    const { error } = await supabase
      .from('google_locations')
      .update({
        google_account_id,
        google_location_id,
        place_id: place_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', db_location_id);

    results.push({
      id: db_location_id,
      success: !error,
      error: error?.message,
    });
  }

  return NextResponse.json({
    message: 'Mappings updated',
    results,
  });
}
