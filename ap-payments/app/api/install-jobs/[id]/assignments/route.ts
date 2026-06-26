import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * POST /api/install-jobs/[id]/assignments — add a technician or subcontractor to a job.
 * Body: { assignee_type: 'technician'|'subcontractor', technician_id? , contractor_id? }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_assignments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: jobId } = await params;
  const body = await request.json();
  const { assignee_type, technician_id, contractor_id } = body;

  if (assignee_type === 'technician' && !technician_id) {
    return NextResponse.json({ error: 'technician_id required' }, { status: 400 });
  }
  if (assignee_type === 'subcontractor' && !contractor_id) {
    return NextResponse.json({ error: 'contractor_id required' }, { status: 400 });
  }
  if (!['technician', 'subcontractor'].includes(assignee_type)) {
    return NextResponse.json({ error: 'invalid assignee_type' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: job } = await supabase.from('ap_install_jobs').select('id').eq('id', jobId).single();
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const { data: created, error } = await supabase
    .from('ap_job_assignments')
    .insert({
      job_id: jobId,
      assignee_type,
      technician_id: assignee_type === 'technician' ? technician_id : null,
      contractor_id: assignee_type === 'subcontractor' ? contractor_id : null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(`id, assignee_type, technician_id, contractor_id, technician:ap_technicians(name), contractor:ap_contractors(name)`)
    .single();

  if (error) {
    // Unique index → already assigned
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already assigned to this job' }, { status: 409 });
    }
    console.error('Assignment insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const name =
    created.assignee_type === 'technician' ? (created as any).technician?.name : (created as any).contractor?.name;

  await supabase.from('ap_activity_log').insert({
    job_id: jobId,
    contractor_id: assignee_type === 'subcontractor' ? contractor_id : null,
    action: 'crew_assigned',
    description: `Added ${assignee_type === 'technician' ? 'technician' : 'subcontractor'} ${name || ''} to the job`,
    new_value: JSON.stringify({ assignee_type, name }),
    performed_by: session.user.id,
  });

  return NextResponse.json({
    id: created.id,
    type: created.assignee_type,
    technician_id: created.technician_id,
    contractor_id: created.contractor_id,
    name,
  }, { status: 201 });
}
