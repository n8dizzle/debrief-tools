import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        advisor:comfort_advisors(id, name)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    if (body.clientName !== undefined) dbUpdates.client_name = body.clientName;
    if (body.leadType !== undefined) dbUpdates.lead_type = body.leadType;
    if (body.source !== undefined) dbUpdates.source = body.source;
    if (body.techName !== undefined) dbUpdates.tech_name = body.techName;
    if (body.status !== undefined) dbUpdates.status = body.status;
    if (body.assignedAdvisorId !== undefined) dbUpdates.assigned_advisor_id = body.assignedAdvisorId;
    if (body.estimatedValue !== undefined) dbUpdates.estimated_value = body.estimatedValue;
    if (body.grossMarginPercent !== undefined) dbUpdates.gross_margin_percent = body.grossMarginPercent;
    if (body.grossMarginDollar !== undefined) dbUpdates.gross_margin_dollar = body.grossMarginDollar;
    if (body.phone !== undefined) dbUpdates.phone = body.phone;
    if (body.email !== undefined) dbUpdates.email = body.email;
    if (body.address !== undefined) dbUpdates.address = body.address;
    if (body.notes !== undefined) dbUpdates.notes = body.notes;

    const { data, error } = await supabase
      .from('leads')
      .update(dbUpdates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
