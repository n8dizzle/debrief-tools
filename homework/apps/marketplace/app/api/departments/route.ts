import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/departments
 * List all active departments with their category counts.
 * Public - no auth required.
 */
export async function GET() {
  try {
    const supabase = await createServerClient();

    const { data: departments, error } = await supabase
      .from('catalog_departments')
      .select(
        `
        id, name, slug, description, icon, display_order,
        categories:catalog_categories(count)
        `
      )
      .eq('is_active', true)
      .eq('categories.is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Flatten the count from the nested aggregate
    const result = (departments || []).map((dept) => ({
      id: dept.id,
      name: dept.name,
      slug: dept.slug,
      description: dept.description,
      icon: dept.icon,
      display_order: dept.display_order,
      category_count: (dept.categories as unknown as { count: number }[])?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ departments: result });
  } catch (err) {
    console.error('Unexpected error in GET /api/departments:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
