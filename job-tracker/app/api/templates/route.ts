import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const searchParams = request.nextUrl.searchParams;

  let query = supabase
    .from('tracker_templates')
    .select(`
      *,
      milestones:tracker_template_milestones(*)
    `)
    .order('trade')
    .order('job_type');

  const activeOnly = searchParams.get('active') !== 'false';
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const trade = searchParams.get('trade');
  if (trade) {
    query = query.eq('trade', trade);
  }

  const jobType = searchParams.get('job_type');
  if (jobType) {
    query = query.eq('job_type', jobType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const body = await request.json();

  // Create template
  const { data: template, error: templateError } = await supabase
    .from('tracker_templates')
    .insert({
      name: body.name,
      description: body.description || null,
      trade: body.trade,
      job_type: body.job_type,
      is_default: body.is_default || false,
      is_active: body.is_active !== false,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 500 });
  }

  // Create milestones if provided
  if (body.milestones && Array.isArray(body.milestones) && body.milestones.length > 0) {
    const milestonesToInsert = body.milestones.map((m: Record<string, unknown>, index: number) => ({
      template_id: template.id,
      name: m.name,
      description: m.description || null,
      icon: m.icon || 'circle',
      sort_order: m.sort_order ?? index + 1,
      is_optional: m.is_optional || false,
      auto_complete_on_st_status: m.auto_complete_on_st_status || null,
    }));

    const { error: milestonesError } = await supabase
      .from('tracker_template_milestones')
      .insert(milestonesToInsert);

    if (milestonesError) {
      console.error('Failed to create milestones:', milestonesError);
    }
  }

  // Fetch template with milestones
  const { data: fullTemplate } = await supabase
    .from('tracker_templates')
    .select(`
      *,
      milestones:tracker_template_milestones(*)
    `)
    .eq('id', template.id)
    .single();

  return NextResponse.json(fullTemplate, { status: 201 });
}
