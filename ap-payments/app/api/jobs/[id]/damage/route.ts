import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/jobs/[id]/damage — list damage entries for a job
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_damage_log')
    .select('*, reporter:portal_users!ap_damage_log_reported_by_fkey(name, email)')
    .eq('job_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    // If the foreign key alias doesn't work, try without join
    const { data: fallback } = await supabase
      .from('ap_damage_log')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false });
    return NextResponse.json(fallback || []);
  }

  return NextResponse.json(data || []);
}

/**
 * POST /api/jobs/[id]/damage — add a damage entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden — managers and owners only' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { description, repair_cost, notes } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }
  if (repair_cost == null || repair_cost < 0) {
    return NextResponse.json({ error: 'Repair cost must be >= 0' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get the job to find contractor_id
  const { data: job } = await supabase
    .from('ap_install_jobs')
    .select('contractor_id')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Insert damage entry
  const { data: entry, error } = await supabase
    .from('ap_damage_log')
    .insert({
      job_id: id,
      contractor_id: job.contractor_id,
      description: description.trim(),
      repair_cost,
      notes: notes?.trim() || null,
      reported_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recalculate damage_deduction on the job
  await recalcDamageDeduction(supabase, id);

  // Log activity
  await supabase.from('ap_activity_log').insert({
    job_id: id,
    contractor_id: job.contractor_id,
    action: 'damage_reported',
    description: `Damage reported: ${description.trim()} — repair cost $${Number(repair_cost).toFixed(2)}`,
    performed_by: session.user.id,
  });

  return NextResponse.json(entry, { status: 201 });
}

/**
 * Recalculate damage_deduction on ap_install_jobs from sum of ap_damage_log.repair_cost
 */
async function recalcDamageDeduction(supabase: ReturnType<typeof getServerSupabase>, jobId: string) {
  const { data } = await supabase
    .from('ap_damage_log')
    .select('repair_cost')
    .eq('job_id', jobId);

  const total = (data || []).reduce((sum, d) => sum + Number(d.repair_cost), 0);

  await supabase
    .from('ap_install_jobs')
    .update({ damage_deduction: Math.round(total * 100) / 100, updated_at: new Date().toISOString() })
    .eq('id', jobId);
}
