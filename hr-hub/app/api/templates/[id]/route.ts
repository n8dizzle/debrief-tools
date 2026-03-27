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

  // Fetch template with phases and steps nested
  const { data: template, error } = await supabase
    .from('hr_workflow_templates')
    .select(`
      *,
      portal_departments(id, name, slug),
      phases:hr_template_phases(
        *,
        steps:hr_template_steps(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Sort phases by sort_order, steps within each phase by sort_order
  if (template.phases) {
    template.phases.sort((a: any, b: any) => a.sort_order - b.sort_order);
    for (const phase of template.phases) {
      if (phase.steps) {
        phase.steps.sort((a: any, b: any) => a.sort_order - b.sort_order);
      }
    }
  }

  return NextResponse.json(template);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update templates' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;
  const body = await request.json();

  const allowedFields = ['name', 'description', 'workflow_type', 'department_id', 'is_base', 'is_active'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('hr_workflow_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;

  // Check if template exists
  const { data: template } = await supabase
    .from('hr_workflow_templates')
    .select('id, is_base')
    .eq('id', id)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can delete templates' }, { status: 403 });
  }

  // Delete steps first, then phases, then template
  const { data: phases } = await supabase
    .from('hr_template_phases')
    .select('id')
    .eq('template_id', id);

  if (phases && phases.length > 0) {
    const phaseIds = phases.map((p: any) => p.id);
    await supabase
      .from('hr_template_steps')
      .delete()
      .in('phase_id', phaseIds);
  }

  await supabase
    .from('hr_template_phases')
    .delete()
    .eq('template_id', id);

  const { error } = await supabase
    .from('hr_workflow_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
