import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await params;
    const supabase = getServerSupabase();

    // Get the invoice to find ST IDs
    const { data: invoice, error: invoiceError } = await supabase
      .from('ar_invoices')
      .select('st_invoice_id, job_number, st_customer_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const stClient = getServiceTitanClient();
    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
    }

    const result: {
      jobSummary: string | null;
      invoiceSummary: string | null;
      lineItems: Array<{
        id: number;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        type?: string;
      }>;
      technician: string | null;
      soldBy: string | null;
      customerTags: Array<{ id: number; name: string }>;
    } = {
      jobSummary: null,
      invoiceSummary: null,
      lineItems: [],
      technician: null,
      soldBy: null,
      customerTags: [],
    };

    // Fetch job details if we have a job number
    if (invoice.job_number) {
      try {
        const job = await stClient.getJobByNumber(invoice.job_number);
        if (job) {
          // Get job summary from the job object
          const jobAny = job as any;
          result.jobSummary = jobAny.summary || null;

          // Get technician and sold by info
          if (jobAny.technician?.name) {
            result.technician = jobAny.technician.name;
          }
          if (jobAny.soldBy?.name) {
            result.soldBy = jobAny.soldBy.name;
          }
        }
      } catch (err) {
        console.error('Failed to fetch job details:', err);
      }
    }

    // Fetch invoice details if we have an ST invoice ID
    if (invoice.st_invoice_id && invoice.st_invoice_id > 0) {
      try {
        const stInvoice = await stClient.getInvoice(invoice.st_invoice_id);
        if (stInvoice) {
          const invoiceAny = stInvoice as any;
          result.invoiceSummary = invoiceAny.summary || null;

          // Get created by / sold by from invoice
          if (invoiceAny.employeeInfo?.name) {
            result.soldBy = invoiceAny.employeeInfo.name;
          }

          // Get line items
          if (invoiceAny.items && Array.isArray(invoiceAny.items)) {
            result.lineItems = invoiceAny.items.map((item: any) => ({
              id: item.id,
              // Use displayName or skuName instead of full HTML description
              description: item.displayName || item.skuName || 'Unknown Item',
              quantity: parseFloat(item.quantity) || 1,
              unitPrice: parseFloat(item.price) || 0,
              total: parseFloat(item.total) || 0,
              type: item.type || null,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch invoice details:', err);
      }
    }

    // Fetch customer tags if we have a customer ID
    if (invoice.st_customer_id && invoice.st_customer_id > 0) {
      try {
        const customer = await stClient.getCustomer(invoice.st_customer_id);
        if (customer) {
          const customerAny = customer as any;
          const tagTypeIds = customerAny.tagTypeIds || [];

          if (tagTypeIds.length > 0) {
            // Fetch tag type names
            const tagTypes = await stClient.getTagTypes();
            const tagMap = new Map<number, string>();
            for (const tag of tagTypes) {
              tagMap.set(tag.id, tag.name);
            }

            // Map tag IDs to names
            result.customerTags = tagTypeIds.map((id: number) => ({
              id,
              name: tagMap.get(id) || `Tag ${id}`,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch customer tags:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('ST details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch details', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
