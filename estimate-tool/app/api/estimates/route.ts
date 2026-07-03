import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/estimates — list all estimates
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimates')
      .select('*, estimate_options(*)')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ estimates: data || [] });
  } catch (err) {
    console.error('[Estimates] List error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// POST /api/estimates — create a new estimate
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getServerSupabase();

    const { data: estimate, error } = await supabase
      .from('estimates')
      .insert({
        customer_name: body.customerName || '',
        customer_address: body.customerAddress || '',
        customer_phone: body.customerPhone || '',
        customer_email: body.customerEmail || '',
        advisor_name: body.advisorName || '',
        system_type: body.systemType || 'ac-furnace',
        tonnage: body.tonnage || 3,
        system_count: body.systemCount || 1,
        st_job_id: body.stJobId || null,
        st_job_number: body.stJobNumber || null,
        st_customer_id: body.stCustomerId || null,
        st_location_id: body.stLocationId || null,
        notes: body.notes || '',
        existing_system: body.existingSystem || '',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ estimate });
  } catch (err) {
    console.error('[Estimates] Create error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
