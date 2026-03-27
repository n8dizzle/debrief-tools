import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.hourly_rate !== undefined) {
    updates.hourly_rate = body.hourly_rate === null ? null : Number(body.hourly_rate);
  }
  if (body.trade !== undefined) {
    updates.trade = body.trade;
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_technicians')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If hourly_rate changed, recalculate labor_cost for this technician's jobs
  if (body.hourly_rate !== undefined) {
    const rate = Number(body.hourly_rate) || 0;
    if (rate > 0) {
      const { data: techJobs } = await supabase
        .from('ap_install_jobs')
        .select('id, labor_hours')
        .eq('technician_id', id)
        .not('labor_hours', 'is', null);

      if (techJobs && techJobs.length > 0) {
        for (const job of techJobs) {
          const cost = Math.round(Number(job.labor_hours) * rate * 100) / 100;
          await supabase
            .from('ap_install_jobs')
            .update({ labor_cost: cost })
            .eq('id', job.id);
        }
      }
    }
  }

  return NextResponse.json(data);
}
