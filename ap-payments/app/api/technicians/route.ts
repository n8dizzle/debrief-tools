import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { hasAPPermission } from '@/lib/ap-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ?all=1 → every active technician (Settings management view).
  // default → only those flagged to show in the Install Jobs picker.
  const all = new URL(request.url).searchParams.get('all') === '1';

  const supabase = getServerSupabase();

  let query = supabase
    .from('ap_technicians')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (!all) query = query.eq('show_in_install', true);

  const { data, error } = await query;

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

  if (!hasAPPermission(session, 'can_sync_data')) {
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

    // Reconcile: ServiceTitan's technicians endpoint only returns ACTIVE techs, so anyone
    // deactivated/terminated drops out of the response. Flag any tech not in the active set
    // as inactive so they stop showing in the list.
    let deactivated = 0;
    const activeIds = stTechnicians.map((t) => t.id).filter((id) => id != null);
    if (activeIds.length > 0) {
      const { data: deact } = await supabase
        .from('ap_technicians')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true)
        .not('st_technician_id', 'in', `(${activeIds.join(',')})`)
        .select('id');
      deactivated = deact?.length || 0;
    }

    return NextResponse.json({ success: true, synced, deactivated, total: stTechnicians.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
