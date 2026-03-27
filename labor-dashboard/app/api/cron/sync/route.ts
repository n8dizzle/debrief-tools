import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, STGrossPayItem } from '@/lib/servicetitan';
import { isValidCronRequest, formatLocalDate, determineTradeFromBU } from '@/lib/labor-utils';
import crypto from 'crypto';

/**
 * Generate a deterministic hash for a gross pay item since ST API returns null `id`.
 * Uses payrollId + employeeId + startedOn + activity + amount as composite key.
 */
function generateItemHash(item: STGrossPayItem): string {
  const parts = [
    item.payrollId ?? '',
    item.employeeId ?? '',
    item.startedOn ?? '',
    item.endedOn ?? '',
    item.activity ?? '',
    item.amount ?? 0,
    item.jobId ?? 0,
  ].join('|');
  return crypto.createHash('md5').update(parts).digest('hex');
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const isCron = isValidCronRequest(request);
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.user.role || 'employee';
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  // Determine sync range: daily 6am = 90 days, intraday = 7 days
  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const now = new Date();
  const hour = now.getHours();
  const defaultDays = (hour < 8 || isCron) ? 90 : 7; // Early morning = full sync
  const days = daysParam ? parseInt(daysParam) : defaultDays;
  const syncType = days > 14 ? 'full' : 'incremental';

  const { data: syncLog } = await supabase
    .from('labor_sync_log')
    .insert({
      sync_type: syncType,
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  const syncId = syncLog?.id;

  let itemsProcessed = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  const errors: string[] = [];

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = formatLocalDate(startDate);
    const endStr = formatLocalDate(endDate);

    console.log(`Labor sync: ${syncType} (${days} days) from ${startStr} to ${endStr}`);

    // Fetch business units for trade mapping
    const businessUnits = await st.getAllBusinessUnits();
    const buNameMap = new Map(businessUnits.map(bu => [bu.id, bu.name]));

    // Fetch employees + gross pay items + adjustments in parallel
    const [technicians, grossPayItems, adjustments] = await Promise.all([
      st.getTechnicians(false),
      st.getGrossPayItemsFull(startStr, endStr),
      st.getPayrollAdjustments(startStr, endStr),
    ]);

    // =============================================
    // SYNC EMPLOYEES
    // =============================================
    if (technicians.length > 0) {
      for (const tech of technicians) {
        const buName = tech.businessUnitId ? buNameMap.get(tech.businessUnitId) || null : null;
        const trade = determineTradeFromBU(buName);

        await supabase
          .from('labor_employees')
          .upsert(
            {
              st_employee_id: tech.id,
              name: tech.name,
              employee_type: 'Technician',
              trade: trade,
              is_active: tech.active,
              business_unit_id: tech.businessUnitId || null,
              business_unit_name: buName,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'st_employee_id', ignoreDuplicates: false }
          );
      }
      console.log(`Synced ${technicians.length} employees`);
    }

    // Build employee name lookup from gross pay items (catches non-technician employees)
    const employeeNames = new Map<number, { name: string; type: string }>();
    for (const item of grossPayItems) {
      if (item.employeeId && item.employeeName && !employeeNames.has(item.employeeId)) {
        employeeNames.set(item.employeeId, {
          name: item.employeeName,
          type: item.employeeType || 'Unknown',
        });
      }
    }

    // Upsert employees from pay items that aren't in technicians list
    const techIds = new Set(technicians.map(t => t.id));
    for (const [empId, info] of employeeNames) {
      if (!techIds.has(empId)) {
        await supabase
          .from('labor_employees')
          .upsert(
            {
              st_employee_id: empId,
              name: info.name,
              employee_type: info.type,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'st_employee_id', ignoreDuplicates: false }
          );
      }
    }

    // =============================================
    // SYNC GROSS PAY ITEMS (delete-then-insert for date range)
    // =============================================
    console.log(`Processing ${grossPayItems.length} gross pay items...`);

    // Delete existing items in the sync date range, then insert fresh
    const { error: deleteError } = await supabase
      .from('labor_gross_pay_items')
      .delete()
      .gte('date', startStr)
      .lte('date', endStr);

    if (deleteError) {
      errors.push(`Delete error: ${deleteError.message}`);
      console.error('Delete error:', deleteError.message);
    }

    // Deduplicate by item_hash (ST can return items with identical composite keys)
    const seenHashes = new Set<string>();

    const BATCH_SIZE = 100;
    for (let i = 0; i < grossPayItems.length; i += BATCH_SIZE) {
      const batch = grossPayItems.slice(i, i + BATCH_SIZE);

      const rows: Record<string, unknown>[] = [];
      for (const item of batch) {
        itemsProcessed++;
        const hash = generateItemHash(item);
        if (seenHashes.has(hash)) continue; // Skip duplicates
        seenHashes.add(hash);

        const buName = item.businessUnitId ? buNameMap.get(item.businessUnitId) || item.businessUnitName || null : item.businessUnitName || null;
        const trade = determineTradeFromBU(buName);

        let dateStr: string;
        if (item.date) {
          const d = new Date(item.date);
          dateStr = formatLocalDate(d);
        } else if (item.startedOn) {
          const d = new Date(item.startedOn);
          dateStr = formatLocalDate(d);
        } else {
          dateStr = formatLocalDate(new Date());
        }

        rows.push({
          item_hash: hash,
          employee_id: item.employeeId,
          employee_name: item.employeeName || employeeNames.get(item.employeeId)?.name || null,
          employee_type: item.employeeType || employeeNames.get(item.employeeId)?.type || null,
          gross_pay_item_type: item.grossPayItemType || 'Unknown',
          date: dateStr,
          started_on: item.startedOn || null,
          ended_on: item.endedOn || null,
          amount: item.amount || 0,
          paid_duration_hours: item.paidDurationHours || 0,
          paid_time_type: item.paidTimeType || null,
          activity: item.activity || null,
          job_id: item.jobId || null,
          job_number: item.jobNumber || null,
          invoice_id: item.invoiceId || null,
          customer_name: item.customerName || null,
          job_type_name: item.jobTypeName || null,
          business_unit_id: item.businessUnitId || null,
          business_unit_name: buName,
          trade: trade,
          synced_at: new Date().toISOString(),
        });
      }

      if (rows.length === 0) continue;

      const { error: insertError, data: insertData } = await supabase
        .from('labor_gross_pay_items')
        .insert(rows)
        .select('id');

      if (insertError) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${insertError.message}`);
        console.error(`Batch insert error:`, insertError.message);
      } else {
        itemsCreated += (insertData?.length || 0);
      }
    }

    // =============================================
    // SYNC PAYROLL ADJUSTMENTS (delete-then-insert)
    // =============================================
    if (adjustments.length > 0) {
      console.log(`Processing ${adjustments.length} payroll adjustments...`);

      // Delete existing adjustments in the date range
      await supabase
        .from('labor_payroll_adjustments')
        .delete()
        .gte('date', startStr)
        .lte('date', endStr);

      const adjRows = adjustments.map(adj => {
        let dateStr: string;
        if (adj.date) {
          const d = new Date(adj.date);
          dateStr = formatLocalDate(d);
        } else {
          dateStr = formatLocalDate(new Date());
        }

        return {
          st_adjustment_id: adj.id,
          employee_id: adj.employeeId,
          employee_name: adj.employeeName || employeeNames.get(adj.employeeId)?.name || null,
          adjustment_type: adj.type || null,
          amount: adj.amount || 0,
          date: dateStr,
          memo: adj.memo || null,
          synced_at: new Date().toISOString(),
        };
      });

      for (let i = 0; i < adjRows.length; i += BATCH_SIZE) {
        const batch = adjRows.slice(i, i + BATCH_SIZE);
        const { error: adjError } = await supabase
          .from('labor_payroll_adjustments')
          .insert(batch);

        if (adjError) {
          errors.push(`Adjustment batch error: ${adjError.message}`);
          console.error(`Adjustment insert error:`, adjError.message);
        }
      }
    }

    // Update sync log
    if (syncId) {
      await supabase
        .from('labor_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          items_updated: itemsUpdated,
          errors: errors.length > 0 ? errors.join('\n') : null,
          status: 'completed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({
      success: true,
      sync_type: syncType,
      days,
      items_processed: itemsProcessed,
      gross_pay_items: grossPayItems.length,
      adjustments: adjustments.length,
      employees: technicians.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Labor sync failed:', msg);

    if (syncId) {
      await supabase
        .from('labor_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          items_processed: itemsProcessed,
          items_created: itemsCreated,
          items_updated: itemsUpdated,
          errors: msg,
          status: 'failed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Support both GET and POST for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
