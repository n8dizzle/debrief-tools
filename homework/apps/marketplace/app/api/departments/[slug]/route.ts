import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/departments/[slug]
 * Department detail with categories and their service counts.
 * Public - no auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createServerClient();

    const { data: department, error } = await supabase
      .from('catalog_departments')
      .select(
        `
        id, name, slug, description, icon, display_order,
        categories:catalog_categories(
          id, name, slug, description, icon, display_order,
          services:catalog_services(count)
        )
        `
      )
      .eq('slug', slug)
      .eq('is_active', true)
      .eq('categories.is_active', true)
      .eq('categories.services.is_active', true)
      .order('display_order', { referencedTable: 'catalog_categories', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      console.error('Error fetching department:', error);
      return NextResponse.json({ error: 'Failed to fetch department' }, { status: 500 });
    }

    // Flatten service counts in categories
    const categories = (department.categories || []).map(
      (cat: Record<string, unknown>) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        display_order: cat.display_order,
        service_count: (cat.services as unknown as { count: number }[])?.[0]?.count ?? 0,
      })
    );

    return NextResponse.json({
      department: {
        id: department.id,
        name: department.name,
        slug: department.slug,
        description: department.description,
        icon: department.icon,
        display_order: department.display_order,
        categories,
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/departments/[slug]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
