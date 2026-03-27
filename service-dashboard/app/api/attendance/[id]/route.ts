import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  const permissions = (session.user as any)?.permissions?.service_dashboard;
  const canManage = role === 'owner' || role === 'manager' || permissions?.can_manage_attendance === true;

  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();
  const performedBy = session.user.email || (session.user as any).name || 'unknown';

  // Fetch record before deleting so we can log it
  const { data: record } = await supabase
    .from('sd_attendance_records')
    .select('*')
    .eq('id', id)
    .single();

  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('sd_attendance_records')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await supabase.from('sd_attendance_audit_log').insert({
    record_id: id,
    technician_id: record.technician_id,
    action: 'removed',
    record_data: {
      date: record.date,
      type: record.type,
      points: record.points,
      notes: record.notes,
      originally_created_by: record.created_by,
      originally_created_at: record.created_at,
    },
    performed_by: performedBy,
  });

  return NextResponse.json({ success: true });
}
