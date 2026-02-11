import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, formatAddress } from '@/lib/servicetitan';
import { isValidCronRequest, formatLocalDate } from '@/lib/mm-utils';

export const maxDuration = 300;

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

  const { data: syncLog } = await supabase
    .from('mm_sync_log')
    .insert({
      sync_type: 'full',
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  const syncId = syncLog?.id;

  let membershipsProcessed = 0;
  let membershipsCreated = 0;
  let membershipsUpdated = 0;
  let servicesProcessed = 0;
  let eventsProcessed = 0;
  const errors: string[] = [];

  try {
    // Step 1: Sync membership types (small dataset, full replace)
    console.log('Syncing membership types...');
    const membershipTypes = await st.getMembershipTypes();
    for (const mt of membershipTypes) {
      try {
        await supabase.from('mm_membership_types').upsert(
          {
            st_type_id: mt.id,
            name: mt.name,
            status: mt.status,
            billing_frequency: mt.billingFrequency || null,
            duration_billing_periods: mt.durationBillingPeriods || null,
            service_count: mt.serviceCount || 0,
            raw_data: mt as any,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'st_type_id' }
        );
      } catch (err) {
        errors.push(`Error syncing membership type ${mt.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
    console.log(`Synced ${membershipTypes.length} membership types`);

    // Step 2: Sync all memberships (active filter may miss some)
    console.log('Syncing memberships...');
    const memberships = await st.getMemberships(false);

    // Get existing memberships from DB
    const stMembershipIds = memberships.map(m => m.id);
    const { data: existingMemberships } = stMembershipIds.length > 0
      ? await supabase
          .from('mm_memberships')
          .select('id, st_membership_id')
          .in('st_membership_id', stMembershipIds)
      : { data: [] };

    const existingMap = new Map(
      (existingMemberships || []).map(m => [m.st_membership_id, m])
    );

    // Build type name lookup
    const typeNameMap = new Map(membershipTypes.map(mt => [mt.id, mt.name]));

    // Build all records for batch upsert
    const membershipRecords = memberships.map(membership => {
      const typeName = typeNameMap.get(membership.membershipTypeId) || membership.membershipTypeName || null;
      return {
        st_membership_id: membership.id,
        st_membership_type_id: membership.membershipTypeId,
        membership_type_name: typeName,
        status: membership.status || 'Active',
        start_date: membership.from ? formatLocalDate(new Date(membership.from)) : null,
        end_date: membership.to ? formatLocalDate(new Date(membership.to)) : null,
        next_scheduled_billing_date: membership.nextScheduledBillingDate
          ? formatLocalDate(new Date(membership.nextScheduledBillingDate))
          : null,
        billing_frequency: membership.billingFrequency || null,
        sold_on: (membership as any).createdOn
          ? formatLocalDate(new Date((membership as any).createdOn))
          : null,
        sold_by_id: (membership as any).soldById || null,
        st_customer_id: membership.customerId,
        st_location_id: membership.locationId,
        raw_data: membership as any,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Batch upsert in chunks of 200
    for (let i = 0; i < membershipRecords.length; i += 200) {
      const chunk = membershipRecords.slice(i, i + 200);
      const { error: upsertErr } = await supabase
        .from('mm_memberships')
        .upsert(chunk, { onConflict: 'st_membership_id' });
      if (upsertErr) {
        errors.push(`Membership batch upsert error: ${upsertErr.message}`);
      }
    }
    membershipsProcessed = memberships.length;
    membershipsCreated = memberships.length - existingMap.size;
    membershipsUpdated = existingMap.size;
    console.log(`Synced ${membershipsProcessed} memberships (${membershipsCreated} new, ${membershipsUpdated} updated)`);

    // Step 3: Sync recurring services
    console.log('Syncing recurring services...');
    const recurringServices = await st.getRecurringServices(false);
    const validServices = recurringServices.filter(s => s.membershipId != null);
    const serviceRecords = validServices.map(service => ({
      st_service_id: service.id,
      st_membership_id: service.membershipId,
      name: service.name,
      status: service.status || 'Active',
      recurrence_type: service.recurrenceType || null,
      recurrence_interval: service.recurrenceInterval || 1,
      duration_type: service.durationType || null,
      next_service_date: service.nextServiceDate
        ? formatLocalDate(new Date(service.nextServiceDate))
        : null,
      st_location_id: service.locationId,
      raw_data: service as any,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < serviceRecords.length; i += 200) {
      const chunk = serviceRecords.slice(i, i + 200);
      const { error: upsertErr } = await supabase
        .from('mm_recurring_services')
        .upsert(chunk, { onConflict: 'st_service_id' });
      if (upsertErr) {
        errors.push(`Service batch upsert error: ${upsertErr.message}`);
      }
    }
    servicesProcessed = validServices.length;
    console.log(`Synced ${servicesProcessed} recurring services`);

    // Step 4: Sync recurring service events (current + prior year)
    console.log('Syncing recurring service events...');
    const now = new Date();
    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;

    const events = await st.getRecurringServiceEvents(
      `${priorYear}-01-01`,
      `${currentYear}-12-31`
    );

    const eventRecords = events.map(event => ({
      st_event_id: event.id,
      st_service_id: event.recurringServiceId,
      st_membership_id: event.membershipId || null,
      st_job_id: event.jobId || null,
      name: event.name || null,
      status: event.status || 'Scheduled',
      scheduled_date: event.startsOn
        ? formatLocalDate(new Date(event.startsOn))
        : null,
      completed_date: event.completedOn
        ? formatLocalDate(new Date(event.completedOn))
        : null,
      st_location_id: event.locationId || null,
      raw_data: event as any,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < eventRecords.length; i += 200) {
      const chunk = eventRecords.slice(i, i + 200);
      const { error: upsertErr } = await supabase
        .from('mm_recurring_service_events')
        .upsert(chunk, { onConflict: 'st_event_id' });
      if (upsertErr) {
        errors.push(`Event batch upsert error: ${upsertErr.message}`);
      }
    }
    eventsProcessed = events.length;
    console.log(`Synced ${eventsProcessed} recurring service events`);

    // Step 5: Compute aggregates on mm_memberships (in-memory from fetched data)
    console.log('Computing membership aggregates...');
    await computeMembershipAggregates(supabase, recurringServices, events);

    // Step 6: Bulk enrich all unenriched memberships
    await bulkEnrichMemberships(st, supabase, errors);

    // Update sync log
    if (syncId) {
      await supabase
        .from('mm_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          memberships_processed: membershipsProcessed,
          memberships_created: membershipsCreated,
          memberships_updated: membershipsUpdated,
          services_processed: servicesProcessed,
          events_processed: eventsProcessed,
          errors: errors.length > 0 ? errors.join('\n') : null,
          status: 'completed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({
      success: true,
      memberships_processed: membershipsProcessed,
      memberships_created: membershipsCreated,
      memberships_updated: membershipsUpdated,
      services_processed: servicesProcessed,
      events_processed: eventsProcessed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync failed:', msg);

    if (syncId) {
      await supabase
        .from('mm_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          memberships_processed: membershipsProcessed,
          memberships_created: membershipsCreated,
          memberships_updated: membershipsUpdated,
          services_processed: servicesProcessed,
          events_processed: eventsProcessed,
          errors: msg,
          status: 'failed',
        })
        .eq('id', syncId);
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Bulk enrich all unenriched memberships using ST bulk customer/location APIs.
 */
async function bulkEnrichMemberships(
  st: ReturnType<typeof getServiceTitanClient>,
  supabase: ReturnType<typeof getServerSupabase>,
  errors: string[]
) {
  // Get ALL unenriched memberships
  const { data: unenriched } = await supabase
    .from('mm_memberships')
    .select('st_membership_id, st_customer_id, st_location_id')
    .is('customer_name', null)
    .not('st_customer_id', 'is', null);

  if (!unenriched || unenriched.length === 0) {
    console.log('All memberships already enriched');
    return;
  }

  console.log(`Enriching ${unenriched.length} memberships with customer/location data...`);

  // Get unique IDs
  const customerIds = [...new Set(unenriched.map(m => m.st_customer_id).filter(Boolean))] as number[];
  const locationIds = [...new Set(unenriched.map(m => m.st_location_id).filter(Boolean))] as number[];

  console.log(`Fetching ${customerIds.length} unique customers and ${locationIds.length} unique locations...`);

  try {
    // Bulk fetch customers and locations in parallel
    const [customers, locations] = await Promise.all([
      st.getCustomersByIds(customerIds),
      st.getLocationsByIds(locationIds),
    ]);

    // Build lookup maps
    const customerMap = new Map<number, { name: string; phone: string; email: string }>();
    for (const c of customers) {
      customerMap.set(c.id, {
        name: c.name || '',
        phone: c.phoneNumber || '',
        email: c.email || '',
      });
    }

    const locationMap = new Map<number, { address: string; name: string }>();
    for (const l of locations) {
      locationMap.set(l.id, {
        address: formatAddress(l),
        name: l.name || '',
      });
    }

    console.log(`Got ${customerMap.size} customers, ${locationMap.size} locations. Updating memberships...`);

    // Batch update memberships in parallel chunks
    const updateBatch: { stId: number; updates: Record<string, unknown> }[] = [];
    for (const m of unenriched) {
      const customer = customerMap.get(m.st_customer_id);
      const location = m.st_location_id ? locationMap.get(m.st_location_id) : null;
      const updates: Record<string, unknown> = {};
      if (customer?.name) updates.customer_name = customer.name;
      if (customer?.phone) updates.customer_phone = customer.phone;
      if (customer?.email) updates.customer_email = customer.email;
      if (location?.address) updates.customer_address = location.address;
      if (location?.name) updates.location_name = location.name;

      if (Object.keys(updates).length > 0) {
        updateBatch.push({ stId: m.st_membership_id, updates });
      }
    }

    // Update in parallel chunks of 50
    for (let i = 0; i < updateBatch.length; i += 50) {
      const chunk = updateBatch.slice(i, i + 50);
      await Promise.all(
        chunk.map(({ stId, updates }) =>
          supabase.from('mm_memberships').update(updates).eq('st_membership_id', stId)
        )
      );
    }

    console.log(`Enriched ${updateBatch.length} memberships`);
  } catch (err) {
    const msg = `Enrichment error: ${err instanceof Error ? err.message : 'Unknown'}`;
    console.error(msg);
    errors.push(msg);
  }

  // Resolve sold_by_name for memberships missing it
  try {
    const { data: needsEmployee } = await supabase
      .from('mm_memberships')
      .select('st_membership_id, sold_by_id')
      .is('sold_by_name', null)
      .not('sold_by_id', 'is', null);

    if (needsEmployee && needsEmployee.length > 0) {
      const employeeIds = [...new Set(needsEmployee.map(m => m.sold_by_id).filter(Boolean))] as number[];
      console.log(`Resolving ${employeeIds.length} unique employee names...`);
      const employees = await st.getEmployeesByIds(employeeIds);
      const employeeMap = new Map<number, string>();
      for (const e of employees) {
        employeeMap.set(e.id, e.name || '');
      }

      const empUpdateBatch: { stId: number; name: string }[] = [];
      for (const m of needsEmployee) {
        const name = employeeMap.get(m.sold_by_id);
        if (name) {
          empUpdateBatch.push({ stId: m.st_membership_id, name });
        }
      }

      for (let i = 0; i < empUpdateBatch.length; i += 50) {
        const chunk = empUpdateBatch.slice(i, i + 50);
        await Promise.all(
          chunk.map(({ stId, name }) =>
            supabase.from('mm_memberships').update({ sold_by_name: name }).eq('st_membership_id', stId)
          )
        );
      }
      console.log(`Resolved ${empUpdateBatch.length} employee names`);
    }
  } catch (err) {
    const msg = `Employee name resolution error: ${err instanceof Error ? err.message : 'Unknown'}`;
    console.error(msg);
    errors.push(msg);
  }
}

/**
 * Compute aggregate visit counts and next_visit_due_date for all memberships.
 * Uses in-memory data from the sync to avoid thousands of individual DB queries.
 */
async function computeMembershipAggregates(
  supabase: ReturnType<typeof getServerSupabase>,
  recurringServices: any[],
  events: any[]
) {
  // Fetch all active memberships
  const { data: memberships } = await supabase
    .from('mm_memberships')
    .select('id, st_membership_id, end_date')
    .eq('status', 'Active');

  if (!memberships || memberships.length === 0) return;

  const today = new Date();
  const todayStr = formatLocalDate(today);

  // Build lookup maps from in-memory data
  // Active service counts per membership
  const serviceCountMap = new Map<number, number>();
  for (const s of recurringServices) {
    if ((s.status || 'Active') === 'Active') {
      serviceCountMap.set(s.membershipId, (serviceCountMap.get(s.membershipId) || 0) + 1);
    }
  }

  // Event counts and next scheduled date per membership
  const completedCountMap = new Map<number, number>();
  const scheduledCountMap = new Map<number, number>();
  const nextEventDateMap = new Map<number, string>();

  for (const e of events) {
    const mid = e.membershipId;
    if (!mid) continue;
    const status = e.status || 'Scheduled';
    if (status === 'Done') {
      completedCountMap.set(mid, (completedCountMap.get(mid) || 0) + 1);
    } else if (status === 'Scheduled') {
      scheduledCountMap.set(mid, (scheduledCountMap.get(mid) || 0) + 1);
      const scheduledDate = e.startsOn ? formatLocalDate(new Date(e.startsOn)) : null;
      if (scheduledDate && scheduledDate >= todayStr) {
        const existing = nextEventDateMap.get(mid);
        if (!existing || scheduledDate < existing) {
          nextEventDateMap.set(mid, scheduledDate);
        }
      }
    }
  }

  // Next service date fallback per membership
  const nextServiceDateMap = new Map<number, string>();
  for (const s of recurringServices) {
    if ((s.status || 'Active') === 'Active' && s.nextServiceDate) {
      const dateStr = formatLocalDate(new Date(s.nextServiceDate));
      const existing = nextServiceDateMap.get(s.membershipId);
      if (!existing || dateStr < existing) {
        nextServiceDateMap.set(s.membershipId, dateStr);
      }
    }
  }

  // Build update records and batch update
  const updateRecords: { id: number; updates: Record<string, unknown> }[] = [];

  for (const membership of memberships) {
    const stId = membership.st_membership_id;
    const nextVisitDueDate = nextEventDateMap.get(stId) || nextServiceDateMap.get(stId) || null;

    let daysUntilExpiry: number | null = null;
    if (membership.end_date) {
      const endDate = new Date(membership.end_date + 'T00:00:00');
      daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    updateRecords.push({
      id: membership.id,
      updates: {
        total_visits_expected: serviceCountMap.get(stId) || 0,
        total_visits_completed: completedCountMap.get(stId) || 0,
        total_visits_scheduled: scheduledCountMap.get(stId) || 0,
        next_visit_due_date: nextVisitDueDate,
        days_until_expiry: daysUntilExpiry,
        updated_at: new Date().toISOString(),
      },
    });
  }

  // Batch update in chunks of 50 (each is a separate update by id)
  for (let i = 0; i < updateRecords.length; i += 50) {
    const chunk = updateRecords.slice(i, i + 50);
    await Promise.all(
      chunk.map(({ id, updates }) =>
        supabase.from('mm_memberships').update(updates).eq('id', id)
      )
    );
  }
}

// Support both GET and POST for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
