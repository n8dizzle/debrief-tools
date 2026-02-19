/**
 * SMS + Email notification templates and orchestration for AP Payments
 */

import { sendSMS, formatPhoneE164 } from './twilio';
import { sendEmail } from './email';
import { getServerSupabase } from './supabase';
import { formatCurrency } from './ap-utils';

// --------------- Helpers ---------------

interface NotificationPhone {
  name: string;
  phone: string;
}

interface NotificationEmail {
  name: string;
  email: string;
}

/**
 * Get internal team phone numbers from ap_sync_settings
 */
export async function getInternalTeamPhones(): Promise<NotificationPhone[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'notification_phones')
    .single();

  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as NotificationPhone[];
}

/**
 * Get internal team email addresses from ap_sync_settings
 */
async function getInternalTeamEmails(): Promise<NotificationEmail[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'notification_emails')
    .single();

  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as NotificationEmail[];
}

/**
 * Get install manager phone numbers from ap_sync_settings
 */
async function getInstallManagerPhones(): Promise<NotificationPhone[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'install_manager_phones')
    .single();

  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as NotificationPhone[];
}

/**
 * Get install manager email addresses from ap_sync_settings
 */
async function getInstallManagerEmails(): Promise<NotificationEmail[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'install_manager_emails')
    .single();

  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as NotificationEmail[];
}

/**
 * Log an SMS send attempt to ap_sms_log
 */
async function logSMS(params: {
  job_id: string | null;
  contractor_id: string | null;
  recipient_type: 'contractor' | 'internal';
  recipient_phone: string;
  recipient_name: string | null;
  event_type: string;
  message: string;
  status: 'sent' | 'failed';
  twilio_sid: string | null;
  error_message: string | null;
  sent_by: string | null;
}) {
  const supabase = getServerSupabase();
  await supabase.from('ap_sms_log').insert({
    ...params,
    sent_at: params.status === 'sent' ? new Date().toISOString() : null,
  });
}

/**
 * Send SMS and log the result. Fire-and-forget safe.
 */
async function sendAndLog(params: {
  to: string;
  message: string;
  job_id: string | null;
  contractor_id: string | null;
  recipient_type: 'contractor' | 'internal';
  recipient_name: string | null;
  event_type: string;
  sent_by: string | null;
}) {
  const result = await sendSMS(params.to, params.message);
  await logSMS({
    job_id: params.job_id,
    contractor_id: params.contractor_id,
    recipient_type: params.recipient_type,
    recipient_phone: params.to,
    recipient_name: params.recipient_name,
    event_type: params.event_type,
    message: params.message,
    status: result.success ? 'sent' : 'failed',
    twilio_sid: result.twilioSid || null,
    error_message: result.error || null,
    sent_by: params.sent_by,
  });
}

/**
 * Build a simple HTML email from a notification message
 */
function buildEmailHtml(subject: string, message: string, jobId?: string): string {
  const linkUrl = jobId ? `https://ap.christmasair.com/jobs/${jobId}` : 'https://ap.christmasair.com/jobs';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a2332; border-radius: 8px; padding: 24px; color: #e8dcc8;">
        <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #5D8A66;">${subject}</h2>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #e8dcc8;">${message}</p>
        <a href="${linkUrl}" style="display: inline-block; padding: 8px 16px; background: #5D8A66; color: white; text-decoration: none; border-radius: 6px; font-size: 13px;">View in AP Payments</a>
      </div>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #888;">Christmas Air - AP Payments</p>
    </div>
  `;
}

/**
 * Send email notifications to specified recipients
 */
async function sendEmailToRecipients(recipients: NotificationEmail[], subject: string, message: string, jobId?: string) {
  for (const recipient of recipients) {
    await sendEmail(recipient.email, subject, buildEmailHtml(subject, message, jobId))
      .catch(err => console.error('Email error:', err));
  }
}

// --------------- Job info helper ---------------

async function getJobInfo(jobId: string) {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_install_jobs')
    .select('job_number, customer_name, trade, contractor_id, payment_amount, payment_method, invoice_source, contractor:ap_contractors(id, name, phone)')
    .eq('id', jobId)
    .single();
  return data;
}

// --------------- Notification Functions ---------------

/**
 * Send SMS + email when a job is assigned to a contractor
 */
export async function sendAssignmentNotification(
  jobId: string,
  contractorId: string,
  paymentAmount: number | null,
  sentBy: string
) {
  const job = await getJobInfo(jobId);
  if (!job) return;

  const contractorArr = job.contractor as unknown as { id: string; name: string; phone: string | null }[] | null;
  const contractor = contractorArr?.[0] ?? null;
  const amountStr = paymentAmount != null ? formatCurrency(paymentAmount) : 'TBD';
  const tradeLabel = job.trade === 'plumbing' ? 'Plumbing' : 'HVAC';

  // Send SMS to contractor
  if (contractor?.phone && formatPhoneE164(contractor.phone)) {
    const msg = `Christmas Air: Job #${job.job_number} (${job.customer_name || 'Customer'}, ${tradeLabel}) assigned to you. Amount: ${amountStr}`;
    await sendAndLog({
      to: contractor.phone,
      message: msg,
      job_id: jobId,
      contractor_id: contractorId,
      recipient_type: 'contractor',
      recipient_name: contractor.name,
      event_type: 'assignment',
      sent_by: sentBy,
    });
  }

  // Send SMS to internal team
  const teamPhones = await getInternalTeamPhones();
  for (const member of teamPhones) {
    if (!formatPhoneE164(member.phone)) continue;
    const msg = `AP: Job #${job.job_number} assigned to ${contractor?.name || 'contractor'} for ${amountStr}`;
    await sendAndLog({
      to: member.phone,
      message: msg,
      job_id: jobId,
      contractor_id: contractorId,
      recipient_type: 'internal',
      recipient_name: member.name,
      event_type: 'assignment',
      sent_by: sentBy,
    });
  }

  // Send email to internal team
  const teamEmails = await getInternalTeamEmails();
  await sendEmailToRecipients(
    teamEmails,
    `Job #${job.job_number} Assigned`,
    `Job #${job.job_number} (${job.customer_name || 'Customer'}, ${tradeLabel}) assigned to ${contractor?.name || 'contractor'} for ${amountStr}.`,
    jobId
  );
}

/**
 * Send SMS + email when a payment status changes
 */
export async function sendPaymentStatusNotification(
  jobId: string,
  newStatus: string,
  amount: number | null,
  sentBy: string,
  invoiceSource?: string | null
) {
  const job = await getJobInfo(jobId);
  if (!job) return;

  const contractorArr = job.contractor as unknown as { id: string; name: string; phone: string | null }[] | null;
  const contractor = contractorArr?.[0] ?? null;
  const amountStr = amount != null ? formatCurrency(amount) : 'TBD';
  const eventType = `payment_${newStatus}`;

  // Notification routing based on status and invoice source
  const source = invoiceSource || job.invoice_source;

  if (newStatus === 'pending_approval') {
    // Notify install manager: invoice received via AP email, needs approval
    const managerPhones = await getInstallManagerPhones();
    for (const manager of managerPhones) {
      if (!formatPhoneE164(manager.phone)) continue;
      await sendAndLog({
        to: manager.phone,
        message: `AP: Invoice received for Job #${job.job_number} (${contractor?.name || 'contractor'}, ${amountStr}) — please approve at ap.christmasair.com`,
        job_id: jobId,
        contractor_id: contractor?.id || null,
        recipient_type: 'internal',
        recipient_name: manager.name,
        event_type: eventType,
        sent_by: sentBy,
      });
    }
    // Email install managers
    const managerEmails = await getInstallManagerEmails();
    await sendEmailToRecipients(
      managerEmails,
      `Invoice Needs Approval — Job #${job.job_number}`,
      `Invoice of ${amountStr} received for Job #${job.job_number} (${contractor?.name || 'contractor'}). Please review and approve.`,
      jobId
    );
    return;
  }

  if (newStatus === 'ready_to_pay') {
    // Notify AP team: invoice is approved and ready to pay
    const teamPhones = await getInternalTeamPhones();
    for (const member of teamPhones) {
      if (!formatPhoneE164(member.phone)) continue;
      const sourceLabel = source === 'manager_text' ? ' (via manager)' : '';
      await sendAndLog({
        to: member.phone,
        message: `AP: Job #${job.job_number} (${contractor?.name || 'contractor'}, ${amountStr}) approved and ready to pay${sourceLabel}.`,
        job_id: jobId,
        contractor_id: contractor?.id || null,
        recipient_type: 'internal',
        recipient_name: member.name,
        event_type: eventType,
        sent_by: sentBy,
      });
    }
    // Email AP team
    const teamEmails = await getInternalTeamEmails();
    await sendEmailToRecipients(
      teamEmails,
      `Ready to Pay — Job #${job.job_number}`,
      `Job #${job.job_number} (${contractor?.name || 'contractor'}) approved for ${amountStr}. Ready to process payment.`,
      jobId
    );
    return;
  }

  if (newStatus === 'paid') {
    // Notify contractor: payment sent
    if (contractor?.phone && formatPhoneE164(contractor.phone)) {
      await sendAndLog({
        to: contractor.phone,
        message: `Christmas Air: Payment of ${amountStr} for Job #${job.job_number} sent${job.payment_method ? ` via ${job.payment_method}` : ''}.`,
        job_id: jobId,
        contractor_id: contractor.id,
        recipient_type: 'contractor',
        recipient_name: contractor.name,
        event_type: eventType,
        sent_by: sentBy,
      });
    }

    // Notify internal team
    const teamPhones = await getInternalTeamPhones();
    for (const member of teamPhones) {
      if (!formatPhoneE164(member.phone)) continue;
      await sendAndLog({
        to: member.phone,
        message: `AP: Payment of ${amountStr} paid for Job #${job.job_number} (${contractor?.name || 'contractor'}).`,
        job_id: jobId,
        contractor_id: contractor?.id || null,
        recipient_type: 'internal',
        recipient_name: member.name,
        event_type: eventType,
        sent_by: sentBy,
      });
    }

    // Email AP team
    const teamEmails = await getInternalTeamEmails();
    await sendEmailToRecipients(
      teamEmails,
      `Payment Paid — Job #${job.job_number}`,
      `Payment of ${amountStr} paid for Job #${job.job_number} (${contractor?.name || 'contractor'}).`,
      jobId
    );
    return;
  }
}

/**
 * Send a manual SMS (from the UI)
 */
export async function sendManualSMS(params: {
  job_id: string | null;
  contractor_id: string | null;
  phone: string;
  recipient_name: string | null;
  message: string;
  sent_by: string;
}) {
  const result = await sendSMS(params.phone, params.message);
  await logSMS({
    job_id: params.job_id,
    contractor_id: params.contractor_id,
    recipient_type: params.contractor_id ? 'contractor' : 'internal',
    recipient_phone: params.phone,
    recipient_name: params.recipient_name,
    event_type: 'manual',
    message: params.message,
    status: result.success ? 'sent' : 'failed',
    twilio_sid: result.twilioSid || null,
    error_message: result.error || null,
    sent_by: params.sent_by,
  });
  return result;
}
