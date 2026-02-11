import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient, formatAddress } from '@/lib/servicetitan';

export const maxDuration = 60;

/**
 * Re-enrich jobs that are missing customer/location data.
 * Processes a batch of up to 50 jobs per call.
 * The UI calls this repeatedly until done.
 *
 * Returns: { done, enriched, remaining }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (session.user as any).role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const st = getServiceTitanClient();

  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  // Find jobs missing customer_name
  const { data: jobs, count } = await supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, st_customer_id, st_location_id', { count: 'exact' })
    .is('customer_name', null)
    .not('st_customer_id', 'is', null)
    .limit(50);

  const toEnrich = jobs || [];
  const remaining = (count || 0) - toEnrich.length;

  if (toEnrich.length === 0) {
    return NextResponse.json({ done: true, enriched: 0, remaining: 0 });
  }

  const customerIds = [...new Set(toEnrich.map(j => j.st_customer_id).filter(Boolean))] as number[];
  const locationIds = [...new Set(toEnrich.map(j => j.st_location_id).filter(Boolean))] as number[];

  const customerMap = new Map<number, { name: string; phone: string; email: string }>();
  const locationMap = new Map<number, string>();

  const BATCH_SIZE = 5;

  for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
    const batch = customerIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(id => st.getCustomer(id)));
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        customerMap.set(batch[idx], {
          name: result.value.name || '',
          phone: result.value.phoneNumber || '',
          email: result.value.email || '',
        });
      }
    });
  }

  for (let i = 0; i < locationIds.length; i += BATCH_SIZE) {
    const batch = locationIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(id => st.getLocation(id)));
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        locationMap.set(batch[idx], formatAddress(result.value));
      }
    });
  }

  let enriched = 0;
  for (const job of toEnrich) {
    const customer = customerMap.get(job.st_customer_id);
    const address = locationMap.get(job.st_location_id);
    if (customer || address) {
      const updates: Record<string, unknown> = {};
      if (customer?.name) updates.customer_name = customer.name;
      if (customer?.phone) updates.customer_phone = customer.phone;
      if (customer?.email) updates.customer_email = customer.email;
      if (address) updates.job_address = address;

      if (Object.keys(updates).length > 0) {
        await supabase.from('ap_install_jobs').update(updates).eq('id', job.id);
        enriched++;
      }
    }
  }

  return NextResponse.json({
    done: remaining <= 0,
    enriched,
    remaining: Math.max(remaining, 0),
  });
}
