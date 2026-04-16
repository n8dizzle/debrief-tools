export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';
import { formatLocalDate, isValidCronRequest } from '@/lib/payroll-utils';

async function runSync(request: Request) {
  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  // Log sync start
  const { data: syncLog } = await supabase
    .from('pr_sync_log')
    .insert({
      sync_type: 'cron',
      started_at: new Date().toISOString(),
      status: 'running',
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
    })
    .select()
    .single();

  const syncId = syncLog?.id;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  const errors: string[] = [];

  try {
    // Determine sync window
    const now = new Date();
    const endDate = formatLocalDate(now);
    // Year-to-date: go back to Jan 1 of current year
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const startDate = formatLocalDate(yearStart);

    // ============================================
    // 1. SYNC EMPLOYEES (Technicians + All Employees)
    // ============================================
    console.log('Syncing employees...');
    const [technicians, employees, businessUnits] = await Promise.all([
      st.getTechnicians(false),
      st.getEmployees(false),
      st.getBusinessUnits(),
    ]);

    const buMap = new Map(businessUnits.map(bu => [bu.id, bu]));

    // Build employee records with business unit info
    const techMap = new Map(technicians.map(tech => [tech.id, tech]));
    const employeeRecords: {
      st_employee_id: number;
      name: string;
      business_unit_id: number | null;
      business_unit_name: string | null;
      is_active: boolean;
      role: string | null;
      updated_at: string;
    }[] = [];

    // Start with technicians (they have business unit info)
    for (const tech of technicians) {
      const bu = tech.businessUnitId ? buMap.get(tech.businessUnitId) : null;
      employeeRecords.push({
        st_employee_id: tech.id,
        name: tech.name,
        business_unit_id: tech.businessUnitId || null,
        business_unit_name: bu?.name || null,
        is_active: tech.active,
        role: 'Technician',
        updated_at: new Date().toISOString(),
      });
    }

    // Add employees not already covered by technicians
    for (const emp of employees) {
      if (!techMap.has(emp.id)) {
        const bu = emp.businessUnitId ? buMap.get(emp.businessUnitId) : null;
        employeeRecords.push({
          st_employee_id: emp.id,
          name: emp.name,
          business_unit_id: emp.businessUnitId || null,
          business_unit_name: bu?.name || null,
          is_active: emp.active,
          role: emp.role || null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    for (let i = 0; i < employeeRecords.length; i += 50) {
      const chunk = employeeRecords.slice(i, i + 50);
      const { error } = await supabase
        .from('pr_employees')
        .upsert(chunk, { onConflict: 'st_employee_id' });
      if (error) {
        errors.push(`Employees batch error: ${error.message}`);
      } else {
        totalProcessed += chunk.length;
      }
    }
    console.log(`Employees: ${technicians.length} technicians + ${employees.length} employees (${employeeRecords.length} unique) processed`);

    // Build employee lookup
    const { data: allEmployees } = await supabase
      .from('pr_employees')
      .select('id, st_employee_id');
    const empMap = new Map((allEmployees || []).map(e => [e.st_employee_id, e.id]));

    // ============================================
    // 2. SYNC GROSS PAY ITEMS (single paginated call)
    // ST's modifiedOnOrAfter returns all historically-modified records,
    // so we fetch all pages and filter by actual date client-side.
    // Use a recent modifiedOnOrAfter to limit the response set.
    // ============================================
    console.log('Syncing gross pay items...');
    // Use 14 days ago as the modification window — catches any recent changes
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const payItemsModifiedSince = formatLocalDate(twoWeeksAgo);
    const payItemsStartDate = startDate;

    const payItems = await st.getGrossPayItems(payItemsModifiedSince);
    console.log(`Fetched ${payItems.length} gross pay items from ST`);

    // Delete existing in the lookback window and reinsert
    await supabase
      .from('pr_gross_pay_items')
      .delete()
      .gte('date', payItemsStartDate);

    if (payItems.length > 0) {
      const payItemRecords = payItems
        .filter(item => {
          const d = item.date?.split('T')[0];
          return d && d >= payItemsStartDate && d <= endDate && empMap.has(item.employeeId);
        })
        .map(item => ({
          st_pay_item_id: item.id || null,
          employee_id: empMap.get(item.employeeId)!,
          st_employee_id: item.employeeId,
          payroll_period_id: null,
          st_payroll_id: item.payrollId || null,
          st_job_id: item.jobId || null,
          job_number: item.jobNumber || null,
          business_unit_id: null,
          business_unit_name: item.businessUnitName || null,
          pay_type: classifyPayType(item.paidTimeType, item.activity),
          hours: item.paidDurationHours || 0,
          amount: item.amount || 0,
          activity: item.activity || null,
          date: item.date?.split('T')[0] || null,
        }));

      for (let i = 0; i < payItemRecords.length; i += 100) {
        const chunk = payItemRecords.slice(i, i + 100);
        const { error } = await supabase
          .from('pr_gross_pay_items')
          .insert(chunk);
        if (error) {
          errors.push(`Pay items batch error: ${error.message}`);
        } else {
          totalCreated += chunk.length;
        }
        totalProcessed += chunk.length;
      }
    }
    console.log(`Gross pay items: ${payItems.length} processed`);

    // ============================================
    // 4. SYNC JOB TIMESHEETS (delete + reinsert)
    // ============================================
    console.log('Syncing job timesheets...');
    let jobTimesheetCount = 0;
    try {
      const jobTimesheets = await st.getJobTimesheets(startDate, endDate);
      console.log(`Fetched ${jobTimesheets.length} job timesheets from ST`);
      jobTimesheetCount = jobTimesheets.length;

      if (jobTimesheets.length > 0) {
        await supabase
          .from('pr_job_timesheets')
          .delete()
          .gte('date', startDate)
          .lte('date', endDate);

        const jobTsRecords = jobTimesheets
          .filter(ts => empMap.has(ts.employeeId))
          .map(ts => {
            const startMs = ts.startedOn ? new Date(ts.startedOn).getTime() : 0;
            const endMs = ts.endedOn ? new Date(ts.endedOn).getTime() : 0;
            const durationHours = startMs && endMs ? (endMs - startMs) / 3600000 : null;
            return {
              st_timesheet_id: ts.id || null,
              employee_id: empMap.get(ts.employeeId)!,
              st_employee_id: ts.employeeId,
              st_job_id: ts.jobId || null,
              job_number: ts.jobNumber || null,
              clock_in: ts.startedOn || null,
              clock_out: ts.endedOn || null,
              duration_hours: durationHours ? Math.round(durationHours * 100) / 100 : null,
              date: ts.startedOn?.split('T')[0] || null,
            };
          });

        for (let i = 0; i < jobTsRecords.length; i += 100) {
          const chunk = jobTsRecords.slice(i, i + 100);
          const { error } = await supabase
            .from('pr_job_timesheets')
            .insert(chunk);
          if (error) {
            errors.push(`Job timesheets batch error: ${error.message}`);
          } else {
            totalCreated += chunk.length;
          }
          totalProcessed += chunk.length;
        }
      }
    } catch (err) {
      console.warn('Job timesheets endpoint not available:', err);
      errors.push('Job timesheets endpoint not available (may not be enabled)');
    }
    console.log(`Job timesheets: ${jobTimesheetCount} processed`);

    // ============================================
    // 5. SYNC NON-JOB TIMESHEETS (delete + reinsert)
    // ============================================
    console.log('Syncing non-job timesheets...');
    const nonJobTimesheets = await st.getNonJobTimesheets(startDate, endDate);
    console.log(`Fetched ${nonJobTimesheets.length} non-job timesheets from ST`);

    if (nonJobTimesheets.length > 0) {
      // Delete all existing records for the sync range (and any leftover null-date records)
      await supabase
        .from('pr_nonjob_timesheets')
        .delete()
        .or(`date.gte.${startDate},date.is.null`);

      const nonJobTsRecords = nonJobTimesheets
        .filter(ts => empMap.has(ts.employeeId) && ts.startedOn)
        .map(ts => {
          const startMs = ts.startedOn ? new Date(ts.startedOn).getTime() : 0;
          const endMs = ts.endedOn ? new Date(ts.endedOn).getTime() : 0;
          const durationHours = startMs && endMs ? (endMs - startMs) / 3600000 : null;
          return {
            st_timesheet_id: ts.id || null,
            employee_id: empMap.get(ts.employeeId)!,
            st_employee_id: ts.employeeId,
            timesheet_code_id: ts.timesheetCodeId || null,
            timesheet_code_name: null,
            clock_in: ts.startedOn || null,
            clock_out: ts.endedOn || null,
            duration_hours: durationHours ? Math.round(durationHours * 100) / 100 : null,
            date: ts.startedOn?.split('T')[0] || null,
          };
        });

      for (let i = 0; i < nonJobTsRecords.length; i += 100) {
        const chunk = nonJobTsRecords.slice(i, i + 100);
        const { error } = await supabase
          .from('pr_nonjob_timesheets')
          .insert(chunk);
        if (error) {
          errors.push(`Non-job timesheets batch error: ${error.message}`);
        } else {
          totalCreated += chunk.length;
        }
        totalProcessed += chunk.length;
      }
    }
    console.log(`Non-job timesheets: ${nonJobTimesheets.length} processed`);

    // ============================================
    // 6. SYNC ADJUSTMENTS (per recent payroll period)
    // ============================================
    console.log('Syncing payroll adjustments...');
    // Get unique payroll IDs from the pay items we just fetched
    const payItemPayrollIds = Array.from(new Set(payItems.filter(p => p.payrollId).map(p => p.payrollId!)));
    const recentPayrollIds = payItemPayrollIds.slice(-5);

    for (const payrollId of recentPayrollIds) {
      const adjustments = await st.getPayrollAdjustments(payrollId);
      const payrollPeriodId = null;

      const adjRecords = adjustments
        .filter(adj => empMap.has(adj.employeeId))
        .map(adj => ({
          st_adjustment_id: adj.id || null,
          employee_id: empMap.get(adj.employeeId)!,
          st_employee_id: adj.employeeId,
          payroll_period_id: payrollPeriodId || null,
          st_payroll_id: adj.payrollId || payrollId,
          adjustment_type: adj.adjustmentTypeName || adj.activity || null,
          amount: adj.amount || 0,
          memo: adj.memo || null,
          date: adj.date?.split('T')[0] || null,
        }));

      if (adjRecords.length > 0) {
        const { error } = await supabase
          .from('pr_payroll_adjustments')
          .upsert(adjRecords, { onConflict: 'st_adjustment_id' });
        if (error) {
          errors.push(`Adjustments batch error: ${error.message}`);
        } else {
          totalProcessed += adjRecords.length;
          totalCreated += adjRecords.length;
        }
      }
    }
    console.log('Payroll adjustments synced');

    // ============================================
    // 7. SYNC JOB SPLITS (delete + reinsert)
    // ============================================
    console.log('Syncing job splits...');
    const jobSplits = await st.getJobSplits(startDate, endDate);
    console.log(`Fetched ${jobSplits.length} job splits from ST`);

    if (jobSplits.length > 0) {
      await supabase
        .from('pr_job_splits')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

      const splitRecords = jobSplits
        .filter(split => empMap.has(split.employeeId))
        .map(split => ({
          st_split_id: split.id || null,
          st_job_id: split.jobId || null,
          job_number: split.jobNumber || null,
          employee_id: empMap.get(split.employeeId)!,
          st_employee_id: split.employeeId,
          split_percentage: split.splitPercentage || null,
          split_amount: split.splitAmount || null,
          date: split.date?.split('T')[0] || null,
        }));

      for (let i = 0; i < splitRecords.length; i += 100) {
        const chunk = splitRecords.slice(i, i + 100);
        const { error } = await supabase
          .from('pr_job_splits')
          .insert(chunk);
        if (error) {
          errors.push(`Job splits batch error: ${error.message}`);
        } else {
          totalCreated += chunk.length;
        }
        totalProcessed += chunk.length;
      }
    }
    console.log(`Job splits: ${jobSplits.length} processed`);

    // Update sync log
    if (syncId) {
      await supabase
        .from('pr_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: errors.length > 0 ? 'partial' : 'success',
          records_processed: totalProcessed,
          records_created: totalCreated,
          records_updated: totalUpdated,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
        })
        .eq('id', syncId);
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      created: totalCreated,
      updated: totalUpdated,
      errors: errors.length,
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    errors.push(error.message || 'Unknown error');

    if (syncId) {
      await supabase
        .from('pr_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'error',
          records_processed: totalProcessed,
          records_created: totalCreated,
          records_updated: totalUpdated,
          errors: JSON.stringify(errors),
        })
        .eq('id', syncId);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function classifyPayType(paidTimeType: string | undefined, activity: string | undefined): string {
  const type = (paidTimeType || '').toLowerCase();
  const act = (activity || '').toLowerCase();

  if (type.includes('overtime') || type.includes('ot')) return 'Overtime';
  if (type.includes('performance') || act.includes('performance') || act.includes('bonus') || act.includes('spiff')) return 'PerformancePay';

  // Commission/sales activities are performance pay
  if (act.includes('% sale') || act.includes('% install') || act.includes('% flip') ||
      act.includes('commission') || act.includes('membership sales') ||
      act.includes('mrket lead') || act.includes('tgl sales')) return 'PerformancePay';

  if (type.includes('regular') || type.includes('normal') || type === '') return 'Regular';
  return 'Other';
}

export async function POST(request: Request) {
  // Check cron auth first
  if (isValidCronRequest(request)) {
    return runSync(request);
  }

  // Check session auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return runSync(request);
}

export async function GET(request: Request) {
  return POST(request);
}
