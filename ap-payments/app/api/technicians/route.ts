import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_technicians')
    .select('*')
    .eq('business_unit_id', 610)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const supabase = getServerSupabase();

  try {
    const [stTechnicians, businessUnits] = await Promise.all([
      st.getTechnicians(false),
      st.getAllBusinessUnits(),
    ]);
    const buNameMap = new Map(businessUnits.map(bu => [bu.id, bu.name]));
    let synced = 0;

    for (const tech of stTechnicians) {
      const buName = tech.businessUnitId ? buNameMap.get(tech.businessUnitId) || null : null;
      const { error } = await supabase
        .from('ap_technicians')
        .upsert(
          {
            st_technician_id: tech.id,
            name: tech.name,
            is_active: tech.active,
            business_unit_id: tech.businessUnitId || null,
            business_unit_name: buName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'st_technician_id', ignoreDuplicates: false }
        );

      if (!error) synced++;
    }

    return NextResponse.json({ success: true, synced, total: stTechnicians.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
