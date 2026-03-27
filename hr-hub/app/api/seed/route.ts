import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  BASE_TEMPLATE_NAME,
  BASE_TEMPLATE_DESCRIPTION,
  BASE_TEMPLATE_PHASES,
} from '@/lib/seed-templates';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can seed templates' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  // Check if base template already exists
  const { data: existing } = await supabase
    .from('hr_workflow_templates')
    .select('id')
    .eq('is_base', true)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'Base template already exists', template_id: existing.id },
      { status: 409 }
    );
  }

  // Create the base template
  const { data: template, error: templateError } = await supabase
    .from('hr_workflow_templates')
    .insert({
      name: BASE_TEMPLATE_NAME,
      description: BASE_TEMPLATE_DESCRIPTION,
      workflow_type: 'onboarding',
      is_base: true,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (templateError || !template) {
    console.error('Error creating base template:', templateError);
    return NextResponse.json({ error: 'Failed to create base template' }, { status: 500 });
  }

  // Create phases and steps
  for (const phaseData of BASE_TEMPLATE_PHASES) {
    const { data: phase, error: phaseError } = await supabase
      .from('hr_template_phases')
      .insert({
        template_id: template.id,
        name: phaseData.name,
        description: phaseData.description || null,
        sort_order: phaseData.sort_order,
        relative_start_day: phaseData.relative_start_day,
        relative_end_day: phaseData.relative_end_day,
      })
      .select()
      .single();

    if (phaseError || !phase) {
      console.error('Error creating phase:', phaseError);
      continue;
    }

    // Create steps for this phase
    if (phaseData.steps && phaseData.steps.length > 0) {
      const stepsToInsert = phaseData.steps.map((step) => ({
        phase_id: phase.id,
        template_id: template.id,
        title: step.title,
        description: step.description || null,
        guidance_text: step.guidance_text || null,
        responsible_role: step.responsible_role,
        relative_due_day: step.relative_due_day,
        is_conditional: step.is_conditional || false,
        condition_label: step.condition_label || null,
        sort_order: step.sort_order,
      }));

      const { error: stepsError } = await supabase
        .from('hr_template_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        console.error('Error creating steps for phase:', phase.name, stepsError);
      }
    }
  }

  return NextResponse.json(template, { status: 201 });
}
