import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatLocalDate } from '@/lib/hr-utils';

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('authorization');
  const session = await getServerSession(authOptions);
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}` && !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleReminders();
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('authorization');
  const session = await getServerSession(authOptions);
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}` && !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return handleReminders();
}

async function handleReminders() {
  const supabase = getServerSupabase();
  const todayStr = formatLocalDate(new Date());

  try {
    // Find all overdue tasks for active onboardings
    const { data: overdueTasks, error } = await supabase
      .from('hr_onboarding_tasks')
      .select(`
        id,
        title,
        due_date,
        assigned_to,
        phase_name,
        onboarding_id,
        hr_onboardings!inner(
          id,
          employee_name,
          position_title,
          status
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', todayStr)
      .eq('hr_onboardings.status', 'active')
      .not('assigned_to', 'is', null);

    if (error) {
      console.error('Error fetching overdue tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch overdue tasks' }, { status: 500 });
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      return NextResponse.json({ message: 'No overdue tasks found', reminders_sent: 0 });
    }

    // Group tasks by assigned_to user
    const tasksByUser = new Map<string, any[]>();
    for (const task of overdueTasks) {
      if (!task.assigned_to) continue;
      const existing = tasksByUser.get(task.assigned_to) || [];
      existing.push(task);
      tasksByUser.set(task.assigned_to, existing);
    }

    // Fetch user emails
    const userIds = Array.from(tasksByUser.keys());
    const { data: users } = await supabase
      .from('portal_users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    let remindersSent = 0;

    for (const [userId, tasks] of tasksByUser) {
      const user = userMap.get(userId);
      if (!user || !user.email) continue;

      // Build task list for the email
      const taskLines = tasks.map((t: any) => {
        const onboarding = t.hr_onboardings;
        return `- ${t.title} (${onboarding.employee_name} - ${onboarding.position_title}) — Due: ${t.due_date}`;
      });

      const subject = `HR Hub: You have ${tasks.length} overdue onboarding task${tasks.length > 1 ? 's' : ''}`;
      const body = `Hi ${user.name},\n\nYou have ${tasks.length} overdue onboarding task${tasks.length > 1 ? 's' : ''}:\n\n${taskLines.join('\n')}\n\nPlease log into HR Hub to complete these tasks.\n\nhttps://hr.christmasair.com/my-tasks`;

      // Try to send via Resend if configured
      if (process.env.RESEND_API_KEY) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'HR Hub <notifications@christmasair.com>',
              to: [user.email],
              subject,
              text: body,
            }),
          });

          if (response.ok) {
            remindersSent++;

            // Log each notification
            for (const task of tasks) {
              await supabase.from('hr_notification_log').insert({
                onboarding_id: task.onboarding_id,
                task_id: task.id,
                recipient_email: user.email,
                channel: 'email',
                notification_type: 'overdue_reminder',
                subject,
                body,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });
            }
          } else {
            console.error('Resend error:', await response.text());
            // Log as failed
            for (const task of tasks) {
              await supabase.from('hr_notification_log').insert({
                onboarding_id: task.onboarding_id,
                task_id: task.id,
                recipient_email: user.email,
                channel: 'email',
                notification_type: 'overdue_reminder',
                subject,
                body,
                status: 'failed',
              });
            }
          }
        } catch (emailError) {
          console.error('Email send error:', emailError);
        }
      } else {
        console.log(`[DRY RUN] Would send reminder to ${user.email}: ${subject}`);
        // Log as dry run
        for (const task of tasks) {
          await supabase.from('hr_notification_log').insert({
            onboarding_id: task.onboarding_id,
            task_id: task.id,
            recipient_email: user.email,
            channel: 'email',
            notification_type: 'overdue_reminder',
            subject,
            body,
            status: 'skipped',
          });
        }
      }
    }

    return NextResponse.json({
      message: `Processed ${tasksByUser.size} users with overdue tasks`,
      reminders_sent: remindersSent,
      total_overdue_tasks: overdueTasks.length,
      users_notified: tasksByUser.size,
    });
  } catch (error) {
    console.error('Cron reminders error:', error);
    return NextResponse.json(
      { error: 'Reminders failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
