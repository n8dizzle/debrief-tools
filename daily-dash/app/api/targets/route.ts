import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const targetType = searchParams.get('type') || 'revenue';

    // Fetch monthly targets for the specified year
    const { data: targets, error: targetsError } = await supabase
      .from('dash_monthly_targets')
      .select('*')
      .eq('year', parseInt(year))
      .eq('target_type', targetType)
      .order('month', { ascending: true });

    if (targetsError) throw targetsError;

    // Fetch business days for the year
    const { data: businessDays, error: daysError } = await supabase
      .from('dash_business_days')
      .select('*')
      .eq('year', parseInt(year))
      .order('month', { ascending: true });

    if (daysError) throw daysError;

    // Fetch holidays for the year
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;
    const { data: holidays, error: holidaysError } = await supabase
      .from('dash_holidays')
      .select('*')
      .gte('holiday_date', startOfYear)
      .lte('holiday_date', endOfYear)
      .order('holiday_date', { ascending: true });

    if (holidaysError) throw holidaysError;

    // Group targets by department
    const targetsByDepartment: Record<string, Record<number, number>> = {};
    const dailyTargetsByDepartment: Record<string, Record<number, number>> = {};

    targets?.forEach((target) => {
      if (!targetsByDepartment[target.department]) {
        targetsByDepartment[target.department] = {};
        dailyTargetsByDepartment[target.department] = {};
      }
      targetsByDepartment[target.department][target.month] = parseFloat(target.target_value);
      if (target.daily_target_value) {
        dailyTargetsByDepartment[target.department][target.month] = parseFloat(target.daily_target_value);
      }
    });

    // Map business days to array
    const businessDaysMap: Record<number, number> = {};
    businessDays?.forEach((day) => {
      businessDaysMap[day.month] = parseFloat(day.total_days);
    });

    return NextResponse.json({
      year: parseInt(year),
      targetType,
      targets: targetsByDepartment,
      dailyTargets: dailyTargetsByDepartment,
      businessDays: businessDaysMap,
      holidays: holidays || [],
    });
  } catch (error) {
    console.error('Error fetching targets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch targets' },
      { status: 500 }
    );
  }
}
