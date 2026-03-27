import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Fetch templates with department info, phases, and steps for counting
  const { data: templates, error } = await supabase
    .from('hr_workflow_templates')
    .select(`
      *,
      portal_departments(id, name, slug),
      phases:hr_template_phases(id, steps:hr_template_steps(id))
    `)
    .order('is_base', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  // Compute phase and step counts
  const templatesWithCounts = (templates || []).map((t: any) => {
    const phases = t.phases || [];
    const phaseCount = phases.length;
    const stepCount = phases.reduce(
      (sum: number, p: any) => sum + (p.steps?.length || 0),
      0
    );
    return {
      ...t,
      phase_count: phaseCount,
      step_count: stepCount,
    };
  });

  return NextResponse.json(templatesWithCounts);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can create templates' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, workflow_type, department_id, is_base } = body;

  if (!name || !workflow_type) {
    return NextResponse.json(
      { error: 'name and workflow_type are required' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data: template, error } = await supabase
    .from('hr_workflow_templates')
    .insert({
      name,
      description: description || null,
      workflow_type,
      department_id: department_id || null,
      is_base: is_base || false,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json(template, { status: 201 });
}
