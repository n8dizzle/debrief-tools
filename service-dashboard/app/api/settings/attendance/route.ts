import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, DEFAULT_INFRACTION_TYPES, DEFAULT_THRESHOLDS } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('sd_attendance_config')
    .select('*')
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({
      infraction_types: DEFAULT_INFRACTION_TYPES,
      thresholds: DEFAULT_THRESHOLDS,
      rolling_months: 12,
    });
  }

  return NextResponse.json({
    infraction_types: data.infraction_types,
    thresholds: data.thresholds,
    rolling_months: data.rolling_months,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  const permissions = (session.user as any)?.permissions?.service_dashboard;
  const canManage = role === 'owner' || role === 'manager' || permissions?.can_manage_settings === true;

  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { infraction_types, thresholds, rolling_months } = body;

  // Validate infraction types
  if (!Array.isArray(infraction_types) || infraction_types.length === 0) {
    return NextResponse.json({ error: 'At least one infraction type is required' }, { status: 400 });
  }

  for (const t of infraction_types) {
    if (!t.key || !t.label || typeof t.points !== 'number') {
      return NextResponse.json({ error: 'Each infraction type needs key, label, and points' }, { status: 400 });
    }
  }

  // Validate thresholds
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    return NextResponse.json({ error: 'At least one threshold is required' }, { status: 400 });
  }

  for (const th of thresholds) {
    if (typeof th.points !== 'number' || !th.label) {
      return NextResponse.json({ error: 'Each threshold needs points and label' }, { status: 400 });
    }
  }

  if (typeof rolling_months !== 'number' || rolling_months < 1 || rolling_months > 36) {
    return NextResponse.json({ error: 'Rolling months must be between 1 and 36' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const performedBy = session.user.email || (session.user as any).name || 'unknown';

  // Get existing row ID
  const { data: existing } = await supabase
    .from('sd_attendance_config')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('sd_attendance_config')
      .update({
        infraction_types,
        thresholds: thresholds.sort((a: any, b: any) => a.points - b.points),
        rolling_months,
        updated_at: new Date().toISOString(),
        updated_by: performedBy,
      })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('sd_attendance_config')
      .insert({
        infraction_types,
        thresholds: thresholds.sort((a: any, b: any) => a.points - b.points),
        rolling_months,
        updated_by: performedBy,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
