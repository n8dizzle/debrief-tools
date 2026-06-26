import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * DELETE /api/install-jobs/[id]/assignments/[assignmentId] — remove a person from a job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_assignments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: jobId, assignmentId } = await params;
  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from('ap_job_assignments')
    .select(`id, assignee_type, technician:ap_technicians(name), contractor:ap_contractors(name)`)
    .eq('id', assignmentId)
    .eq('job_id', jobId)
    .single();

  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const { error } = await supabase.from('ap_job_assignments').delete().eq('id', assignmentId);
  if (error) {
    console.error('Assignment delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const name =
    existing.assignee_type === 'technician' ? (existing as any).technician?.name : (existing as any).contractor?.name;
  await supabase.from('ap_activity_log').insert({
    job_id: jobId,
    action: 'crew_unassigned',
    description: `Removed ${existing.assignee_type === 'technician' ? 'technician' : 'subcontractor'} ${name || ''} from the job`,
    old_value: JSON.stringify({ assignee_type: existing.assignee_type, name }),
    performed_by: session.user.id,
  });

  return NextResponse.json({ success: true });
}
