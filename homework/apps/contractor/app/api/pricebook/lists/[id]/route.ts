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

// GET /api/pricebook/lists/[id] - Get a single supplier list with all its items
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Fetch the supplier list and verify ownership
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('*')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('GET /api/pricebook/lists/[id] list error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Fetch all items for this list
    const { data: items, error: itemsError } = await supabase
      .from('pricebook_items')
      .select(`
        id,
        part_number,
        description,
        category,
        supplier_cost,
        unit,
        markup_percent,
        retail_price,
        mapped_service_id,
        mapping_confidence,
        mapping_status,
        metadata,
        created_at,
        updated_at
      `)
      .eq('supplier_list_id', id)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('GET /api/pricebook/lists/[id] items error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ list, items });
  } catch (err) {
    console.error('GET /api/pricebook/lists/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/pricebook/lists/[id] - Delete a supplier list and all its items
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Fetch the supplier list and verify ownership
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('id, file_url, contractor_id')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('DELETE /api/pricebook/lists/[id] find error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Delete all items belonging to this list
    const { error: itemsDeleteError } = await supabase
      .from('pricebook_items')
      .delete()
      .eq('supplier_list_id', id)
      .eq('contractor_id', contractorId);

    if (itemsDeleteError) {
      console.error('DELETE /api/pricebook/lists/[id] items delete error:', itemsDeleteError);
      return NextResponse.json({ error: itemsDeleteError.message }, { status: 500 });
    }

    // Delete the file from Supabase Storage if it exists
    if (list.file_url) {
      // Extract the storage path from the file_url
      // Path format: {contractor_id}/{list_id}/{filename}
      const storagePath = `${contractorId}/${id}`;
      const { data: files } = await supabase.storage
        .from('pricebook-uploads')
        .list(storagePath);

      if (files && files.length > 0) {
        const filePaths = files.map(f => `${storagePath}/${f.name}`);
        await supabase.storage
          .from('pricebook-uploads')
          .remove(filePaths);
      }
    }

    // Delete the supplier list record
    const { error: listDeleteError } = await supabase
      .from('pricebook_supplier_lists')
      .delete()
      .eq('id', id)
      .eq('contractor_id', contractorId);

    if (listDeleteError) {
      console.error('DELETE /api/pricebook/lists/[id] list delete error:', listDeleteError);
      return NextResponse.json({ error: listDeleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/pricebook/lists/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
