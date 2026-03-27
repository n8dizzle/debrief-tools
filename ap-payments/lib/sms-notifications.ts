/**
 * SMS + Email notification templates and orchestration for AP Payments
 */

import { sendSMS, formatPhoneE164 } from './twilio';
import { sendEmail } from './email';
import { getServerSupabase } from './supabase';
import { formatCurrency } from './ap-utils';
import { DEFAULT_TEMPLATES } from './notification-templates';

// --------------- Helpers ---------------

export interface NotificationToggles {
  // Legacy boolean toggles (backwards compat)
  assignment_contractor?: boolean;
  assignment_internal?: boolean;
  pending_approval_manager?: boolean;
  ready_to_pay_internal?: boolean;
  paid_contractor?: boolean;
  paid_internal?: boolean;
  // Per-channel toggles (new format: key_sms, key_email)
  [key: string]: boolean | undefined;
}

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
 * Get manager phone numbers by trade, falling back to generic install_manager_phones
 */
async function getManagerPhonesByTrade(trade: string): Promise<NotificationPhone[]> {
  const supabase = getServerSupabase();
  const tradeKey = trade === 'plumbing' ? 'plumbing_manager_phones' : 'hvac_manager_phones';

  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', tradeKey)
    .single();

  if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
    return data.value as NotificationPhone[];
  }

  // Fallback to generic install manager phones
  const { data: fallback } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'install_manager_phones')
    .single();

  if (!fallback?.value || !Array.isArray(fallback.value)) return [];
  return fallback.value as NotificationPhone[];
}

/**
 * Get notification toggles. Defaults to all enabled if not configured.
 */
async function getNotificationToggles(): Promise<NotificationToggles> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'notification_toggles')
    .single();

  return (data?.value as NotificationToggles) || {};
}

/** Check if a notification channel is enabled. Checks key_sms / key_email first, falls back to legacy key. */
function isSmsEnabled(toggles: NotificationToggles, key: string): boolean {
  const channelKey = `${key}_sms`;
  if (channelKey in toggles) return toggles[channelKey] !== false;
  return toggles[key] !== false; // legacy fallback
}

function isEmailEnabled(toggles: NotificationToggles, key: string): boolean {
  const channelKey = `${key}_email`;
  if (channelKey in toggles) return toggles[channelKey] !== false;
  return toggles[key] !== false; // legacy fallback
}

/**
 * Get manager email addresses by trade, falling back to generic install_manager_emails
 */
async function getManagerEmailsByTrade(trade: string): Promise<NotificationEmail[]> {
  const supabase = getServerSupabase();
  const tradeKey = trade === 'plumbing' ? 'plumbing_manager_emails' : 'hvac_manager_emails';

  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', tradeKey)
    .single();

  if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
    return data.value as NotificationEmail[];
  }

  // Fallback to generic install manager emails
  const { data: fallback } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'install_manager_emails')
    .single();

  if (!fallback?.value || !Array.isArray(fallback.value)) return [];
  return fallback.value as NotificationEmail[];
}

/**
 * Log a notification send attempt to ap_sms_log
 */
async function logNotification(params: {
  job_id: string | null;
  contractor_id: string | null;
  recipient_type: 'contractor' | 'internal';
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name: string | null;
  event_type: string;
  message: string;
  status: 'sent' | 'failed';
  channel: 'sms' | 'email';
  twilio_sid?: string | null;
  error_message?: string | null;
  sent_by: string | null;
}) {
  const supabase = getServerSupabase();
  await supabase.from('ap_sms_log').insert({
    ...params,
    recipient_phone: params.recipient_phone || null,
    recipient_email: params.recipient_email || null,
    twilio_sid: params.twilio_sid || null,
    error_message: params.error_message || null,
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
  await logNotification({
    job_id: params.job_id,
    contractor_id: params.contractor_id,
    recipient_type: params.recipient_type,
    recipient_phone: params.to,
    recipient_name: params.recipient_name,
    event_type: params.event_type,
    message: params.message,
    status: result.success ? 'sent' : 'failed',
    channel: 'sms',
    twilio_sid: result.messageId || null,
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
 * Send email notifications to specified recipients and log each send
 */
async function sendEmailToRecipients(
  recipients: NotificationEmail[],
  subject: string,
  message: string,
  ctx: { jobId?: string; contractorId?: string | null; recipientType: 'contractor' | 'internal'; eventType: string; sentBy: string | null }
) {
  for (const recipient of recipients) {
    try {
      await sendEmail(recipient.email, subject, buildEmailHtml(subject, message, ctx.jobId));
      await logNotification({
        job_id: ctx.jobId || null,
        contractor_id: ctx.contractorId || null,
        recipient_type: ctx.recipientType,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        event_type: ctx.eventType,
        message,
        status: 'sent',
        channel: 'email',
        sent_by: ctx.sentBy,
      });
    } catch (err) {
      console.error('Email error:', err);
      await logNotification({
        job_id: ctx.jobId || null,
        contractor_id: ctx.contractorId || null,
        recipient_type: ctx.recipientType,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        event_type: ctx.eventType,
        message,
        status: 'failed',
        channel: 'email',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        sent_by: ctx.sentBy,
      });
    }
  }
}

// --------------- Template loading & rendering ---------------

/**
 * Load custom notification templates from ap_sync_settings, falling back to defaults.
 */
async function getNotificationTemplates(): Promise<Record<string, string>> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'notification_templates')
    .single();

  const custom = (data?.value as Record<string, string>) || {};
  return { ...DEFAULT_TEMPLATES, ...custom };
}

/**
 * Replace {variable} placeholders in a template string with actual values.
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

// --------------- Job info helper ---------------

async function getJobInfo(jobId: string) {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_install_jobs')
    .select('job_number, customer_name, job_address, trade, contractor_id, payment_amount, payment_method, invoice_source, contractor:ap_contractors(id, name, phone, email)')
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
  const [job, toggles, templates] = await Promise.all([getJobInfo(jobId), getNotificationToggles(), getNotificationTemplates()]);
  if (!job) return;

  // Supabase returns many-to-one joins as object or array depending on client version
  const rawContractor = job.contractor as unknown;
  const contractor = Array.isArray(rawContractor) ? rawContractor[0] ?? null : (rawContractor as { id: string; name: string; phone: string | null } | null);
  const amountStr = paymentAmount != null ? formatCurrency(paymentAmount) : 'TBD';
  const tradeLabel = job.trade === 'plumbing' ? 'Plumbing' : 'HVAC';

  const vars: Record<string, string> = {
    job_number: job.job_number || '',
    customer_name: job.customer_name || 'Customer',
    contractor_name: contractor?.name || 'contractor',
    amount: amountStr,
    trade: tradeLabel,
    address: job.job_address || '',
    payment_method: '',
    source_label: '',
  };

  // Send SMS to contractor
  if (isSmsEnabled(toggles, 'assignment_contractor') && contractor?.phone && formatPhoneE164(contractor.phone)) {
    const msg = renderTemplate(templates.assignment_contractor, vars);
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

  // Send SMS + email to internal team
  if (isSmsEnabled(toggles, 'assignment_internal')) {
    const msg = renderTemplate(templates.assignment_internal, vars);
    const teamPhones = await getInternalTeamPhones();
    for (const member of teamPhones) {
      if (!formatPhoneE164(member.phone)) continue;
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

    const teamEmails = await getInternalTeamEmails();
    const subject = renderTemplate(templates.subject_assignment_internal, vars);
    await sendEmailToRecipients(teamEmails, subject, msg, { jobId, contractorId, recipientType: 'internal', eventType: 'assignment', sentBy });
  }
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
  const [job, toggles, templates] = await Promise.all([getJobInfo(jobId), getNotificationToggles(), getNotificationTemplates()]);
  if (!job) return;

  // Supabase returns many-to-one joins as object or array depending on client version
  const rawContractor = job.contractor as unknown;
  const contractor = Array.isArray(rawContractor) ? rawContractor[0] ?? null : (rawContractor as { id: string; name: string; phone: string | null; email: string | null } | null);
  const amountStr = amount != null ? formatCurrency(amount) : 'TBD';
  const eventType = `payment_${newStatus}`;

  // Notification routing based on status and invoice source
  const source = invoiceSource || job.invoice_source;

  const vars: Record<string, string> = {
    job_number: job.job_number || '',
    customer_name: job.customer_name || 'Customer',
    contractor_name: contractor?.name || 'contractor',
    amount: amountStr,
    trade: job.trade === 'plumbing' ? 'Plumbing' : 'HVAC',
    address: job.job_address || '',
    payment_method: job.payment_method ? ` via ${job.payment_method}` : '',
    source_label: source === 'manager_text' ? ' (via manager)' : '',
  };

  if (newStatus === 'pending_approval') {
    const msg = renderTemplate(templates.pending_approval_manager, vars);
    if (isSmsEnabled(toggles, 'pending_approval_manager')) {
      const managerPhones = await getManagerPhonesByTrade(job.trade || 'hvac');
      for (const manager of managerPhones) {
        if (!formatPhoneE164(manager.phone)) continue;
        await sendAndLog({
          to: manager.phone,
          message: msg,
          job_id: jobId,
          contractor_id: contractor?.id || null,
          recipient_type: 'internal',
          recipient_name: manager.name,
          event_type: eventType,
          sent_by: sentBy,
        });
      }
    }
    if (isEmailEnabled(toggles, 'pending_approval_manager')) {
      const managerEmails = await getManagerEmailsByTrade(job.trade || 'hvac');
      const subject = renderTemplate(templates.subject_pending_approval_manager, vars);
      await sendEmailToRecipients(managerEmails, subject, msg, { jobId, contractorId: contractor?.id, recipientType: 'internal', eventType, sentBy });
    }
    return;
  }

  if (newStatus === 'ready_to_pay') {
    const msg = renderTemplate(templates.ready_to_pay_internal, vars);
    if (isSmsEnabled(toggles, 'ready_to_pay_internal')) {
      const teamPhones = await getInternalTeamPhones();
      for (const member of teamPhones) {
        if (!formatPhoneE164(member.phone)) continue;
        await sendAndLog({
          to: member.phone,
          message: msg,
          job_id: jobId,
          contractor_id: contractor?.id || null,
          recipient_type: 'internal',
          recipient_name: member.name,
          event_type: eventType,
          sent_by: sentBy,
        });
      }
    }
    if (isEmailEnabled(toggles, 'ready_to_pay_internal')) {
      const teamEmails = await getInternalTeamEmails();
      const subject = renderTemplate(templates.subject_ready_to_pay_internal, vars);
      await sendEmailToRecipients(teamEmails, subject, msg, { jobId, contractorId: contractor?.id, recipientType: 'internal', eventType, sentBy });
    }
    return;
  }

  if (newStatus === 'paid') {
    const paidContractorMsg = renderTemplate(templates.paid_contractor, vars);
    if (isSmsEnabled(toggles, 'paid_contractor') && contractor?.phone && formatPhoneE164(contractor.phone)) {
      await sendAndLog({
        to: contractor.phone,
        message: paidContractorMsg,
        job_id: jobId,
        contractor_id: contractor.id,
        recipient_type: 'contractor',
        recipient_name: contractor.name,
        event_type: eventType,
        sent_by: sentBy,
      });
    }
    if (isEmailEnabled(toggles, 'paid_contractor') && contractor?.email) {
      const subject = renderTemplate(templates.subject_paid_contractor, vars);
      await sendEmailToRecipients([{ name: contractor.name, email: contractor.email }], subject, paidContractorMsg, { jobId, contractorId: contractor.id, recipientType: 'contractor', eventType, sentBy });
    }

    // Paid → AP Team
    const paidApMsg = renderTemplate(templates.paid_internal, vars);
    if (isSmsEnabled(toggles, 'paid_internal')) {
      const teamPhones = await getInternalTeamPhones();
      for (const member of teamPhones) {
        if (!formatPhoneE164(member.phone)) continue;
        await sendAndLog({
          to: member.phone,
          message: paidApMsg,
          job_id: jobId,
          contractor_id: contractor?.id || null,
          recipient_type: 'internal',
          recipient_name: member.name,
          event_type: eventType,
          sent_by: sentBy,
        });
      }
    }
    if (isEmailEnabled(toggles, 'paid_internal')) {
      const teamEmails = await getInternalTeamEmails();
      const subject = renderTemplate(templates.subject_paid_internal, vars);
      await sendEmailToRecipients(teamEmails, subject, paidApMsg, { jobId, contractorId: contractor?.id, recipientType: 'internal', eventType, sentBy });
    }

    // Paid → Trade Managers
    const paidMgrMsg = renderTemplate(templates.paid_manager || templates.paid_internal, vars);
    if (isSmsEnabled(toggles, 'paid_manager')) {
      const managerPhones = await getManagerPhonesByTrade(job.trade || 'hvac');
      for (const manager of managerPhones) {
        if (!formatPhoneE164(manager.phone)) continue;
        await sendAndLog({
          to: manager.phone,
          message: paidMgrMsg,
          job_id: jobId,
          contractor_id: contractor?.id || null,
          recipient_type: 'internal',
          recipient_name: manager.name,
          event_type: eventType,
          sent_by: sentBy,
        });
      }
    }
    if (isEmailEnabled(toggles, 'paid_manager')) {
      const managerEmails = await getManagerEmailsByTrade(job.trade || 'hvac');
      const subject = renderTemplate(templates.subject_paid_manager || templates.subject_paid_internal, vars);
      await sendEmailToRecipients(managerEmails, subject, paidMgrMsg, { jobId, contractorId: contractor?.id, recipientType: 'internal', eventType, sentBy });
    }
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
  await logNotification({
    job_id: params.job_id,
    contractor_id: params.contractor_id,
    recipient_type: params.contractor_id ? 'contractor' : 'internal',
    recipient_phone: params.phone,
    recipient_name: params.recipient_name,
    event_type: 'manual',
    message: params.message,
    status: result.success ? 'sent' : 'failed',
    channel: 'sms',
    twilio_sid: result.messageId || null,
    error_message: result.error || null,
    sent_by: params.sent_by,
  });
  return result;
}
