import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';

/**
 * GET /api/gbp/locations
 * List all configured Google Business Profile locations
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  // Get locations that have Google account/location IDs configured
  const { data, error } = await supabase
    .from('google_locations')
    .select('*')
    .not('google_account_id', 'is', null)
    .not('google_location_id', 'is', null)
    .order('display_order');

  if (error) {
    console.error('Failed to fetch locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    locations: data || [],
    total: data?.length || 0,
  });
}
