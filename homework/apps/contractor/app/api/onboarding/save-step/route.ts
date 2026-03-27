import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// POST /api/onboarding/save-step — persist wizard progress per step
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { step, data } = body;

    if (!step || !data) {
      return NextResponse.json({ error: 'step and data are required' }, { status: 400 });
    }

    // Get or create contractor record
    let { data: contractor } = await supabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!contractor && step === 2) {
      // Step 2 (Business Profile) creates the initial contractor record
      const { data: newContractor, error: createError } = await supabase
        .from('contractors')
        .insert({
          user_id: user.id,
          business_name: data.business_name || 'My Business',
          owner_name: data.owner_name || '',
          business_phone: data.phone || null,
          business_email: data.business_email || user.email,
          website_url: data.website_url || null,
          business_description: data.business_description || null,
          logo_url: data.logo_url || null,
          address_line1: data.address_line1 || null,
          city: data.city || null,
          state: data.state || 'TX',
          zip_code: data.zip_code || null,
          verification_status: 'pending',
          is_active: false,
          onboarding_step: 2,
        })
        .select('id')
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      contractor = newContractor;

      return NextResponse.json({ success: true, contractor_id: contractor!.id });
    }

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor record not found. Complete step 2 first.' }, { status: 400 });
    }

    // Update based on step
    if (step === 2) {
      // Update business profile fields
      const { error } = await supabase
        .from('contractors')
        .update({
          business_name: data.business_name,
          owner_name: data.owner_name,
          business_phone: data.phone || null,
          business_email: data.business_email || null,
          website_url: data.website_url || null,
          business_description: data.business_description || null,
          logo_url: data.logo_url || null,
          address_line1: data.address_line1 || null,
          city: data.city || null,
          state: data.state || 'TX',
          zip_code: data.zip_code || null,
          onboarding_step: 2,
        })
        .eq('id', contractor.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (step === 3) {
      // Business type & specialization
      const businessTypes: string[] = data.business_types || [];
      const primaryType = businessTypes[0] || null;

      const { error } = await supabase
        .from('contractors')
        .update({
          business_type: primaryType,
          business_types: businessTypes,
          years_in_business: data.years_in_business || null,
          employee_count: data.employee_count || null,
          onboarding_step: 3,
        })
        .eq('id', contractor.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Upsert contractor_trades based on business types → departments
      // First get categories for selected business types
      if (businessTypes.length > 0) {
        const { data: categories } = await supabase
          .from('business_type_category_map')
          .select('category_slug')
          .in('business_type', businessTypes);

        if (categories && categories.length > 0) {
          const slugs = categories.map((c) => c.category_slug);
          // Get departments for these categories
          const { data: cats } = await supabase
            .from('catalog_categories')
            .select('department_id')
            .in('slug', slugs);

          if (cats) {
            const deptIds = [...new Set(cats.map((c) => c.department_id))];
            // Clear old trades and insert new
            await supabase
              .from('contractor_trades')
              .delete()
              .eq('contractor_id', contractor.id);

            if (deptIds.length > 0) {
              await supabase
                .from('contractor_trades')
                .insert(deptIds.map((deptId) => ({
                  contractor_id: contractor.id,
                  department_id: deptId,
                })));
            }
          }
        }
      }
    }

    if (step === 4) {
      // Revenue goals & cost structure
      const { error } = await supabase
        .from('contractors')
        .update({
          annual_revenue_target: data.annual_revenue_target || null,
          jobs_per_week_target: data.jobs_per_week_target || null,
          labor_cost_pct: data.labor_cost_pct ?? 35,
          materials_cost_pct: data.materials_cost_pct ?? 20,
          overhead_pct: data.overhead_pct ?? 20,
          profit_margin_pct: data.profit_margin_pct ?? 15,
          onboarding_step: 4,
        })
        .eq('id', contractor.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (step === 5) {
      // Service areas
      const zipCodes: string[] = data.zip_codes || [];
      // Clear old and insert new
      await supabase
        .from('contractor_service_areas')
        .delete()
        .eq('contractor_id', contractor.id);

      if (zipCodes.length > 0) {
        await supabase
          .from('contractor_service_areas')
          .insert(zipCodes.map((zip) => ({
            contractor_id: contractor.id,
            zip_code: zip,
            is_active: true,
          })));
      }

      const { error } = await supabase
        .from('contractors')
        .update({ onboarding_step: 5 })
        .eq('id', contractor.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, contractor_id: contractor.id });
  } catch (err) {
    console.error('POST /api/onboarding/save-step error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
