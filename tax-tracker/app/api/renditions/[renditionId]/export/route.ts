import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { calculateDepreciatedValue } from '@/lib/depreciation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ renditionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { renditionId } = await params;
    const supabase = getServerSupabase();

    const { data: rendition } = await supabase
      .from('bpp_renditions')
      .select('*')
      .eq('id', renditionId)
      .single();

    if (!rendition) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: assets } = await supabase
      .from('bpp_assets')
      .select('*, category:bpp_categories(name)')
      .eq('disposed', false)
      .order('category_id')
      .order('year_acquired');

    const { data: schedules } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*');

    // Build CSV
    const rows = [['Category', 'Description', 'Quantity', 'Year Acquired', 'Unit Cost', 'Historical Cost', 'Depreciated Value', 'Condition', 'Location', 'Serial/VIN']];

    for (const asset of assets || []) {
      const catSchedules = (schedules || []).filter(s => s.category_id === asset.category_id);
      const depValue = calculateDepreciatedValue(Number(asset.total_cost), asset.year_acquired, catSchedules, rendition.tax_year);

      rows.push([
        (asset.category as any)?.name || '',
        asset.description,
        String(asset.quantity),
        String(asset.year_acquired),
        String(asset.unit_cost),
        String(asset.total_cost),
        String(Math.round(depValue * 100) / 100),
        asset.condition || '',
        asset.location || '',
        asset.serial_number || '',
      ]);
    }

    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bpp-rendition-${rendition.tax_year}-${rendition.county}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
