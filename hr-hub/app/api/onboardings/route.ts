import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { addDays } from '@/lib/hr-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const supabase = getServerSupabase();

  let query = supabase
    .from('hr_onboardings')
    .select(`
      *,
      portal_departments(id, name, slug),
      hiring_manager:portal_users!hr_onboardings_hiring_manager_id_fkey(id, name, email),
      recruiter:portal_users!hr_onboardings_recruiter_id_fkey(id, name, email),
      tasks:hr_onboarding_tasks(id, status)
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching onboardings:', error);
    return NextResponse.json({ error: 'Failed to fetch onboardings' }, { status: 500 });
  }

  // Compute task counts
  const onboardings = (data || []).map((ob: any) => {
    const tasks = ob.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter((t: any) => t.status === 'completed').length;
    return {
      ...ob,
      task_count: total,
      completed_count: completed,
    };
  });

  return NextResponse.json(onboardings);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    employee_name,
    employee_email,
    employee_phone,
    department_id,
    position_title,
    trade,
    start_date,
    template_id,
    hiring_manager_id,
    recruiter_id,
    notes,
    status,
  } = body;

  if (!employee_name || !position_title || !start_date) {
    return NextResponse.json(
      { error: 'employee_name, position_title, and start_date are required' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Create the onboarding record
  const { data: onboarding, error: createError } = await supabase
    .from('hr_onboardings')
    .insert({
      employee_name,
      employee_email: employee_email || null,
      employee_phone: employee_phone || null,
      department_id: department_id || null,
      position_title,
      trade: trade || null,
      start_date,
      template_id: template_id || null,
      hiring_manager_id: hiring_manager_id || null,
      recruiter_id: recruiter_id || null,
      notes: notes || null,
      status: status || 'draft',
      created_by: session.user.id,
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating onboarding:', createError);
    return NextResponse.json({ error: 'Failed to create onboarding' }, { status: 500 });
  }

  // If template_id is provided, instantiate tasks from the template
  if (template_id) {
    try {
      // Fetch the selected template
      const { data: template } = await supabase
        .from('hr_workflow_templates')
        .select('*')
        .eq('id', template_id)
        .single();

      if (template) {
        // If this is a department template (not base), also fetch the base template
        let baseTemplate = null;
        if (!template.is_base) {
          const { data: base } = await supabase
            .from('hr_workflow_templates')
            .select('*')
            .eq('is_base', true)
            .eq('workflow_type', template.workflow_type)
            .single();
          baseTemplate = base;
        }

        // Fetch phases and steps for the selected template
        const { data: templatePhases } = await supabase
          .from('hr_template_phases')
          .select('*, steps:hr_template_steps(*)')
          .eq('template_id', template_id)
          .order('sort_order', { ascending: true });

        // If there's a base template, fetch its phases and steps too
        let basePhases: any[] = [];
        if (baseTemplate) {
          const { data: bp } = await supabase
            .from('hr_template_phases')
            .select('*, steps:hr_template_steps(*)')
            .eq('template_id', baseTemplate.id)
            .order('sort_order', { ascending: true });
          basePhases = bp || [];
        }

        // Merge phases: if using dept template + base, merge them
        let mergedPhases: any[];
        if (baseTemplate && basePhases.length > 0) {
          // Start with base phases
          mergedPhases = basePhases.map((bp: any) => ({
            ...bp,
            steps: [...(bp.steps || [])],
          }));

          // For each dept phase, merge into base or append
          for (const deptPhase of (templatePhases || [])) {
            const matchingBase = mergedPhases.find((bp: any) => bp.name === deptPhase.name);
            if (matchingBase) {
              // Add dept steps to existing base phase
              const deptSteps = (deptPhase.steps || []).map((s: any) => ({
                ...s,
                sort_order: s.sort_order + 1000, // offset to appear after base steps
              }));
              matchingBase.steps.push(...deptSteps);
            } else {
              // New phase from dept template - append at end
              mergedPhases.push({
                ...deptPhase,
                sort_order: deptPhase.sort_order + 1000,
              });
            }
          }

          // Re-sort phases
          mergedPhases.sort((a: any, b: any) => a.sort_order - b.sort_order);
        } else {
          mergedPhases = templatePhases || [];
        }

        // Create tasks from merged phases/steps
        const tasksToInsert = [];
        for (const phase of mergedPhases) {
          const steps = (phase.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
          for (const step of steps) {
            let assignedTo: string | null = null;
            if (step.responsible_role === 'hiring_manager' && hiring_manager_id) {
              assignedTo = hiring_manager_id;
            } else if (step.responsible_role === 'recruiter' && recruiter_id) {
              assignedTo = recruiter_id;
            }

            tasksToInsert.push({
              onboarding_id: onboarding.id,
              template_step_id: step.id,
              phase_name: phase.name,
              phase_sort_order: phase.sort_order,
              title: step.title,
              description: step.description,
              guidance_text: step.guidance_text,
              responsible_role: step.responsible_role,
              assigned_to: assignedTo,
              due_date: addDays(start_date, step.relative_due_day),
              status: 'pending',
              is_conditional: step.is_conditional,
              condition_label: step.condition_label,
              sort_order: step.sort_order,
            });
          }
        }

        if (tasksToInsert.length > 0) {
          const { error: tasksError } = await supabase
            .from('hr_onboarding_tasks')
            .insert(tasksToInsert);

          if (tasksError) {
            console.error('Error creating tasks:', tasksError);
          }
        }
      }
    } catch (err) {
      console.error('Error instantiating template tasks:', err);
    }
  }

  // Log activity: onboarding_created
  await supabase.from('hr_activity_log').insert({
    onboarding_id: onboarding.id,
    actor_id: session.user.id,
    action: 'onboarding_created',
    details: { employee_name, position_title, template_id: template_id || null },
  });

  // If status is 'active', also log activation
  if (status === 'active') {
    await supabase.from('hr_activity_log').insert({
      onboarding_id: onboarding.id,
      actor_id: session.user.id,
      action: 'onboarding_activated',
      details: { employee_name },
    });
  }

  return NextResponse.json(onboarding, { status: 201 });
}
