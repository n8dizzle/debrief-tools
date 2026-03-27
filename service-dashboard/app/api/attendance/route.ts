import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, DEFAULT_INFRACTION_TYPES, type InfractionTypeConfig } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const techId = searchParams.get('techId');
  const audit = searchParams.get('audit');

  const supabase = getServerSupabase();

  // Return audit log
  if (audit === 'true') {
    const { data: logs } = await supabase
      .from('sd_attendance_audit_log')
      .select('*')
      .order('performed_at', { ascending: false })
      .limit(50);

    // Resolve technician names
    const techIds = [...new Set((logs || []).map(l => l.technician_id))];
    const { data: techs } = await supabase
      .from('sd_technicians')
      .select('id, name')
      .in('id', techIds);

    const nameMap = new Map((techs || []).map(t => [t.id, t.name]));
    const enriched = (logs || []).map(l => ({
      ...l,
      technician_name: nameMap.get(l.technician_id) || 'Unknown',
    }));

    return NextResponse.json({ audit_log: enriched });
  }

  // If techId provided, return full history for that tech
  if (techId) {
    const { data: records, error } = await supabase
      .from('sd_attendance_records')
      .select('*')
      .eq('technician_id', techId)
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ records: records || [] });
  }

  // Otherwise, return all active techs with their cumulative points
  const { data: techs } = await supabase
    .from('sd_technicians')
    .select('id, st_technician_id, name, trade')
    .eq('is_active', true)
    .order('name');

  const { data: records } = await supabase
    .from('sd_attendance_records')
    .select('*')
    .order('date', { ascending: false });

  // Group records by technician and compute totals
  const recordsByTech = new Map<string, typeof records>();
  for (const record of (records || [])) {
    const existing = recordsByTech.get(record.technician_id) || [];
    existing.push(record);
    recordsByTech.set(record.technician_id, existing);
  }

  const techSummaries = (techs || []).map(tech => {
    const techRecords = recordsByTech.get(tech.id) || [];
    const totalPoints = techRecords.reduce((sum, r) => sum + (r.points || 0), 0);
    const lastInfraction = techRecords.find(r => r.points > 0);

    return {
      id: tech.id,
      st_technician_id: tech.st_technician_id,
      name: tech.name,
      trade: tech.trade,
      total_points: Math.max(0, totalPoints), // Floor at 0
      record_count: techRecords.length,
      last_infraction_date: lastInfraction?.date || null,
      records: techRecords,
    };
  });

  return NextResponse.json({ technicians: techSummaries });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check permission: owner, manager, or explicit can_manage_attendance
  const role = (session.user as any).role;
  const permissions = (session.user as any)?.permissions?.service_dashboard;
  const canManage = role === 'owner' || role === 'manager' || permissions?.can_manage_attendance === true;

  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { technician_id, date, type, notes } = body;

  if (!technician_id || !date || !type) {
    return NextResponse.json({ error: 'technician_id, date, and type are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Load infraction types from DB config
  const { data: configRow } = await supabase
    .from('sd_attendance_config')
    .select('infraction_types')
    .limit(1)
    .single();

  const infractionTypes: InfractionTypeConfig[] = configRow?.infraction_types || DEFAULT_INFRACTION_TYPES;
  const config = infractionTypes.find(t => t.key === type);
  if (!config) {
    return NextResponse.json({ error: 'Invalid infraction type' }, { status: 400 });
  }

  const performedBy = session.user.email || (session.user as any).name || 'unknown';

  const { data, error } = await supabase
    .from('sd_attendance_records')
    .insert({
      technician_id,
      date,
      type,
      points: config.points,
      notes: notes || null,
      created_by: performedBy,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await supabase.from('sd_attendance_audit_log').insert({
    record_id: data.id,
    technician_id,
    action: 'added',
    record_data: { date, type, points: config.points, notes: notes || null },
    performed_by: performedBy,
  });

  return NextResponse.json({ record: data });
}
