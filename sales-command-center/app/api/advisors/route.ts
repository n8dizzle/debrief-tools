import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, DbComfortAdvisor } from '@/lib/supabase';
import { ComfortAdvisor } from '@/types';

// Transform database advisor to app advisor format
function dbToAppAdvisor(dbAdvisor: DbComfortAdvisor): ComfortAdvisor {
  return {
    id: dbAdvisor.id,
    name: dbAdvisor.name,
    email: dbAdvisor.email,
    phone: dbAdvisor.phone || '',
    avatar: dbAdvisor.avatar || undefined,
    active: dbAdvisor.active,
    inQueue: dbAdvisor.in_queue ?? true,
    tglQueuePosition: dbAdvisor.tgl_queue_position,
    marketedQueuePosition: dbAdvisor.marketed_queue_position,
    salesMTD: Number(dbAdvisor.sales_mtd) || 0,
    averageSale: Number(dbAdvisor.average_sale) || 0,
    closingRate: Number(dbAdvisor.closing_rate) || 0,
    salesOpps: Number(dbAdvisor.sales_opps) || 0,
    totalLeads: dbAdvisor.total_leads,
    soldLeads: dbAdvisor.sold_leads,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('comfort_advisors')
      .select('*')
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching advisors:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const advisors = (data || []).map(dbToAppAdvisor);
    return NextResponse.json({ advisors });
  } catch (error: any) {
    console.error('Error in GET /api/advisors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Get the next queue position
    const { data: maxPositions } = await supabase
      .from('comfort_advisors')
      .select('tgl_queue_position, marketed_queue_position')
      .eq('active', true)
      .order('tgl_queue_position', { ascending: false })
      .limit(1);

    const nextPosition = maxPositions && maxPositions.length > 0
      ? Math.max(maxPositions[0].tgl_queue_position, maxPositions[0].marketed_queue_position) + 1
      : 1;

    const { data, error } = await supabase
      .from('comfort_advisors')
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone,
        avatar: body.avatar,
        active: body.active ?? true,
        tgl_queue_position: nextPosition,
        marketed_queue_position: nextPosition,
        sales_mtd: body.salesMTD || 0,
        closing_rate: body.closingRate || 0,
        total_leads: body.totalLeads || 0,
        sold_leads: body.soldLeads || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating advisor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, advisor: dbToAppAdvisor(data) });
  } catch (error: any) {
    console.error('Error in POST /api/advisors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Advisor ID required' }, { status: 400 });
    }

    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.inQueue !== undefined) dbUpdates.in_queue = updates.inQueue;
    if (updates.tglQueuePosition !== undefined) dbUpdates.tgl_queue_position = updates.tglQueuePosition;
    if (updates.marketedQueuePosition !== undefined) dbUpdates.marketed_queue_position = updates.marketedQueuePosition;
    if (updates.salesMTD !== undefined) dbUpdates.sales_mtd = updates.salesMTD;
    if (updates.averageSale !== undefined) dbUpdates.average_sale = updates.averageSale;
    if (updates.closingRate !== undefined) dbUpdates.closing_rate = updates.closingRate;
    if (updates.salesOpps !== undefined) dbUpdates.sales_opps = updates.salesOpps;
    if (updates.totalLeads !== undefined) dbUpdates.total_leads = updates.totalLeads;
    if (updates.soldLeads !== undefined) dbUpdates.sold_leads = updates.soldLeads;

    const { data, error } = await supabase
      .from('comfort_advisors')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating advisor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, advisor: dbToAppAdvisor(data) });
  } catch (error: any) {
    console.error('Error in PATCH /api/advisors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
