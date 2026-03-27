import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id: templateId } = await params;
  const body = await request.json();

  const { name, description, sort_order, relative_start_day, relative_end_day } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Verify template exists
  const { data: template } = await supabase
    .from('hr_workflow_templates')
    .select('id')
    .eq('id', templateId)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const { data: phase, error } = await supabase
    .from('hr_template_phases')
    .insert({
      template_id: templateId,
      name,
      description: description || null,
      sort_order: sort_order ?? 0,
      relative_start_day: relative_start_day ?? 0,
      relative_end_day: relative_end_day ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating phase:', error);
    return NextResponse.json({ error: 'Failed to create phase' }, { status: 500 });
  }

  return NextResponse.json(phase, { status: 201 });
}
