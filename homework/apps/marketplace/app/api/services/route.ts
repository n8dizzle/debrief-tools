import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/services
 * Browse/search services with filtering and pagination.
 * Public - no auth required.
 *
 * Query params:
 *   department - department slug
 *   category   - category slug
 *   search     - full-text search query
 *   wave       - launch wave (1-4)
 *   pricing_type - e.g. "instant", "configurator", "photo_estimate", "onsite_estimate"
 *   page       - page number (default 1)
 *   per_page   - results per page (default 24, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const department = searchParams.get('department');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const wave = searchParams.get('wave');
    const pricingType = searchParams.get('pricing_type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '24', 10)));

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('catalog_services')
      .select(
        `
        *,
        category:catalog_categories!inner(
          id, name, slug, icon,
          department:catalog_departments!inner(id, name, slug, icon)
        )
        `,
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .range(from, to);

    // Filter by department slug via the joined category -> department
    if (department) {
      query = query.eq('category.department.slug', department);
    }

    // Filter by category slug
    if (category) {
      query = query.eq('category.slug', category);
    }

    // Full-text search using the tsvector column
    if (search) {
      // Convert search terms to tsquery format (space-separated words become & joined)
      const tsquery = search
        .trim()
        .split(/\s+/)
        .map((term) => `'${term}'`)
        .join(' & ');
      query = query.textSearch('search_vector', tsquery);
    }

    // Filter by launch wave
    if (wave) {
      const waveNum = parseInt(wave, 10);
      if (waveNum >= 1 && waveNum <= 4) {
        query = query.eq('launch_wave', waveNum);
      }
    }

    // Filter by pricing type
    if (pricingType) {
      query = query.eq('pricing_type', pricingType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json({
      services: data || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/services:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
