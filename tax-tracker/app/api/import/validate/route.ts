import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: categories } = await supabase
      .from('bpp_categories')
      .select('id, name');

    const catMap = new Map((categories || []).map(c => [c.name.toLowerCase(), c.id]));

    const errors: { row: number; field: string; message: string }[] = [];
    const validAssets: any[] = [];

    rows.forEach((row: any, idx: number) => {
      const rowNum = idx + 1;
      const asset: any = {};

      // Category (required - match by name)
      if (!row.category) {
        errors.push({ row: rowNum, field: 'category', message: 'Category is required' });
      } else {
        const catId = catMap.get(row.category.toLowerCase().trim());
        if (!catId) {
          errors.push({ row: rowNum, field: 'category', message: `Unknown category: ${row.category}` });
        } else {
          asset.category_id = catId;
        }
      }

      // Description (required)
      if (!row.description?.trim()) {
        errors.push({ row: rowNum, field: 'description', message: 'Description is required' });
      } else {
        asset.description = row.description.trim();
      }

      // Quantity
      const qty = parseInt(row.quantity);
      if (!qty || qty < 1) {
        errors.push({ row: rowNum, field: 'quantity', message: 'Quantity must be a positive integer' });
      } else {
        asset.quantity = qty;
      }

      // Unit cost
      const cost = parseFloat(String(row.unit_cost).replace(/[$,]/g, ''));
      if (isNaN(cost) || cost < 0) {
        errors.push({ row: rowNum, field: 'unit_cost', message: 'Unit cost must be a valid number' });
      } else {
        asset.unit_cost = cost;
      }

      // Year acquired
      const year = parseInt(row.year_acquired);
      if (!year || year < 1900 || year > new Date().getFullYear()) {
        errors.push({ row: rowNum, field: 'year_acquired', message: 'Year acquired must be a valid year' });
      } else {
        asset.year_acquired = year;
      }

      // Optional fields
      asset.subcategory = row.subcategory?.trim() || null;
      asset.condition = ['new', 'good', 'fair', 'poor'].includes(row.condition?.toLowerCase()) ? row.condition.toLowerCase() : 'good';
      asset.location = row.location?.trim() || null;
      asset.serial_number = row.serial_number?.trim() || null;
      asset.notes = row.notes?.trim() || null;

      if (!errors.some(e => e.row === rowNum)) {
        validAssets.push(asset);
      }
    });

    return NextResponse.json({
      total_rows: rows.length,
      valid_count: validAssets.length,
      error_count: errors.length,
      errors,
      valid_assets: validAssets,
    });
  } catch (err: any) {
    console.error('Validate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
