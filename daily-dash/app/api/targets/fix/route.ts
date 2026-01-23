import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// Daily targets from spreadsheet (TOTAL row)
const dailyTargets: Record<number, number> = {
  1: 36368,   // Jan
  2: 31958,   // Feb
  3: 40113,   // Mar
  4: 52071,   // Apr
  5: 76800,   // May
  6: 83388,   // Jun
  7: 83335,   // Jul
  8: 87435,   // Aug
  9: 52498,   // Sep
  10: 45328,  // Oct
  11: 44748,  // Nov
  12: 39155,  // Dec
};

// Business days per month (2026) - from your spreadsheet
const businessDays: Record<number, number> = {
  1: 22,  // Jan
  2: 20,  // Feb (Presidents Day)
  3: 22,  // Mar
  4: 22,  // Apr
  5: 21,  // May (Memorial Day)
  6: 22,  // Jun
  7: 22,  // Jul (4th observed)
  8: 21,  // Aug
  9: 21,  // Sep (Labor Day)
  10: 22, // Oct
  11: 20, // Nov (Thanksgiving)
  12: 22, // Dec (Christmas)
};

// Department-level daily targets from spreadsheet
const departmentDailyTargets: Record<string, Record<number, number>> = {
  'hvac-install': { 1: 24199, 2: 19509, 3: 26377, 4: 35766, 5: 54841, 6: 60355, 7: 59461, 8: 62552, 9: 34988, 10: 28905, 11: 27335, 12: 23919 },
  'hvac-service': { 1: 5297, 2: 4270, 3: 5774, 4: 7829, 5: 12004, 6: 13211, 7: 13015, 8: 13692, 9: 7659, 10: 6327, 11: 5983, 12: 5236 },
  'hvac-maintenance': { 1: 1324, 2: 1068, 3: 1443, 4: 1957, 5: 3001, 6: 3303, 7: 3254, 8: 3423, 9: 1915, 10: 1582, 11: 1496, 12: 1309 },
  'plumbing': { 1: 5548, 2: 7111, 3: 6519, 4: 6519, 5: 6953, 6: 6519, 7: 7605, 8: 7767, 9: 7936, 10: 8514, 11: 9933, 12: 8692 },
};

// POST /api/dash/targets/fix - Fix monthly targets from spreadsheet values
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const results: { department: string; month: number; daily: number; days: number; monthly: number }[] = [];
    const errors: string[] = [];

    // First, update business days (column is 'total_days', not 'business_days')
    for (let month = 1; month <= 12; month++) {
      // Delete existing first
      await supabase
        .from('dash_business_days')
        .delete()
        .eq('year', 2026)
        .eq('month', month);

      const { error } = await supabase
        .from('dash_business_days')
        .insert({
          year: 2026,
          month: month,
          total_days: businessDays[month],
        });

      if (error) {
        errors.push(`Business days month ${month}: ${error.message}`);
      }
    }

    // Insert christmas (TOTAL) targets (column is 'target_type', not 'metric_type')
    for (let month = 1; month <= 12; month++) {
      const daily = dailyTargets[month];
      const days = businessDays[month];
      const monthly = daily * days;

      // Delete existing first
      await supabase
        .from('dash_monthly_targets')
        .delete()
        .eq('year', 2026)
        .eq('month', month)
        .eq('department', 'christmas')
        .eq('target_type', 'revenue');

      const { error } = await supabase
        .from('dash_monthly_targets')
        .insert({
          year: 2026,
          month: month,
          department: 'christmas',
          target_type: 'revenue',
          target_value: monthly,
          daily_target_value: daily,
        });

      if (error) {
        errors.push(`Christmas month ${month}: ${error.message}`);
      }

      results.push({ department: 'christmas', month, daily, days, monthly });
    }

    // Insert department-level targets
    for (const [dept, targets] of Object.entries(departmentDailyTargets)) {
      for (let month = 1; month <= 12; month++) {
        const daily = targets[month];
        const days = businessDays[month];
        const monthly = daily * days;

        // Delete existing first
        await supabase
          .from('dash_monthly_targets')
          .delete()
          .eq('year', 2026)
          .eq('month', month)
          .eq('department', dept)
          .eq('target_type', 'revenue');

        const { error } = await supabase
          .from('dash_monthly_targets')
          .insert({
            year: 2026,
            month: month,
            department: dept,
            target_type: 'revenue',
            target_value: monthly,
            daily_target_value: daily,
          });

        if (error) {
          errors.push(`${dept} month ${month}: ${error.message}`);
        }

        results.push({ department: dept, month, daily, days, monthly });
      }
    }

    // Summary for January
    const janSummary = results.filter(r => r.month === 1);
    console.log('January targets fixed:', janSummary);

    return NextResponse.json({
      success: errors.length === 0,
      message: 'Monthly targets updated from spreadsheet daily values',
      january: janSummary,
      totalRecords: results.length,
      errors,
    });
  } catch (error) {
    console.error('Error fixing targets:', error);
    return NextResponse.json({ error: 'Failed to fix targets' }, { status: 500 });
  }
}
