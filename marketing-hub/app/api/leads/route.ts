import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/leads
 * Fetch leads with optional filters
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const trade = searchParams.get('trade');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    let query = supabase
      .from('master_leads')
      .select('*', { count: 'exact' })
      .eq('is_duplicate', false)
      .order('lead_created_at', { ascending: false });

    if (source) {
      query = query.eq('primary_source', source);
    }

    if (trade) {
      query = query.eq('trade', trade);
    }

    if (status) {
      query = query.eq('lead_status', status);
    }

    if (startDate) {
      query = query.gte('lead_created_at', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('lead_created_at', `${endDate}T23:59:59Z`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      leads: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
