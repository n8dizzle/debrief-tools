import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

// POST /api/onboarding - Create contractor record after signup
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if contractor already exists
    const { data: existing } = await supabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Contractor record already exists' }, { status: 409 });
    }

    const body = await request.json();
    const {
      business_name,
      owner_name,
      phone,
      trade_ids,
      zip_codes,
    } = body;

    if (!business_name || !owner_name) {
      return NextResponse.json({ error: 'business_name and owner_name are required' }, { status: 400 });
    }

    // Create contractor record
    const { data: contractor, error: createError } = await supabase
      .from('contractors')
      .insert({
        user_id: user.id,
        business_name,
        owner_name,
        phone: phone || null,
        email: user.email,
        verification_status: 'pending',
        is_active: false,
        rating_overall: null,
        review_count: 0,
        jobs_completed: 0,
        member_since: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Insert trades
    if (trade_ids && Array.isArray(trade_ids) && trade_ids.length > 0) {
      const tradeRows = trade_ids.map((departmentId: string) => ({
        contractor_id: contractor.id,
        department_id: departmentId,
      }));

      const { error: tradeError } = await supabase
        .from('contractor_trades')
        .insert(tradeRows);

      if (tradeError) {
        console.error('Error inserting trades:', tradeError);
      }
    }

    // Insert service areas (zip codes)
    if (zip_codes && Array.isArray(zip_codes) && zip_codes.length > 0) {
      const zipRows = zip_codes.map((zip: string) => ({
        contractor_id: contractor.id,
        zip_code: zip,
        is_active: true,
      }));

      const { error: zipError } = await supabase
        .from('contractor_service_areas')
        .insert(zipRows);

      if (zipError) {
        console.error('Error inserting zip codes:', zipError);
      }
    }

    // Initialize default weekly availability (Mon-Fri 8-5, Sat 9-2, Sun off)
    const defaultSchedule = [
      { day_of_week: 0, start_time: '09:00', end_time: '14:00', is_available: false }, // Sunday
      { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_available: true },  // Monday
      { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_available: true },  // Tuesday
      { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_available: true },  // Wednesday
      { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_available: true },  // Thursday
      { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_available: true },  // Friday
      { day_of_week: 6, start_time: '09:00', end_time: '14:00', is_available: true },  // Saturday
    ];

    const availabilityRows = defaultSchedule.map((day) => ({
      contractor_id: contractor.id,
      ...day,
    }));

    const { error: availError } = await supabase
      .from('contractor_availability')
      .insert(availabilityRows);

    if (availError) {
      console.error('Error inserting default availability:', availError);
    }

    // Update user metadata to indicate onboarding complete
    await supabase.auth.updateUser({
      data: {
        business_name,
        owner_name,
        onboarding_complete: true,
      },
    });

    return NextResponse.json({ contractor }, { status: 201 });
  } catch (err) {
    console.error('POST /api/onboarding error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
