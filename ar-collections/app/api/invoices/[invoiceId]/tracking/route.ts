import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/ar-utils';
import { sendEmail, generateOwnerAssignmentEmail } from '@/lib/email';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoiceId } = await params;
    const body = await request.json();
    const supabase = getServerSupabase();

    // Check if tracking record exists
    const { data: existingTracking, error: checkError } = await supabase
      .from('ar_invoice_tracking')
      .select('id')
      .eq('invoice_id', invoiceId)
      .single();

    const today = getTodayDateString();

    // Prepare update data with date tracking
    const updateData: Record<string, any> = { ...body };

    // Auto-set control_bucket when job_status (work status) is changed
    if (body.job_status) {
      // Look up the job status to get its linked control_bucket
      const { data: jobStatusData } = await supabase
        .from('ar_job_statuses')
        .select('control_bucket')
        .eq('key', body.job_status)
        .single();

      if (jobStatusData?.control_bucket) {
        updateData.control_bucket = jobStatusData.control_bucket;
      }
    }

    // Collection status changes do NOT affect control_bucket

    // Auto-set dates when checkboxes are checked
    if (body.day1_text_sent === true && !body.day1_text_date) {
      updateData.day1_text_date = today;
    }
    if (body.day2_call_made === true && !body.day2_call_date) {
      updateData.day2_call_date = today;
    }
    if (body.day3_etc === true && !body.day3_etc_date) {
      updateData.day3_etc_date = today;
    }
    if (body.day7_etc === true && !body.day7_etc_date) {
      updateData.day7_etc_date = today;
    }
    if (body.certified_letter_sent === true && !body.certified_letter_date) {
      updateData.certified_letter_date = today;
    }
    if (body.closed === true && !body.closed_date) {
      updateData.closed_date = today;
    }

    let tracking;

    if (existingTracking) {
      // Update existing tracking
      const { data, error } = await supabase
        .from('ar_invoice_tracking')
        .update(updateData)
        .eq('invoice_id', invoiceId)
        .select()
        .single();

      if (error) {
        console.error('Error updating tracking:', error);
        return NextResponse.json({ error: 'Failed to update tracking' }, { status: 500 });
      }
      tracking = data;
    } else {
      // Create new tracking record
      const { data, error } = await supabase
        .from('ar_invoice_tracking')
        .insert({
          invoice_id: invoiceId,
          ...updateData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating tracking:', error);
        return NextResponse.json({ error: 'Failed to create tracking' }, { status: 500 });
      }
      tracking = data;
    }

    // Send email notification when owner is assigned (not when cleared)
    if (body.owner_id) {
      try {
        // Look up the new owner and the invoice details
        const { data: newOwner } = await supabase
          .from('portal_users')
          .select('name, email')
          .eq('id', body.owner_id)
          .single();

        const { data: invoice } = await supabase
          .from('ar_invoices')
          .select('customer_name, invoice_number, balance, days_outstanding')
          .eq('id', invoiceId)
          .single();

        if (newOwner?.email && invoice) {
          const baseUrl = process.env.NEXTAUTH_URL || 'https://ar.christmasair.com';
          const html = generateOwnerAssignmentEmail({
            assigneeName: newOwner.name || newOwner.email,
            assignerName: session.user.name || session.user.email || 'Someone',
            customerName: invoice.customer_name,
            invoiceNumber: invoice.invoice_number,
            balance: invoice.balance,
            daysOutstanding: invoice.days_outstanding,
            invoiceUrl: `${baseUrl}/invoices/${invoiceId}`,
          });

          await sendEmail(
            newOwner.email,
            `AR Assignment: ${invoice.customer_name} - Invoice #${invoice.invoice_number}`,
            html
          );
        }
      } catch (emailErr) {
        console.error('Failed to send owner assignment email:', emailErr);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ tracking });
  } catch (error) {
    console.error('Tracking update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
