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

  // Build today's date in local time (Central Time - NOT UTC)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Start of this month
  const monthStart = `${year}-${month}-01`;

  // 7 days from now
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const wYear = weekFromNow.getFullYear();
  const wMonth = String(weekFromNow.getMonth() + 1).padStart(2, '0');
  const wDay = String(weekFromNow.getDate()).padStart(2, '0');
  const weekFromNowStr = `${wYear}-${wMonth}-${wDay}`;

  try {
    // Active onboardings count
    const { count: activeOnboardings } = await supabase
      .from('hr_onboardings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Overdue tasks: pending/in_progress tasks with due_date < today for active onboardings
    const { data: overdueTasks } = await supabase
      .from('hr_onboarding_tasks')
      .select('id, onboarding_id, hr_onboardings!inner(status)')
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', todayStr)
      .eq('hr_onboardings.status', 'active');

    const overdueCount = overdueTasks?.length || 0;

    // Due this week: tasks due in next 7 days for active onboardings
    const { data: dueThisWeekTasks } = await supabase
      .from('hr_onboarding_tasks')
      .select('id, onboarding_id, hr_onboardings!inner(status)')
      .in('status', ['pending', 'in_progress'])
      .gte('due_date', todayStr)
      .lte('due_date', weekFromNowStr)
      .eq('hr_onboardings.status', 'active');

    const dueThisWeekCount = dueThisWeekTasks?.length || 0;

    // Completed this month
    const { count: completedThisMonth } = await supabase
      .from('hr_onboardings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', `${monthStart}T00:00:00`);

    // Recent activity: last 10 entries with actor info
    const { data: recentActivity } = await supabase
      .from('hr_activity_log')
      .select('*, actor:portal_users!hr_activity_log_actor_id_fkey(id, name)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Active onboardings list with tasks for progress calculation
    const { data: activeOnboardingsList } = await supabase
      .from('hr_onboardings')
      .select(`
        *,
        portal_departments(id, name, slug),
        tasks:hr_onboarding_tasks(id, status, due_date, phase_name)
      `)
      .eq('status', 'active')
      .order('start_date', { ascending: true });

    // Compute progress for each onboarding
    const onboardingsWithProgress = (activeOnboardingsList || []).map((ob: any) => {
      const tasks = ob.tasks || [];
      const total = tasks.length;
      const completed = tasks.filter((t: any) => t.status === 'completed').length;
      const overdue = tasks.filter(
        (t: any) =>
          ['pending', 'in_progress'].includes(t.status) &&
          t.due_date &&
          t.due_date < todayStr
      ).length;
      return {
        ...ob,
        task_count: total,
        completed_count: completed,
        overdue_count: overdue,
        progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    return NextResponse.json({
      active_onboardings: activeOnboardings || 0,
      overdue_tasks: overdueCount,
      due_this_week: dueThisWeekCount,
      completed_this_month: completedThisMonth || 0,
      recent_activity: recentActivity || [],
      active_onboardings_list: onboardingsWithProgress,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
