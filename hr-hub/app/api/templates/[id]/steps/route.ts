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

  const {
    phase_id,
    title,
    description,
    guidance_text,
    responsible_role,
    relative_due_day,
    is_conditional,
    condition_label,
    sort_order,
  } = body;

  if (!phase_id || !title || !responsible_role) {
    return NextResponse.json(
      { error: 'phase_id, title, and responsible_role are required' },
      { status: 400 }
    );
  }

  // Verify the phase belongs to this template
  const { data: phase } = await supabase
    .from('hr_template_phases')
    .select('id')
    .eq('id', phase_id)
    .eq('template_id', templateId)
    .single();

  if (!phase) {
    return NextResponse.json(
      { error: 'Phase not found or does not belong to this template' },
      { status: 404 }
    );
  }

  const { data: step, error } = await supabase
    .from('hr_template_steps')
    .insert({
      phase_id,
      template_id: templateId,
      title,
      description: description || null,
      guidance_text: guidance_text || null,
      responsible_role,
      relative_due_day: relative_due_day ?? 0,
      is_conditional: is_conditional || false,
      condition_label: condition_label || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating step:', error);
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }

  return NextResponse.json(step, { status: 201 });
}
