import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Run all count queries in parallel
    const [
      departmentsResult,
      categoriesResult,
      totalServicesResult,
      activeServicesResult,
      featuredServicesResult,
      totalContractorsResult,
      pendingContractorsResult,
      approvedContractorsResult,
      suspendedContractorsResult,
      ordersResult,
      revenueResult,
      servicesByWaveResult,
      servicesByPricingResult,
    ] = await Promise.all([
      // Department count
      supabase
        .from('catalog_departments')
        .select('*', { count: 'exact', head: true }),

      // Category count
      supabase
        .from('catalog_categories')
        .select('*', { count: 'exact', head: true }),

      // Total services
      supabase
        .from('catalog_services')
        .select('*', { count: 'exact', head: true }),

      // Active services
      supabase
        .from('catalog_services')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      // Featured services
      supabase
        .from('catalog_services')
        .select('*', { count: 'exact', head: true })
        .eq('is_featured', true),

      // Total contractors
      supabase
        .from('contractors')
        .select('*', { count: 'exact', head: true }),

      // Pending contractors
      supabase
        .from('contractors')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),

      // Approved contractors
      supabase
        .from('contractors')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'approved'),

      // Suspended contractors
      supabase
        .from('contractors')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'suspended'),

      // Total orders
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true }),

      // Revenue (sum of completed order totals)
      supabase
        .from('orders')
        .select('total')
        .eq('status', 'completed'),

      // Services by launch wave
      supabase
        .from('catalog_services')
        .select('launch_wave'),

      // Services by pricing type
      supabase
        .from('catalog_services')
        .select('pricing_type'),
    ]);

    // Sum revenue from completed orders
    let totalRevenue = 0;
    if (revenueResult.data) {
      totalRevenue = revenueResult.data.reduce(
        (sum: number, order: any) => sum + (order.total || 0),
        0
      );
    }

    // Aggregate services by wave
    const servicesByWave: Record<string, number> = {};
    if (servicesByWaveResult.data) {
      for (const svc of servicesByWaveResult.data) {
        const wave = svc.launch_wave ? `wave_${svc.launch_wave}` : 'unassigned';
        servicesByWave[wave] = (servicesByWave[wave] || 0) + 1;
      }
    }

    // Aggregate services by pricing type
    const servicesByPricing: Record<string, number> = {};
    if (servicesByPricingResult.data) {
      for (const svc of servicesByPricingResult.data) {
        const pType = svc.pricing_type || 'unset';
        servicesByPricing[pType] = (servicesByPricing[pType] || 0) + 1;
      }
    }

    const dashboard = {
      catalog: {
        departments: departmentsResult.count || 0,
        categories: categoriesResult.count || 0,
        total_services: totalServicesResult.count || 0,
        active_services: activeServicesResult.count || 0,
        featured_services: featuredServicesResult.count || 0,
        services_by_wave: servicesByWave,
        services_by_pricing_type: servicesByPricing,
      },
      contractors: {
        total: totalContractorsResult.count || 0,
        pending: pendingContractorsResult.count || 0,
        approved: approvedContractorsResult.count || 0,
        suspended: suspendedContractorsResult.count || 0,
      },
      orders: {
        total: ordersResult.count || 0,
        total_revenue: totalRevenue,
      },
    };

    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
