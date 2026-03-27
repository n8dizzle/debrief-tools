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

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

// GET /api/pricebook/lists/[id]/export - Export items as CSV
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

    // Verify the supplier list exists and belongs to this contractor
    const { data: list, error: listError } = await supabase
      .from('pricebook_supplier_lists')
      .select('id, supplier_name, contractor_id')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (listError) {
      if (listError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Supplier list not found' }, { status: 404 });
      }
      console.error('GET /api/pricebook/lists/[id]/export find error:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    // Fetch all items with mapped service name
    const { data: items, error: itemsError } = await supabase
      .from('pricebook_items')
      .select(`
        id,
        part_number,
        description,
        category,
        supplier_cost,
        markup_percent,
        retail_price,
        unit,
        mapped_service_id,
        catalog_services (name)
      `)
      .eq('supplier_list_id', id)
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('GET /api/pricebook/lists/[id]/export items error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items to export' }, { status: 404 });
    }

    // Build CSV content
    const headers = [
      'Part Number',
      'Description',
      'Category',
      'Supplier Cost',
      'Markup %',
      'Retail Price',
      'Unit',
      'Catalog Service',
    ];

    const csvRows: string[] = [headers.join(',')];

    for (const item of items) {
      const catalogService = item.catalog_services as unknown as { name: string } | null;
      const row = [
        escapeCSVField(item.part_number || ''),
        escapeCSVField(item.description || ''),
        escapeCSVField(item.category || ''),
        formatCents(item.supplier_cost),
        item.markup_percent !== null && item.markup_percent !== undefined
          ? String(item.markup_percent)
          : '',
        formatCents(item.retail_price),
        escapeCSVField(item.unit || ''),
        escapeCSVField(catalogService?.name || ''),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Sanitize the supplier name for use as a filename
    const safeSupplierName = list.supplier_name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const fileName = `${safeSupplierName}_pricebook_export.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/pricebook/lists/[id]/export error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
