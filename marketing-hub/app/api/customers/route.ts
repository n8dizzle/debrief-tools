import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

/**
 * GET /api/customers
 * Fetch new customers with optional filters
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const type = searchParams.get('type'); // Residential, Commercial
  const campaign = searchParams.get('campaign');
  const city = searchParams.get('city');

  let query = supabase
    .from('new_customers')
    .select('*')
    .gt('lifetime_revenue', 0)
    .order('created_on', { ascending: false });

  if (start) query = query.gte('created_on', start);
  if (end) query = query.lte('created_on', end);
  if (type) query = query.eq('customer_type', type);
  if (campaign) query = query.eq('original_campaign', campaign);
  if (city) query = query.eq('city', city);

  const { data, error } = await query;

  if (error) {
    console.error('[Customers API] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: data });
}
