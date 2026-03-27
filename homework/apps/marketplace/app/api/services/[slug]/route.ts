import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/services/[slug]
 * Service detail by slug. Returns service with variables, addons, category, department.
 * Public - no auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createServerClient();

    const { data: service, error } = await supabase
      .from('catalog_services')
      .select(
        `
        *,
        category:catalog_categories!inner(
          id, name, slug, description, icon,
          department:catalog_departments!inner(id, name, slug, description, icon)
        ),
        variables:catalog_service_variables(
          id, name, label, description, variable_type, options, is_required, affects_pricing, display_order
        ),
        addons:catalog_service_addons(
          id, name, description, suggested_price, display_order, is_active
        )
        `
      )
      .eq('slug', slug)
      .eq('is_active', true)
      .order('display_order', { referencedTable: 'catalog_service_variables', ascending: true })
      .order('display_order', { referencedTable: 'catalog_service_addons', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      console.error('Error fetching service:', error);
      return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
    }

    // Filter out inactive addons
    if (service.addons) {
      service.addons = service.addons.filter((addon: { is_active: boolean }) => addon.is_active);
    }

    return NextResponse.json({ service });
  } catch (err) {
    console.error('Unexpected error in GET /api/services/[slug]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
