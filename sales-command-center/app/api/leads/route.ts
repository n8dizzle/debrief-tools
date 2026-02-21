import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, DbLead } from '@/lib/supabase';
import { Lead } from '@/types';

// Transform database lead to app lead format
function dbToAppLead(dbLead: DbLead, advisorName?: string): Lead {
  return {
    id: dbLead.id,
    clientName: dbLead.client_name,
    leadType: dbLead.lead_type,
    source: dbLead.source || '',
    techName: dbLead.tech_name || undefined,
    status: dbLead.status as Lead['status'],
    assignedAdvisor: advisorName,
    estimatedValue: Number(dbLead.estimated_value) || 0,
    grossMarginPercent: Number(dbLead.gross_margin_percent) || 40,
    grossMarginDollar: Number(dbLead.gross_margin_dollar) || 0,
    createdDate: new Date(dbLead.created_at),
    phone: dbLead.phone || undefined,
    email: dbLead.email || undefined,
    address: dbLead.address || undefined,
    notes: dbLead.notes || undefined,
    serviceTitanId: dbLead.service_titan_id || undefined,
    unitAge: dbLead.unit_age || undefined,
    systemType: dbLead.system_type as Lead['systemType'],
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let query = supabase
      .from('leads')
      .select(`
        *,
        advisor:comfort_advisors(id, name)
      `)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('lead_type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leads = (data || []).map((row: any) =>
      dbToAppLead(row, row.advisor?.name)
    );

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Error in GET /api/leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('leads')
      .insert({
        client_name: body.clientName,
        lead_type: body.leadType,
        source: body.source,
        tech_name: body.techName,
        status: body.status || 'New Lead',
        assigned_advisor_id: body.assignedAdvisorId,
        estimated_value: body.estimatedValue || 0,
        gross_margin_percent: body.grossMarginPercent || 40,
        gross_margin_dollar: body.grossMarginDollar || 0,
        phone: body.phone,
        email: body.email,
        address: body.address,
        notes: body.notes,
        service_titan_id: body.serviceTitanId,
        unit_age: body.unitAge,
        system_type: body.systemType,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: dbToAppLead(data) });
  } catch (error: any) {
    console.error('Error in POST /api/leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {};
    if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
    if (updates.leadType !== undefined) dbUpdates.lead_type = updates.leadType;
    if (updates.source !== undefined) dbUpdates.source = updates.source;
    if (updates.techName !== undefined) dbUpdates.tech_name = updates.techName;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.assignedAdvisorId !== undefined) dbUpdates.assigned_advisor_id = updates.assignedAdvisorId;
    if (updates.estimatedValue !== undefined) dbUpdates.estimated_value = updates.estimatedValue;
    if (updates.grossMarginPercent !== undefined) dbUpdates.gross_margin_percent = updates.grossMarginPercent;
    if (updates.grossMarginDollar !== undefined) dbUpdates.gross_margin_dollar = updates.grossMarginDollar;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.serviceTitanId !== undefined) dbUpdates.service_titan_id = updates.serviceTitanId;
    if (updates.unitAge !== undefined) dbUpdates.unit_age = updates.unitAge;
    if (updates.systemType !== undefined) dbUpdates.system_type = updates.systemType;

    const { data, error } = await supabase
      .from('leads')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: dbToAppLead(data) });
  } catch (error: any) {
    console.error('Error in PATCH /api/leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
