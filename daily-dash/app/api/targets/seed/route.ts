import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 2026 Revenue targets from the Google Sheet (in thousands)
// Values from settings page: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
const REVENUE_TARGETS_2026 = {
  'HVAC Install': [569000, 429000, 633000, 858000, 1230000, 1450000, 1430000, 1470000, 805000, 708000, 574000, 574000],
  'HVAC Service': [124000, 94000, 139000, 188000, 270000, 317000, 312000, 322000, 176000, 155000, 126000, 126000],
  'HVAC Maintenance': [31000, 23000, 35000, 47000, 68000, 79000, 78000, 80000, 44000, 39000, 31000, 31000],
  'Plumbing': [130000, 156000, 156000, 156000, 156000, 156000, 183000, 183000, 183000, 209000, 209000, 209000],
  'TOTAL': [855000, 703000, 963000, 1250000, 1730000, 2000000, 2000000, 2050000, 1210000, 1110000, 940000, 940000],
};

// 2026 Review targets from the Google Sheet
// [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
const REVIEW_TARGETS_2026 = {
  monthly: [68, 56, 76, 99, 137, 159, 159, 163, 96, 88, 75, 75], // 1,250 annual
  daily: [3, 3, 3, 4, 6, 7, 7, 7, 4, 4, 3, 4],
};

// Business days per month for 2026 (accounting for 0.5 Saturdays and holidays)
const BUSINESS_DAYS_2026 = [22, 19, 22, 22, 21, 22, 23, 21, 21, 23, 19, 23];

// Major holidays for 2026
const HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day", isHalfDay: false },
  { date: '2026-01-19', name: 'MLK Day', isHalfDay: false },
  { date: '2026-02-16', name: "Presidents Day", isHalfDay: false },
  { date: '2026-05-25', name: 'Memorial Day', isHalfDay: false },
  { date: '2026-07-03', name: 'July 4th (Observed)', isHalfDay: false },
  { date: '2026-09-07', name: 'Labor Day', isHalfDay: false },
  { date: '2026-11-26', name: 'Thanksgiving', isHalfDay: false },
  { date: '2026-11-27', name: 'Day After Thanksgiving', isHalfDay: false },
  { date: '2026-12-24', name: 'Christmas Eve', isHalfDay: true },
  { date: '2026-12-25', name: 'Christmas Day', isHalfDay: false },
  { date: '2026-12-31', name: "New Year's Eve", isHalfDay: true },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const year = body.year || 2026;
    let recordsSynced = 0;
    const errors: string[] = [];

    console.log('Starting seed for year:', year);

    // Seed revenue targets
    for (const [department, targets] of Object.entries(REVENUE_TARGETS_2026)) {
      for (let month = 1; month <= 12; month++) {
        const monthlyTarget = targets[month - 1];
        const businessDays = BUSINESS_DAYS_2026[month - 1];
        const dailyTarget = businessDays > 0 ? Math.round(monthlyTarget / businessDays) : 0;

        const { error } = await supabase
          .from('dash_monthly_targets')
          .upsert(
            {
              year,
              month,
              department,
              target_type: 'revenue',
              target_value: monthlyTarget,
              daily_target_value: dailyTarget,
              synced_from_sheet: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'year,month,department,target_type' }
          );

        if (error) {
          errors.push(`Revenue ${department} M${month}: ${error.message}`);
        } else {
          recordsSynced++;
        }
      }
    }

    // Seed business days
    for (let month = 1; month <= 12; month++) {
      const { error } = await supabase
        .from('dash_business_days')
        .upsert(
          {
            year,
            month,
            total_days: BUSINESS_DAYS_2026[month - 1],
            synced_from_sheet: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'year,month' }
        );

      if (error) {
        errors.push(`Business days M${month}: ${error.message}`);
      } else {
        recordsSynced++;
      }
    }

    // Note: Review targets are hardcoded in /api/reviews/stats/route.ts
    // because dash_monthly_targets has a check constraint allowing only 'revenue' type

    // Update the review_goals table with the annual total (for backward compatibility)
    const annualReviewGoal = REVIEW_TARGETS_2026.monthly.reduce((sum, val) => sum + val, 0);

    // Delete existing and insert new
    await supabase
      .from('review_goals')
      .delete()
      .eq('year', year)
      .eq('goal_type', 'total');

    const { error: goalError } = await supabase
      .from('review_goals')
      .insert({
        year,
        goal_type: 'total',
        target_count: annualReviewGoal,
      });

    if (goalError) {
      errors.push(`Annual review goal: ${goalError.message}`);
      console.error('Annual review goal error:', goalError);
    } else {
      recordsSynced++;
    }

    // Seed holidays
    for (const holiday of HOLIDAYS_2026) {
      const { error } = await supabase
        .from('dash_holidays')
        .upsert(
          {
            holiday_date: holiday.date,
            name: holiday.name,
            is_half_day: holiday.isHalfDay,
          },
          { onConflict: 'holiday_date' }
        );

      if (error) {
        errors.push(`Holiday ${holiday.name}: ${error.message}`);
      } else {
        recordsSynced++;
      }
    }

    // Log the sync
    await supabase.from('dash_sync_log').insert({
      sync_type: 'seed',
      status: errors.length === 0 ? 'completed' : 'completed_with_errors',
      records_synced: recordsSynced,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0 ? errors.join('; ') : null,
    });

    return NextResponse.json({
      success: errors.length === 0,
      year,
      recordsSynced,
      errors,
      message: `Seeded ${recordsSynced} records for ${year}`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    return NextResponse.json(
      { success: false, error: message, stack },
      { status: 500 }
    );
  }
}
