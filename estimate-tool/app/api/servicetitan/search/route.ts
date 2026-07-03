import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

export interface SearchResult {
  jobId: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName?: string;
  customerId: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  locationId: number;
}

// GET /api/servicetitan/search?q=smith
// Searches by job number, customer name, phone, or address
export async function GET(request: Request) {
  // Auth check disabled for MVP testing
  // const session = await getServerSession(authOptions);
  // if (!session) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const st = new ServiceTitanClient();
    const results: SearchResult[] = [];

    // Detect if query looks like a job number (all digits)
    const isJobNumber = /^\d+$/.test(query);
    // Detect if query looks like a phone number (digits, dashes, parens, spaces)
    const isPhone = /^[\d\s\-()\.+]+$/.test(query) && query.replace(/\D/g, '').length >= 7;

    if (isJobNumber) {
      // Search by job number
      const job = await st.getJobByNumber(query);
      if (job) {
        const result = await buildResult(st, job);
        if (result) results.push(result);
      }
    }

    if (isPhone || (!isJobNumber && !isPhone)) {
      // Search by phone or customer name
      const searchParams = isPhone
        ? { phoneNumber: query.replace(/\D/g, '') }
        : { name: query };
      const customers = await st.searchCustomers(searchParams);

      // Fetch full customer details in parallel (search results don't include contacts)
      const fullCustomers = await Promise.all(
        customers.slice(0, 10).map(c => st.getCustomer(c.id).catch(() => c))
      );

      for (const customer of fullCustomers) {
        const jobs = await st.getJobsForCustomer(customer.id);
        if (jobs.length > 0) {
          const job = jobs[0];
          const result = await buildResultFromCustomerJob(st, customer, job);
          if (result) results.push(result);
        } else {
          results.push({
            jobId: 0,
            jobNumber: '',
            jobStatus: 'No jobs',
            customerId: customer.id,
            customerName: customer.name || '',
            phone: extractContact(customer.contacts, 'Phone', 'MobilePhone'),
            email: extractContact(customer.contacts, 'Email'),
            address: formatAddress(customer.address),
            locationId: 0,
          });
        }
      }
    }

    // Deduplicate by customerId
    const seen = new Set<number>();
    const unique = results.filter(r => {
      if (seen.has(r.customerId)) return false;
      seen.add(r.customerId);
      return true;
    });

    return NextResponse.json({ results: unique });
  } catch (err) {
    console.error('[Search] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    );
  }
}

function extractContact(contacts?: Array<{ type: string; value: string }>, ...types: string[]): string {
  if (!contacts) return '';
  for (const type of types) {
    const found = contacts.find(c => c.type === type);
    if (found) return found.value;
  }
  return '';
}

function formatAddress(addr?: { street?: string; unit?: string; city?: string; state?: string; zip?: string }): string {
  if (!addr) return '';
  return [addr.street, addr.unit, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

async function buildResult(
  st: ServiceTitanClient,
  job: { id: number; jobNumber: string; jobStatus: string; customerId: number; locationId: number; businessUnitName?: string }
): Promise<SearchResult | null> {
  try {
    const [customer, location] = await Promise.all([
      st.getCustomer(job.customerId),
      st.getLocation(job.locationId),
    ]);

    return {
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobStatus: job.jobStatus,
      businessUnitName: job.businessUnitName,
      customerId: customer.id,
      customerName: customer.name || '',
      phone: extractContact(customer.contacts, 'Phone', 'MobilePhone'),
      email: extractContact(customer.contacts, 'Email'),
      address: formatAddress(location.address || customer.address),
      locationId: location.id,
    };
  } catch {
    return null;
  }
}

async function buildResultFromCustomerJob(
  st: ServiceTitanClient,
  customer: { id: number; name: string; contacts?: Array<{ type: string; value: string }>; address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string } },
  job: { id: number; jobNumber: string; jobStatus: string; locationId: number; businessUnitName?: string }
): Promise<SearchResult | null> {
  try {
    // Fetch full customer details if contacts are missing
    let fullCustomer = customer;
    if (!customer.contacts || customer.contacts.length === 0) {
      try {
        fullCustomer = await st.getCustomer(customer.id);
      } catch { /* use what we have */ }
    }

    let address = formatAddress(fullCustomer.address);
    let locationId = job.locationId;

    if (job.locationId) {
      try {
        const location = await st.getLocation(job.locationId);
        address = formatAddress(location.address) || address;
        locationId = location.id;
      } catch { /* use customer address */ }
    }

    return {
      jobId: job.id,
      jobNumber: job.jobNumber,
      jobStatus: job.jobStatus,
      businessUnitName: job.businessUnitName,
      customerId: fullCustomer.id,
      customerName: fullCustomer.name || '',
      phone: extractContact(fullCustomer.contacts, 'Phone', 'MobilePhone'),
      email: extractContact(fullCustomer.contacts, 'Email'),
      address,
      locationId,
    };
  } catch {
    return null;
  }
}
