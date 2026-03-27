import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data: tasks, error } = await supabase
    .from('hr_onboarding_tasks')
    .select(`
      *,
      hr_onboardings!inner(
        id,
        employee_name,
        position_title,
        start_date,
        status
      )
    `)
    .eq('assigned_to', session.user.id)
    .eq('hr_onboardings.status', 'active')
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching my tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }

  return NextResponse.json(tasks || []);
}
