import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { generatePriceBook } from '@/lib/pricing-engine';

// POST /api/onboarding/generate-prices — bulk generate price book
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get contractor with cost structure
    const { data: contractor, error: cError } = await supabase
      .from('contractors')
      .select('id, business_types, labor_cost_pct, materials_cost_pct, overhead_pct, profit_margin_pct')
      .eq('user_id', user.id)
      .single();

    if (cError || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const businessTypes: string[] = contractor.business_types || [];
    if (businessTypes.length === 0) {
      return NextResponse.json({ error: 'No business types selected' }, { status: 400 });
    }

    // Get category slugs for business types
    const { data: mappings } = await supabase
      .from('business_type_category_map')
      .select('category_slug')
      .in('business_type', businessTypes);

    if (!mappings || mappings.length === 0) {
      return NextResponse.json({ error: 'No categories found for business types' }, { status: 400 });
    }

    const categorySlugs = mappings.map((m) => m.category_slug);

    // Get categories
    const { data: categories } = await supabase
      .from('catalog_categories')
      .select('id')
      .in('slug', categorySlugs);

    if (!categories || categories.length === 0) {
      return NextResponse.json({ error: 'No catalog categories found' }, { status: 400 });
    }

    const categoryIds = categories.map((c) => c.id);

    // Get all services in these categories
    const { data: services } = await supabase
      .from('catalog_services')
      .select('id, name, slug, category_id')
      .in('category_id', categoryIds)
      .eq('is_active', true);

    if (!services || services.length === 0) {
      return NextResponse.json({ error: 'No services found' }, { status: 400 });
    }

    const serviceIds = services.map((s) => s.id);

    // Get market rates for these services
    const { data: rates } = await supabase
      .from('catalog_service_market_rates')
      .select('service_id, low_price, median_price, high_price, labor_pct, materials_pct')
      .in('service_id', serviceIds)
      .eq('market', 'dfw');

    if (!rates || rates.length === 0) {
      return NextResponse.json({ error: 'No market rates found' }, { status: 400 });
    }

    // Get variables and addons for these services
    const { data: variables } = await supabase
      .from('catalog_service_variables')
      .select('id, service_id, options, affects_pricing')
      .in('service_id', serviceIds);

    const { data: addons } = await supabase
      .from('catalog_service_addons')
      .select('id, service_id, suggested_price')
      .in('service_id', serviceIds);

    // Group variables and addons by service
    const variablesByService: Record<string, NonNullable<typeof variables>> = {};
    for (const v of variables || []) {
      if (!variablesByService[v.service_id]) variablesByService[v.service_id] = [];
      variablesByService[v.service_id]!.push(v);
    }

    const addonsByService: Record<string, NonNullable<typeof addons>> = {};
    for (const a of addons || []) {
      if (!addonsByService[a.service_id]) addonsByService[a.service_id] = [];
      addonsByService[a.service_id]!.push(a);
    }

    // Generate prices
    const costStructure = {
      labor_cost_pct: Number(contractor.labor_cost_pct) || 35,
      materials_cost_pct: Number(contractor.materials_cost_pct) || 20,
      overhead_pct: Number(contractor.overhead_pct) || 20,
      profit_margin_pct: Number(contractor.profit_margin_pct) || 15,
    };

    const generatedPrices = generatePriceBook(
      rates as any,
      costStructure,
      variablesByService as any,
      addonsByService as any
    );

    // Delete existing prices for this contractor (fresh generation)
    await supabase
      .from('contractor_prices')
      .delete()
      .eq('contractor_id', contractor.id);

    // Insert generated prices
    const priceRows = generatedPrices.map((p) => ({
      contractor_id: contractor.id,
      service_id: p.service_id,
      base_price: p.base_price,
      variable_pricing: p.variable_pricing,
      addon_pricing: p.addon_pricing,
      is_active: true,
    }));

    const { error: insertError } = await supabase
      .from('contractor_prices')
      .insert(priceRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Initialize default availability
    const { data: existingAvail } = await supabase
      .from('contractor_availability')
      .select('id')
      .eq('contractor_id', contractor.id)
      .limit(1);

    if (!existingAvail || existingAvail.length === 0) {
      const defaultSchedule = [
        { day_of_week: 0, start_time: '09:00', end_time: '14:00', is_available: false },
        { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_available: true },
        { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_available: true },
        { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_available: true },
        { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_available: true },
        { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_available: true },
        { day_of_week: 6, start_time: '09:00', end_time: '14:00', is_available: true },
      ];

      await supabase
        .from('contractor_availability')
        .insert(defaultSchedule.map((d) => ({ contractor_id: contractor.id, ...d })));
    }

    // Mark onboarding complete
    await supabase
      .from('contractors')
      .update({
        onboarding_step: 6,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', contractor.id);

    await supabase.auth.updateUser({
      data: {
        onboarding_complete: true,
        business_name: undefined, // will be read from contractor record
      },
    });

    // Build summary for display
    const servicesByCategory: Record<string, number> = {};
    for (const s of services) {
      const cat = categories.find((c) => c.id === s.category_id);
      const catSlug = categorySlugs.find((slug) => {
        const catObj = categories.find((c) => c.id === s.category_id);
        return catObj?.id === s.category_id;
      }) || 'other';
      servicesByCategory[catSlug] = (servicesByCategory[catSlug] || 0) + 1;
    }

    // Sample prices for preview
    const samplePrices = generatedPrices.slice(0, 6).map((p) => {
      const service = services.find((s) => s.id === p.service_id);
      return {
        name: service?.name || 'Unknown',
        slug: service?.slug || '',
        price: p.base_price,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        total_services: generatedPrices.length,
        total_categories: categorySlugs.length,
        sample_prices: samplePrices,
      },
    });
  } catch (err) {
    console.error('POST /api/onboarding/generate-prices error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
