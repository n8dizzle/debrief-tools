import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// 2026 Revenue targets from the Google Sheet (in dollars)
// These must match the values in /api/targets/seed/route.ts
// Values: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
const REVENUE_TARGETS_2026: Record<string, number[]> = {
  'HVAC Install': [569000, 429000, 633000, 858000, 1230000, 1450000, 1430000, 1470000, 805000, 708000, 574000, 574000],
  'HVAC Service': [124000, 94000, 139000, 188000, 270000, 317000, 312000, 322000, 176000, 155000, 126000, 126000],
  'HVAC Maintenance': [31000, 23000, 35000, 47000, 68000, 79000, 78000, 80000, 44000, 39000, 31000, 31000],
  'Plumbing': [130000, 156000, 156000, 156000, 156000, 156000, 183000, 183000, 183000, 209000, 209000, 209000],
  'TOTAL': [855000, 703000, 963000, 1250000, 1730000, 2000000, 2000000, 2050000, 1210000, 1110000, 940000, 940000],
};

// Business days per month (2026) - from your spreadsheet
// Must match /api/targets/seed/route.ts
const businessDays: Record<number, number> = {
  1: 22,  // Jan
  2: 19,  // Feb (Presidents Day)
  3: 22,  // Mar
  4: 22,  // Apr
  5: 21,  // May (Memorial Day)
  6: 22,  // Jun
  7: 23,  // Jul
  8: 21,  // Aug
  9: 21,  // Sep (Labor Day)
  10: 23, // Oct
  11: 19, // Nov (Thanksgiving)
  12: 23, // Dec (Christmas)
};

// POST /api/targets/fix - Fix monthly targets from spreadsheet values
// This ensures department names match what the API queries for:
// 'HVAC Install', 'HVAC Service', 'HVAC Maintenance', 'Plumbing', 'TOTAL'
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

    // Clean up any old lowercase/hyphenated department names that don't match the API
    const oldDeptNames = ['christmas', 'hvac-install', 'hvac-service', 'hvac-maintenance', 'plumbing'];
    for (const oldName of oldDeptNames) {
      await supabase
        .from('dash_monthly_targets')
        .delete()
        .eq('year', 2026)
        .eq('department', oldName);
    }

    // Insert department targets using correct names that match API queries
    // Daily target is calculated from monthly / business days
    for (const [department, monthlyTargets] of Object.entries(REVENUE_TARGETS_2026)) {
      for (let month = 1; month <= 12; month++) {
        const monthly = monthlyTargets[month - 1];
        const days = businessDays[month];
        const daily = days > 0 ? Math.round(monthly / days) : 0;

        // Upsert to handle both insert and update cases
        const { error } = await supabase
          .from('dash_monthly_targets')
          .upsert(
            {
              year: 2026,
              month: month,
              department: department,
              target_type: 'revenue',
              target_value: monthly,
              daily_target_value: daily,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'year,month,department,target_type' }
          );

        if (error) {
          errors.push(`${department} month ${month}: ${error.message}`);
        }

        results.push({ department, month, daily, days, monthly });
      }
    }

    // Summary for January
    const janSummary = results.filter(r => r.month === 1);
    console.log('January targets fixed:', janSummary);

    return NextResponse.json({
      success: errors.length === 0,
      message: `Fixed ${results.length} targets with correct department names (HVAC Install, HVAC Service, HVAC Maintenance, Plumbing, TOTAL)`,
      january: janSummary,
      totalRecords: results.length,
      errors,
    });
  } catch (error) {
    console.error('Error fixing targets:', error);
    return NextResponse.json({ error: 'Failed to fix targets' }, { status: 500 });
  }
}
