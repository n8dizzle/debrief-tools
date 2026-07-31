import { formatAddress, STLocation } from './servicetitan';

/**
 * Minimal shapes this module needs from its collaborators, so the sync route can
 * pass the real ServiceTitan/Supabase clients and tests can pass fakes.
 */
export interface EnrichCustomer {
  name?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

export interface EnrichSTClient {
  getCustomer(id: number): Promise<EnrichCustomer | null>;
  getLocation(id: number): Promise<STLocation | null>;
}

export interface PendingJobRow {
  id: string;
  st_customer_id: number;
  st_location_id: number | null;
}

/**
 * Just the two query chains this module builds, structurally typed so the real
 * SupabaseClient satisfies it. The terminal steps are `PromiseLike`, not
 * `Promise` — Supabase's query builder is a thenable and has no catch/finally.
 */
export interface EnrichSupabase {
  from(table: string): {
    select(cols: string): {
      is(col: string, val: null): {
        not(col: string, op: string, val: null): {
          order(col: string, opts: { ascending: boolean }): {
            limit(n: number): PromiseLike<{ data: PendingJobRow[] | null; error: unknown }>;
          };
        };
      };
    };
    update(values: Record<string, unknown>): {
      eq(col: string, val: string): PromiseLike<unknown>;
    };
  };
}

export interface EnrichResult {
  enriched: number;
  attempted: number;
  remaining: number;
}

const BATCH_SIZE = 5;
const MAX_PER_RUN = 100;

/**
 * Fill in customer/location details for any job still missing them.
 *
 * Driven off the DB (`customer_name is null`) rather than off one sync run's new
 * jobs, so it covers both rows just inserted and stragglers from earlier runs.
 * That matters: this is the only writer of customer_name, and a job that misses
 * its one chance is otherwise blank forever — showing "—" in the Payment Tracker
 * Customer column and invisible to search, which filters on customer_name.
 *
 * Batched with per-batch writes and a time budget, so a slow ServiceTitan
 * response costs us the tail of the queue, never the rows already resolved.
 * Whatever doesn't fit is picked up by the next sync.
 */
export async function enrichPendingJobs(
  st: EnrichSTClient,
  supabase: EnrichSupabase,
  budgetMs = 10000,
  now: () => number = Date.now
): Promise<EnrichResult> {
  const deadline = now() + budgetMs;

  const { data: pending, error } = await supabase
    .from('ap_install_jobs')
    .select('id, st_customer_id, st_location_id')
    .is('customer_name', null)
    .not('st_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN);

  // Never fail silently here: a swallowed error is what let blank customers sit
  // unnoticed for months in the first place.
  if (error) {
    console.error('Customer/location enrichment: could not load pending jobs:', error);
    return { enriched: 0, attempted: 0, remaining: 0 };
  }
  if (!pending || pending.length === 0) return { enriched: 0, attempted: 0, remaining: 0 };

  let enriched = 0;
  let attempted = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (now() > deadline) break;
    const batch = pending.slice(i, i + BATCH_SIZE);
    attempted += batch.length;

    const [customers, locations] = await Promise.all([
      Promise.allSettled(batch.map(j => st.getCustomer(j.st_customer_id))),
      Promise.allSettled(
        batch.map(j => (j.st_location_id ? st.getLocation(j.st_location_id) : Promise.resolve(null)))
      ),
    ]);

    for (let n = 0; n < batch.length; n++) {
      const custResult = customers[n];
      const locResult = locations[n];
      const customer = custResult.status === 'fulfilled' ? custResult.value : null;
      const location = locResult.status === 'fulfilled' ? locResult.value : null;

      const updates: Record<string, unknown> = {};
      if (customer?.name) updates.customer_name = customer.name;
      if (customer?.phoneNumber) updates.customer_phone = customer.phoneNumber;
      if (customer?.email) updates.customer_email = customer.email;
      const address = location ? formatAddress(location) : '';
      if (address) updates.job_address = address;

      // A row we couldn't resolve stays null and gets retried next sync.
      if (Object.keys(updates).length > 0) {
        await supabase.from('ap_install_jobs').update(updates).eq('id', batch[n].id);
        enriched++;
      }
    }
  }

  const remaining = pending.length - attempted;
  console.log(
    `Customer/location enrichment: ${enriched}/${attempted} jobs` +
      (remaining > 0 ? ` (${remaining}+ deferred to next sync)` : '')
  );

  return { enriched, attempted, remaining };
}
