import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: job } = await supabase
    .from('ap_install_jobs')
    .select('st_job_id, st_customer_id, st_location_id')
    .eq('id', id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const st = getServiceTitanClient();
  if (!st.isConfigured()) {
    return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 500 });
  }

  const result: Record<string, unknown> = {
    jobSummary: null,
    technician: null,
    soldBy: null,
    invoiceId: null,
    invoiceTotal: null,
    lineItems: [],
    customerTags: [],
  };

  try {
    // Fetch job details from ST
    const stJob = await st.getJob(job.st_job_id);
    if (stJob) {
      result.jobSummary = stJob.summary || null;
    }

    // Fetch invoice details if available
    if (stJob && (stJob as any).invoiceId) {
      const invoiceId = (stJob as any).invoiceId;
      result.invoiceId = invoiceId;
      try {
        const invoice = await st.getInvoice(invoiceId);
        if (invoice) {
          result.invoiceTotal = invoice.total;
          result.lineItems = (invoice.items || []).map((item: any) => ({
            id: item.id,
            description: item.displayName || item.skuName || item.description || '—',
            quantity: item.quantity ?? 1,
            unitPrice: item.price ?? 0,
            total: item.total ?? 0,
            type: item.type || null,
          }));
          if (invoice.employeeInfo?.name) {
            result.soldBy = invoice.employeeInfo.name;
          }
        }
      } catch {
        // Invoice fetch is best-effort
      }
    }
  } catch (error) {
    console.error('Error fetching ST details:', error);
  }

  return NextResponse.json(result);
}
