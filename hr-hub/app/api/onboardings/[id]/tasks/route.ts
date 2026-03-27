import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;

  // Verify onboarding exists
  const { data: onboarding } = await supabase
    .from('hr_onboardings')
    .select('id')
    .eq('id', id)
    .single();

  if (!onboarding) {
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  const { data: tasks, error } = await supabase
    .from('hr_onboarding_tasks')
    .select(`
      *,
      assigned_user:portal_users!hr_onboarding_tasks_assigned_to_fkey(id, name, email)
    `)
    .eq('onboarding_id', id)
    .order('phase_sort_order', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }

  return NextResponse.json(tasks || []);
}
