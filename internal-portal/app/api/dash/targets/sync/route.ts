import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SPREADSHEET_ID = process.env.HUDDLE_SPREADSHEET_ID || '1w-c6lgPYAGUwtW7biPQoGApIoZcTFgR0usyAGUtWEcw';
const TARGETS_SHEET = '2026 Targets & Actuals';
const BUSINESS_DAYS_SHEET = 'Business Days';

// Cell ranges from the spreadsheet structure
const CELL_RANGES = {
  // Monthly Revenue by Department (rows 5-9, B-N)
  monthlyRevenue: `'${TARGETS_SHEET}'!B5:N9`,
  // Business Days per month (row 12, B-M)
  businessDays: `'${TARGETS_SHEET}'!B12:M12`,
  // Daily Revenue targets (rows 16-20, B-N)
  dailyRevenue: `'${TARGETS_SHEET}'!B16:N20`,
  // Monthly Jobs by Department (rows 24-28, B-N)
  monthlyJobs: `'${TARGETS_SHEET}'!B24:N28`,
  // Daily Jobs targets (rows 39-43, B-N)
  dailyJobs: `'${TARGETS_SHEET}'!B39:N43`,
};

// Department order in the spreadsheet rows
const REVENUE_DEPARTMENTS = [
  'HVAC Install',
  'HVAC Service',
  'HVAC Maintenance',
  'Plumbing',
  'TOTAL',
];

const JOB_DEPARTMENTS = [
  'HVAC Install',
  'HVAC Service',
  'HVAC Maintenance',
  'Plumbing',
  'TOTAL',
];

interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors: string[];
}

async function getGoogleSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

function parseNumericValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const strValue = String(value).trim();
  // Remove currency formatting ($, commas)
  const cleanedValue = strValue.replace(/[$,]/g, '');
  const numValue = parseFloat(cleanedValue);
  return isNaN(numValue) ? 0 : numValue;
}

async function syncRevenueTargets(
  sheets: ReturnType<typeof google.sheets>,
  year: number
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsSynced = 0;

  try {
    // Fetch monthly revenue targets
    const monthlyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CELL_RANGES.monthlyRevenue,
    });

    // Fetch daily revenue targets
    const dailyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CELL_RANGES.dailyRevenue,
    });

    const monthlyData = monthlyResponse.data.values || [];
    const dailyData = dailyResponse.data.values || [];

    // Process each department row
    for (let deptIndex = 0; deptIndex < REVENUE_DEPARTMENTS.length; deptIndex++) {
      const department = REVENUE_DEPARTMENTS[deptIndex];
      const monthlyRow = monthlyData[deptIndex] || [];
      const dailyRow = dailyData[deptIndex] || [];

      // Process each month (columns B-M = indices 0-11)
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const month = monthIndex + 1;
        const monthlyTarget = parseNumericValue(monthlyRow[monthIndex]);
        const dailyTarget = parseNumericValue(dailyRow[monthIndex]);

        // Upsert the target
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
              synced_from_sheet: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'year,month,department,target_type' }
          );

        if (error) {
          errors.push(`Error saving revenue target for ${department} month ${month}: ${error.message}`);
        } else {
          recordsSynced++;
        }
      }
    }

    return { success: errors.length === 0, recordsSynced, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, recordsSynced, errors: [message] };
  }
}

async function syncJobTargets(
  sheets: ReturnType<typeof google.sheets>,
  year: number
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsSynced = 0;

  try {
    // Fetch monthly job targets
    const monthlyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CELL_RANGES.monthlyJobs,
    });

    // Fetch daily job targets
    const dailyResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CELL_RANGES.dailyJobs,
    });

    const monthlyData = monthlyResponse.data.values || [];
    const dailyData = dailyResponse.data.values || [];

    // Process each department row
    for (let deptIndex = 0; deptIndex < JOB_DEPARTMENTS.length; deptIndex++) {
      const department = JOB_DEPARTMENTS[deptIndex];
      const monthlyRow = monthlyData[deptIndex] || [];
      const dailyRow = dailyData[deptIndex] || [];

      // Process each month (columns B-M = indices 0-11)
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const month = monthIndex + 1;
        const monthlyTarget = parseNumericValue(monthlyRow[monthIndex]);
        const dailyTarget = parseNumericValue(dailyRow[monthIndex]);

        // Upsert the target
        const { error } = await supabase
          .from('dash_monthly_targets')
          .upsert(
            {
              year,
              month,
              department,
              target_type: 'jobs',
              target_value: monthlyTarget,
              daily_target_value: dailyTarget,
              synced_from_sheet: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'year,month,department,target_type' }
          );

        if (error) {
          errors.push(`Error saving job target for ${department} month ${month}: ${error.message}`);
        } else {
          recordsSynced++;
        }
      }
    }

    return { success: errors.length === 0, recordsSynced, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, recordsSynced, errors: [message] };
  }
}

async function syncBusinessDays(
  sheets: ReturnType<typeof google.sheets>,
  year: number
): Promise<SyncResult> {
  const errors: string[] = [];
  let recordsSynced = 0;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: CELL_RANGES.businessDays,
    });

    const data = response.data.values?.[0] || [];

    // Process each month
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const month = monthIndex + 1;
      const totalDays = parseNumericValue(data[monthIndex]);

      const { error } = await supabase
        .from('dash_business_days')
        .upsert(
          {
            year,
            month,
            total_days: totalDays,
            synced_from_sheet: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'year,month' }
        );

      if (error) {
        errors.push(`Error saving business days for month ${month}: ${error.message}`);
      } else {
        recordsSynced++;
      }
    }

    return { success: errors.length === 0, recordsSynced, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, recordsSynced, errors: [message] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const year = body.year || new Date().getFullYear();

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from('dash_sync_log')
      .insert({
        sync_type: 'targets',
        status: 'running',
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating sync log:', logError);
    }

    const sheets = await getGoogleSheetsClient();

    if (!sheets) {
      // Return mock success for now if no credentials configured
      // This allows testing the UI without Google Sheets setup
      if (syncLog) {
        await supabase
          .from('dash_sync_log')
          .update({
            completed_at: new Date().toISOString(),
            status: 'skipped',
            error_message: 'Google Sheets credentials not configured',
          })
          .eq('id', syncLog.id);
      }

      return NextResponse.json({
        success: false,
        message: 'Google Sheets credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.',
        hint: 'You can manually seed data using the /api/dash/targets/seed endpoint.',
      });
    }

    // Run all sync operations
    const [revenueResult, jobResult, daysResult] = await Promise.all([
      syncRevenueTargets(sheets, year),
      syncJobTargets(sheets, year),
      syncBusinessDays(sheets, year),
    ]);

    const totalRecordsSynced =
      revenueResult.recordsSynced + jobResult.recordsSynced + daysResult.recordsSynced;
    const allErrors = [...revenueResult.errors, ...jobResult.errors, ...daysResult.errors];
    const success = revenueResult.success && jobResult.success && daysResult.success;

    // Update sync log
    if (syncLog) {
      await supabase
        .from('dash_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: success ? 'completed' : 'completed_with_errors',
          records_synced: totalRecordsSynced,
          error_message: allErrors.length > 0 ? allErrors.join('; ') : null,
        })
        .eq('id', syncLog.id);
    }

    return NextResponse.json({
      success,
      year,
      recordsSynced: {
        revenue: revenueResult.recordsSynced,
        jobs: jobResult.recordsSynced,
        businessDays: daysResult.recordsSynced,
        total: totalRecordsSynced,
      },
      errors: allErrors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
