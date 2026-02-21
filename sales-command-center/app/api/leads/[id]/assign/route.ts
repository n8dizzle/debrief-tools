import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { leadType } = body; // 'TGL' or 'Marketed'

    if (!leadType || !['TGL', 'Marketed'].includes(leadType)) {
      return NextResponse.json(
        { error: 'Invalid lead type. Must be TGL or Marketed' },
        { status: 400 }
      );
    }

    const queueField = leadType === 'TGL' ? 'tgl_queue_position' : 'marketed_queue_position';

    // Get the next advisor in queue (position 1)
    const { data: nextAdvisor, error: advisorError } = await supabase
      .from('comfort_advisors')
      .select('*')
      .eq('active', true)
      .eq(queueField, 1)
      .single();

    if (advisorError || !nextAdvisor) {
      return NextResponse.json(
        { error: 'No available advisors in queue' },
        { status: 400 }
      );
    }

    // Update the lead with the assigned advisor
    const { data: updatedLead, error: leadError } = await supabase
      .from('leads')
      .update({
        assigned_advisor_id: nextAdvisor.id,
        status: 'Assigned',
      })
      .eq('id', params.id)
      .select()
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    // Rotate the queue
    // Get max position
    const { data: maxData } = await supabase
      .from('comfort_advisors')
      .select(queueField)
      .eq('active', true)
      .order(queueField, { ascending: false })
      .limit(1);

    const maxPosition = maxData && maxData.length > 0 ? (maxData[0] as any)[queueField] : 1;

    // Move the assigned advisor to the back
    await supabase
      .from('comfort_advisors')
      .update({ [queueField]: maxPosition })
      .eq('id', nextAdvisor.id);

    // Move everyone else up
    const { data: otherAdvisors } = await supabase
      .from('comfort_advisors')
      .select('id, ' + queueField)
      .eq('active', true)
      .neq('id', nextAdvisor.id)
      .gt(queueField, 1);

    if (otherAdvisors) {
      for (const advisor of otherAdvisors as any[]) {
        await supabase
          .from('comfort_advisors')
          .update({ [queueField]: advisor[queueField] - 1 })
          .eq('id', advisor.id);
      }
    }

    // Increment advisor's total leads
    await supabase
      .from('comfort_advisors')
      .update({ total_leads: nextAdvisor.total_leads + 1 })
      .eq('id', nextAdvisor.id);

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      advisor: {
        id: nextAdvisor.id,
        name: nextAdvisor.name,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/leads/[id]/assign:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
