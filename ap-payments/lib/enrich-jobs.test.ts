import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichPendingJobs, EnrichSTClient, EnrichSupabase, PendingJobRow } from './enrich-jobs';

type Update = { id: string; values: Record<string, unknown> };

/**
 * Fake of the two Supabase chains enrichPendingJobs builds: the pending-jobs
 * select, and the per-row update. Records every update so tests can assert on
 * exactly which rows got written.
 */
function fakeSupabase(
  result: { data: PendingJobRow[] | null; error: unknown }
): { client: EnrichSupabase; updates: Update[] } {
  const updates: Update[] = [];
  const client = {
    from: () => ({
      select: () => ({
        is: () => ({
          not: () => ({
            order: () => ({
              limit: async () => result,
            }),
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, values });
          return { error: null };
        },
      }),
    }),
  } as unknown as EnrichSupabase;
  return { client, updates };
}

function row(id: string, overrides: Partial<PendingJobRow> = {}): PendingJobRow {
  return { id, st_customer_id: Number(id) * 10, st_location_id: Number(id) * 100, ...overrides };
}

const location = (street: string) =>
  ({ address: { street, city: 'Lewisville', state: 'TX', zip: '75077' } }) as never;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enrichPendingJobs', () => {
  it('logs and bails when the pending query errors (never silently)', async () => {
    const { client, updates } = fakeSupabase({ data: null, error: { message: 'boom' } });
    const st: EnrichSTClient = {
      getCustomer: vi.fn(),
      getLocation: vi.fn(),
    };

    const result = await enrichPendingJobs(st, client);

    expect(result).toEqual({ enriched: 0, attempted: 0, remaining: 0 });
    expect(updates).toEqual([]);
    expect(st.getCustomer).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled(); // the whole point: it is not swallowed
  });

  it('no-ops on an empty queue without calling ServiceTitan', async () => {
    const { client, updates } = fakeSupabase({ data: [], error: null });
    const st: EnrichSTClient = { getCustomer: vi.fn(), getLocation: vi.fn() };

    const result = await enrichPendingJobs(st, client);

    expect(result).toEqual({ enriched: 0, attempted: 0, remaining: 0 });
    expect(updates).toEqual([]);
    expect(st.getCustomer).not.toHaveBeenCalled();
  });

  it('writes name, phone, email and address for a resolved job', async () => {
    const { client, updates } = fakeSupabase({ data: [row('1')], error: null });
    const st: EnrichSTClient = {
      getCustomer: async () => ({
        name: 'Donelle DEmilio',
        phoneNumber: '469-555-0100',
        email: 'd@example.com',
      }),
      getLocation: async () => location('6312 Napoli Circle'),
    };

    const result = await enrichPendingJobs(st, client);

    expect(result.enriched).toBe(1);
    expect(updates).toEqual([
      {
        id: '1',
        values: {
          customer_name: 'Donelle DEmilio',
          customer_phone: '469-555-0100',
          customer_email: 'd@example.com',
          job_address: '6312 Napoli Circle, Lewisville, TX, 75077',
        },
      },
    ]);
  });

  it('omits fields ServiceTitan left blank rather than writing empty strings', async () => {
    const { client, updates } = fakeSupabase({ data: [row('1')], error: null });
    const st: EnrichSTClient = {
      getCustomer: async () => ({ name: 'Acme LLC', phoneNumber: '', email: null }),
      getLocation: async () => location('1 Main St'),
    };

    await enrichPendingJobs(st, client);

    expect(updates[0].values).toEqual({
      customer_name: 'Acme LLC',
      job_address: '1 Main St, Lewisville, TX, 75077',
    });
  });

  it('skips a row with no location id without failing the batch', async () => {
    const { client, updates } = fakeSupabase({
      data: [row('1', { st_location_id: null })],
      error: null,
    });
    const st: EnrichSTClient = {
      getCustomer: async () => ({ name: 'No Location' }),
      getLocation: vi.fn(),
    };

    await enrichPendingJobs(st, client);

    expect(st.getLocation).not.toHaveBeenCalled();
    expect(updates).toEqual([{ id: '1', values: { customer_name: 'No Location' } }]);
  });

  it('leaves a row untouched when its ST lookup rejects, and still writes its siblings', async () => {
    const { client, updates } = fakeSupabase({ data: [row('1'), row('2')], error: null });
    const st: EnrichSTClient = {
      getCustomer: async (id: number) => {
        if (id === 10) throw new Error('ST 500');
        return { name: 'Survivor' };
      },
      getLocation: async () => null,
    };

    const result = await enrichPendingJobs(st, client);

    // Row 1 failed, so it stays null and gets retried on the next sync.
    expect(result.enriched).toBe(1);
    expect(updates).toEqual([{ id: '2', values: { customer_name: 'Survivor' } }]);
  });

  it('stops at the deadline but keeps the batches it already completed', async () => {
    // 12 rows = 3 batches of 5/5/2. Clock jumps past the budget after batch 1.
    const rows = Array.from({ length: 12 }, (_, i) => row(String(i + 1)));
    const { client, updates } = fakeSupabase({ data: rows, error: null });
    const st: EnrichSTClient = {
      getCustomer: async (id: number) => ({ name: `Cust ${id}` }),
      getLocation: async () => null,
    };

    const ticks = [0, 0, 999_999, 999_999];
    let n = 0;
    const now = () => ticks[Math.min(n++, ticks.length - 1)];

    const result = await enrichPendingJobs(st, client, 10_000, now);

    expect(result.attempted).toBe(5); // only the first batch ran
    expect(result.enriched).toBe(5); // and its writes were kept, not discarded
    expect(result.remaining).toBe(7); // the rest carry to the next sync
    expect(updates).toHaveLength(5);
  });
});
