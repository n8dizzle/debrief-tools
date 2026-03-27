import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

async function getContractorId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

// GET /api/pricebook/lists - List all supplier lists for the authenticated contractor
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { data: lists, error } = await supabase
      .from('pricebook_supplier_lists')
      .select(`
        id,
        supplier_name,
        file_url,
        file_name,
        parse_status,
        parsed_at,
        item_count,
        error_message,
        metadata,
        created_at,
        updated_at
      `)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/pricebook/lists error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ lists });
  } catch (err) {
    console.error('GET /api/pricebook/lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/pricebook/lists - Create a new supplier list record
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { supplier_name } = body as { supplier_name?: string };

    if (!supplier_name || typeof supplier_name !== 'string' || supplier_name.trim().length === 0) {
      return NextResponse.json({ error: 'supplier_name is required' }, { status: 400 });
    }

    const { data: list, error } = await supabase
      .from('pricebook_supplier_lists')
      .insert({
        contractor_id: contractorId,
        supplier_name: supplier_name.trim(),
        parse_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/pricebook/lists error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ list }, { status: 201 });
  } catch (err) {
    console.error('POST /api/pricebook/lists error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
